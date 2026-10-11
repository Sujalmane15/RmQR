import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  assertPlanEntitlement,
  AuthorizationError,
  findReviewCampaignBySlug,
  mutateDb,
  pruneExpiredReviewSessions,
  readDb,
} from '@/lib/db/store';
import {
  checkRateLimit,
  generateShortSlug,
  sanitizeSlug,
  sanitizeText,
  validateSafeRedirectUrl,
} from '@/lib/security';
import {
  generateCustomerReviewAgentDrafts,
  generateCustomerReviewSuggestions,
  generateOwnerReviewReplyDraft,
} from '@/lib/ai/services';
import { getAIProviderStatus } from '@/lib/ai/agent-engine';
import {
  generateCustomQRSvg,
  generateQRPngBuffer,
  inspectPublicDeploymentOrigin,
  rasterizeQRSvgToBitmap,
} from '@/lib/qr/renderer';
import {
  CustomerReviewSession,
  DEFAULT_QR_STYLE,
  ExperienceLevel,
  ReviewCampaign,
  ReviewReplyLanguage,
  ReviewReplyTone,
  ReviewResponseLogItem,
  ReviewSentiment,
} from '@/lib/types';

function signSessionId(sessionId: string): string {
  const secret = process.env.RMQR_SESSION_SECRET || 'rmqr-review-session-signing-key-v1';
  return crypto.createHmac('sha256', secret).update(sessionId).digest('hex').slice(0, 32);
}

function verifySessionToken(sessionId: string, token: string): boolean {
  if (!sessionId || !token) return false;
  const expected = signSessionId(sessionId);
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

function getGbpIntegrationStatus() {
  const hasClientCredentials = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const configured = Boolean(
    hasClientCredentials && process.env.GOOGLE_GBP_REFRESH_TOKEN
  );
  return {
    configured,
    hasClientCredentials,
    mode: configured ? ('connected' as const) : ('manual_entry' as const),
    statusMessage: configured
      ? 'Google Business Profile OAuth API is authorized. Live review sync and approved reply publishing are available.'
      : 'Google Business Profile OAuth API is not connected in this environment (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / OAuth token not configured). Manual review entry is active—paste any customer review below to generate personalized English, Hindi, or Marathi reply options, approve your chosen reply, and copy it to post on Google.',
  };
}

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id);

    const campaigns = db.reviewCampaigns.filter(
      (r) => r.organizationId === session.activeOrg.id
    );
    const reviewResponseLogs = (db.reviewResponseLogs || []).filter(
      (item) => item.organizationId === session.activeOrg.id
    );
    const activeSessions = (db.customerReviewSessions || []).filter(
      (s) => s.organizationId === session.activeOrg.id
    );

    return NextResponse.json({
      reviewCampaigns: campaigns,
      reviewResponseLogs,
      gbpIntegration: getGbpIntegrationStatus(),
      aiProviderStatus: getAIProviderStatus(),
      deploymentInfo: inspectPublicDeploymentOrigin(undefined, 'rm-solution'),
      reviewSessionsCount: activeSessions.length,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load review campaigns.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientIp =
      (req.headers.get('x-forwarded-for') || '127.0.0.1').split(',')[0].trim() || '127.0.0.1';

    // Public action 1: Generate optional review draft suggestions for a customer on /review/[slug]
    if (body.action === 'customer_suggestions') {
      const suggestions = generateCustomerReviewSuggestions({
        businessName: String(body.businessName || 'this business'),
        selectedHighlights: Array.isArray(body.selectedHighlights) ? body.selectedHighlights : [],
        rating: Number(body.rating || 5),
      });
      return NextResponse.json({ suggestions });
    }

    // Public action 1B: Start a signed, privacy-safe customer AI Review Agent session
    if (body.action === 'start_review_session') {
      const rateCheck = checkRateLimit(`review_start_${clientIp}`, 30, 60_000);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      const slugInput = String(body.slug || 'rm-solution').trim();
      const lang: ReviewReplyLanguage =
        body.language === 'hi' || body.language === 'mr' ? body.language : 'en';

      const db = readDb();
      const campaign = findReviewCampaignBySlug(db, slugInput);
      if (!campaign || campaign.status !== 'active' || campaign.reviewAgentEnabled === false) {
        return NextResponse.json(
          { error: 'This review session is currently unavailable.' },
          { status: 404 }
        );
      }

      const sessionId = crypto.randomUUID();
      const sessionToken = signSessionId(sessionId);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      mutateDb((state) => {
        pruneExpiredReviewSessions(state);
        const newSession: CustomerReviewSession = {
          id: sessionId,
          sessionToken,
          organizationId: campaign.organizationId,
          campaignId: campaign.id,
          slug: campaign.slug,
          language: lang,
          draftOptions: [],
          regenerationCount: 0,
          status: 'in_progress',
          googleReviewSubmitted: false,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          expiresAt,
        };
        state.customerReviewSessions.unshift(newSession);
      });

      const aiStatus = getAIProviderStatus();
      return NextResponse.json(
        {
          sessionId,
          sessionToken,
          language: lang,
          aiStatus: {
            configured: aiStatus.configured,
            provider: aiStatus.provider,
          },
        },
        { status: 201 }
      );
    }

    // Public action 1C: Generate 3 honest, non-hallucinating review draft options for the customer
    if (body.action === 'generate_agent_review_drafts') {
      const rateCheck = checkRateLimit(`review_draft_${clientIp}`, 20, 60_000);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            error:
              'Rate limit reached for review draft generation. You can still edit or write your review manually below.',
          },
          { status: 429 }
        );
      }

      const sessionId = String(body.sessionId || '').trim();
      const sessionToken = String(body.sessionToken || '').trim();
      const slugInput = String(body.slug || 'rm-solution').trim();

      const db = readDb();
      const campaign = findReviewCampaignBySlug(db, slugInput);
      if (!campaign || campaign.status !== 'active' || campaign.reviewAgentEnabled === false) {
        return NextResponse.json(
          { error: 'Review assistant is currently offline.' },
          { status: 404 }
        );
      }

      let existingSession: CustomerReviewSession | undefined;
      if (sessionId) {
        if (!verifySessionToken(sessionId, sessionToken)) {
          return NextResponse.json(
            { error: 'Invalid or expired review session token.' },
            { status: 403 }
          );
        }
        existingSession = (db.customerReviewSessions || []).find((s) => s.id === sessionId);
        if (existingSession && existingSession.regenerationCount >= 4) {
          return NextResponse.json(
            {
              error:
                'Maximum regeneration limit (4) reached for this session. You can freely edit any of the drafts below.',
            },
            { status: 429 }
          );
        }
      }

      const lang: ReviewReplyLanguage =
        body.language === 'hi' || body.language === 'mr'
          ? body.language
          : campaign.defaultLanguage || 'en';
      const expLevel: ExperienceLevel =
        body.experienceLevel === 'excellent' ||
        body.experienceLevel === 'good' ||
        body.experienceLevel === 'average' ||
        body.experienceLevel === 'needs_improvement'
          ? body.experienceLevel
          : 'good';

      const starRating =
        body.starRating !== null && body.starRating !== undefined
          ? Number(body.starRating)
          : null;

      const variationIndex = existingSession ? existingSession.regenerationCount : 0;

      const draftResult = await generateCustomerReviewAgentDrafts({
        businessName: campaign.businessName || 'RM Solution',
        language: lang,
        experienceLevel: expLevel,
        starRating,
        feedbackDetails: String(body.feedbackDetails || ''),
        selectedTopics: Array.isArray(body.selectedTopics) ? body.selectedTopics : [],
        additionalFeedback: String(body.additionalFeedback || ''),
        variationIndex,
      });

      if (draftResult.blockedBySafety) {
        return NextResponse.json(
          {
            error:
              draftResult.safetyError ||
              'Input contained restricted instructions. Please describe only your genuine customer experience.',
            blockedBySafety: true,
          },
          { status: 400 }
        );
      }

      if (sessionId && existingSession) {
        mutateDb((state) => {
          const target = (state.customerReviewSessions || []).find((s) => s.id === sessionId);
          if (target) {
            target.language = lang;
            target.experienceLevel = expLevel;
            target.starRating = starRating;
            target.feedbackDetails = sanitizeText(body.feedbackDetails, 600);
            target.selectedTopics = Array.isArray(body.selectedTopics)
              ? body.selectedTopics.map((t: string) => sanitizeText(t, 50)).filter(Boolean)
              : [];
            target.additionalFeedback = sanitizeText(body.additionalFeedback, 400);
            target.draftOptions = draftResult.draftOptions;
            target.selectedDraft = draftResult.draftOptions[0]?.text || '';
            target.aiProviderUsed = draftResult.provider;
            target.regenerationCount = (target.regenerationCount || 0) + 1;
            target.status = 'drafts_ready';
            target.googleReviewSubmitted = false;
            target.updatedAt = new Date().toISOString();
          }
        });
      }

      return NextResponse.json(draftResult);
    }

    // Public action 1D: Update customer review session state (copy / select draft / finish)
    if (body.action === 'update_review_session') {
      const sessionId = String(body.sessionId || '').trim();
      const sessionToken = String(body.sessionToken || '').trim();
      if (!sessionId || !verifySessionToken(sessionId, sessionToken)) {
        return NextResponse.json(
          { error: 'Invalid or unauthorized session token.' },
          { status: 403 }
        );
      }

      mutateDb((state) => {
        const target = (state.customerReviewSessions || []).find((s) => s.id === sessionId);
        if (!target) return;
        if (body.selectedDraft !== undefined) {
          target.selectedDraft = sanitizeText(body.selectedDraft, 1200);
        }
        if (
          body.status === 'copied' ||
          body.status === 'google_opened' ||
          body.status === 'completed'
        ) {
          target.status = body.status;
        }
        // Submission always happens manually on Google's site outside RMQR's control
        target.googleReviewSubmitted = false;
        target.updatedAt = new Date().toISOString();
      });

      return NextResponse.json({ ok: true, googleReviewSubmitted: false });
    }

    // Public action 2: Record when a customer clicks "Continue to Google Reviews" on /review/[slug]
    if (body.action === 'track_google_click') {
      const campaignId = String(body.campaignId || '');
      mutateDb((db) => {
        const rc = db.reviewCampaigns.find((r) => r.id === campaignId);
        if (rc) rc.googleClickCount = (rc.googleClickCount || 0) + 1;
      });
      return NextResponse.json({ ok: true });
    }

    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Owner action 3: Generate AI-assisted multilingual reply options to a customer review (never auto-published)
    if (body.action === 'generate_owner_reply') {
      const db = readDb();
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);

      const rmCampaign = db.reviewCampaigns.find(
        (r) =>
          r.organizationId === session.activeOrg.id &&
          (r.slug === 'rm-solution-reviews' || r.businessName.toLowerCase() === 'rm solution')
      );
      const defaultPhone = rmCampaign?.contactPhone || '7400342769';

      const result = generateOwnerReviewReplyDraft({
        businessName: String(body.businessName || rmCampaign?.businessName || 'RM Solution'),
        reviewerName: String(body.reviewerName || ''),
        rating: body.rating !== undefined ? Number(body.rating) : undefined,
        reviewText: String(body.reviewText || ''),
        tone: (body.tone as ReviewReplyTone) || 'warm',
        language: (body.language as ReviewReplyLanguage) || 'en',
        sentiment: (body.sentiment as ReviewSentiment | 'auto') || 'auto',
        contactPhone: String(body.contactPhone || defaultPhone),
        includeContactPhone: body.includeContactPhone || 'auto',
      });
      return NextResponse.json(result);
    }

    // Owner action 4: Save or approve a generated/edited review response in the Review Management Dashboard
    if (body.action === 'save_review_response') {
      const reviewText = sanitizeText(body.reviewText, 2000);
      const selectedReply = sanitizeText(body.selectedReply, 2000);
      if (!reviewText || !selectedReply) {
        return NextResponse.json(
          { error: 'Both the customer review text and selected reply are required.' },
          { status: 400 }
        );
      }

      const approvalStatus: 'draft' | 'approved' =
        body.approvalStatus === 'approved' && body.humanApproved === true ? 'approved' : 'draft';

      if (body.approvalStatus === 'approved' && body.humanApproved !== true) {
        return NextResponse.json(
          { error: 'Explicit owner approval is required before marking a reply as Approved.' },
          { status: 400 }
        );
      }

      const saved = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
        const now = new Date().toISOString();
        const item: ReviewResponseLogItem = {
          id: crypto.randomUUID(),
          organizationId: session.activeOrg.id,
          campaignId: body.campaignId ? String(body.campaignId) : null,
          businessName: sanitizeText(body.businessName || 'RM Solution', 80) || 'RM Solution',
          reviewerName: sanitizeText(body.reviewerName || 'Valued Customer', 60) || 'Valued Customer',
          rating: Math.min(5, Math.max(1, Math.round(Number(body.rating || 5)))),
          reviewText,
          sentiment:
            body.sentiment === 'positive' ||
            body.sentiment === 'neutral' ||
            body.sentiment === 'negative'
              ? body.sentiment
              : 'positive',
          language:
            body.language === 'hi' || body.language === 'mr' ? body.language : 'en',
          tone:
            body.tone === 'professional' ||
            body.tone === 'apologetic' ||
            body.tone === 'concise'
              ? body.tone
              : 'warm',
          replyOptions: Array.isArray(body.replyOptions)
            ? body.replyOptions.map((o: string) => sanitizeText(o, 2000)).filter(Boolean)
            : [selectedReply],
          selectedReply,
          includeContactPhone: Boolean(body.includeContactPhone),
          contactPhoneUsed: body.includeContactPhone
            ? sanitizeText(body.contactPhoneUsed || '7400342769', 24)
            : undefined,
          approvalStatus,
          approvedAt: approvalStatus === 'approved' ? now : null,
          approvedBy: approvalStatus === 'approved' ? session.user.email : null,
          gbpPublished: false, // Never pretend a reply was published live without authorized GBP API call
          createdAt: now,
          updatedAt: now,
        };

        db.reviewResponseLogs.unshift(item);

        appendAuditLog(db, {
          organizationId: session.activeOrg.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action:
            approvalStatus === 'approved'
              ? 'review_response.approved'
              : 'review_response.draft_saved',
          entityType: 'review_response',
          entityId: item.id,
          metadata: {
            businessName: item.businessName,
            sentiment: item.sentiment,
            language: item.language,
            approvalStatus,
          },
        });

        return item;
      });

      return NextResponse.json({ reviewResponse: saved }, { status: 201 });
    }

    // Owner action 5: Save dedicated RM Solution Google Review settings (URL, phone, agent status & default language)
    if (body.action === 'save_rm_solution_settings') {
      const rawUrl = String(
        body.googleReviewUrl || 'https://g.page/r/CdT-R2IpVtpnEBM/review'
      ).trim();
      const urlCheck = validateSafeRedirectUrl(rawUrl);
      if (!urlCheck.valid || !urlCheck.sanitizedUrl) {
        return NextResponse.json(
          { error: urlCheck.reason || 'Invalid Google Review URL.' },
          { status: 400 }
        );
      }
      const contactPhone = sanitizeText(body.contactPhone || '7400342769', 24) || '7400342769';
      const businessName = sanitizeText(body.businessName || 'RM Solution', 80) || 'RM Solution';
      const defaultLanguage: ReviewReplyLanguage =
        body.defaultLanguage === 'hi' || body.defaultLanguage === 'mr'
          ? body.defaultLanguage
          : 'en';
      const reviewAgentEnabled =
        body.reviewAgentEnabled !== undefined ? Boolean(body.reviewAgentEnabled) : undefined;

      const updatedCampaign = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
        const now = new Date().toISOString();
        let rmCampaign = db.reviewCampaigns.find(
          (r) =>
            r.organizationId === session.activeOrg.id &&
            (r.slug === 'rm-solution-reviews' ||
              r.slug === 'rm-solution' ||
              r.businessName.toLowerCase() === 'rm solution')
        );

        if (rmCampaign) {
          rmCampaign.businessName = businessName;
          rmCampaign.googleReviewUrl = urlCheck.sanitizedUrl!;
          rmCampaign.contactPhone = contactPhone;
          if (body.defaultLanguage !== undefined) {
            rmCampaign.defaultLanguage = defaultLanguage;
          }
          if (reviewAgentEnabled !== undefined) {
            rmCampaign.reviewAgentEnabled = reviewAgentEnabled;
          }
          if (!Array.isArray(rmCampaign.supportedLanguages)) {
            rmCampaign.supportedLanguages = ['en', 'hi', 'mr'];
          }
          rmCampaign.updatedAt = now;
        } else {
          rmCampaign = {
            id: crypto.randomUUID(),
            organizationId: session.activeOrg.id,
            businessProfileId: null,
            qrCodeId: '00000000-0000-4000-8000-000000000076',
            slug: 'rm-solution-reviews',
            name: `${businessName} — Google Review AI Assistant`,
            businessName,
            googleReviewUrl: urlCheck.sanitizedUrl!,
            contactPhone,
            headline: `How was your experience with ${businessName}?`,
            subheadline: 'Share your honest review on Google. Your feedback helps us serve you better.',
            ctaText: 'Continue to Google Reviews',
            brandColor: '#7C3AED',
            suggestedHighlights: ['Helpful Guidance', 'Quick Service', 'Polite Support', 'Reliable Assistance'],
            aiDraftsEnabled: true,
            reviewAgentEnabled: reviewAgentEnabled ?? true,
            defaultLanguage,
            supportedLanguages: ['en', 'hi', 'mr'],
            scanCount: 0,
            googleClickCount: 0,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };
          db.reviewCampaigns.unshift(rmCampaign);
        }

        // Sync linked QR code in db.qrCodes so scanning it always opens the public HTTPS Google Review URL
        const linkedQr = db.qrCodes.find(
          (q) =>
            q.id === rmCampaign?.qrCodeId ||
            q.id === '00000000-0000-4000-8000-000000000076' ||
            q.slug === 'rm-solution-google-review'
        );
        if (linkedQr) {
          linkedQr.encodedContent = urlCheck.sanitizedUrl!;
          linkedQr.destinationUrl = urlCheck.sanitizedUrl!;
          linkedQr.updatedAt = now;
        }

        appendAuditLog(db, {
          organizationId: session.activeOrg.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'review_settings.rm_solution_updated',
          entityType: 'review_campaign',
          entityId: rmCampaign.id,
          metadata: {
            googleReviewUrl: rmCampaign.googleReviewUrl,
            contactPhone,
            reviewAgentEnabled: rmCampaign.reviewAgentEnabled,
            defaultLanguage: rmCampaign.defaultLanguage,
          },
        });

        return rmCampaign;
      });

      return NextResponse.json({ reviewCampaign: updatedCampaign });
    }

    // Owner action 5B: Verify Mode A (AI Agent Website QR) & Mode B (Direct Google Review QR) via jsQR decode
    if (body.action === 'verify_qr_destinations') {
      const db = readDb();
      assertOrgAccess(db, session.user.id, session.activeOrg.id);

      const rmCampaign = findReviewCampaignBySlug(db, 'rm-solution');
      const expectedGoogleUrl =
        rmCampaign?.googleReviewUrl || 'https://g.page/r/CdT-R2IpVtpnEBM/review';

      // Verify Mode B (Direct Google Review QR) PNG & SVG via jsQR
      const modeBPngBuf = await generateQRPngBuffer(expectedGoogleUrl, DEFAULT_QR_STYLE, 480);
      const modeBPngParsed = PNG.sync.read(modeBPngBuf);
      const modeBPngDecoded = jsQR(
        new Uint8ClampedArray(modeBPngParsed.data),
        modeBPngParsed.width,
        modeBPngParsed.height
      );

      const modeBSvgMarkup = generateCustomQRSvg(expectedGoogleUrl, DEFAULT_QR_STYLE, 480);
      const modeBSvgBitmap = rasterizeQRSvgToBitmap(modeBSvgMarkup);
      const modeBSvgDecoded = jsQR(
        modeBSvgBitmap.data,
        modeBSvgBitmap.width,
        modeBSvgBitmap.height
      );

      const modeBVerified =
        modeBPngDecoded?.data === expectedGoogleUrl &&
        modeBSvgDecoded?.data === expectedGoogleUrl &&
        !expectedGoogleUrl.includes('localhost');

      // Inspect Mode A (Public AI Review Agent Website QR)
      const explicitOrigin =
        typeof body.explicitOrigin === 'string' && body.explicitOrigin.trim()
          ? body.explicitOrigin.trim()
          : undefined;
      const deploymentInfo = inspectPublicDeploymentOrigin(explicitOrigin, 'rm-solution');

      let modeAVerified = false;
      let modeAPngDecodedUrl: string | null = null;
      let modeASvgDecodedUrl: string | null = null;

      if (deploymentInfo.isPublicHttps && deploymentInfo.publicAgentUrl) {
        const modeAPngBuf = await generateQRPngBuffer(
          deploymentInfo.publicAgentUrl,
          DEFAULT_QR_STYLE,
          480
        );
        const modeAPngParsed = PNG.sync.read(modeAPngBuf);
        const modeAPngDecoded = jsQR(
          new Uint8ClampedArray(modeAPngParsed.data),
          modeAPngParsed.width,
          modeAPngParsed.height
        );
        modeAPngDecodedUrl = modeAPngDecoded?.data || null;

        const modeASvgMarkup = generateCustomQRSvg(
          deploymentInfo.publicAgentUrl,
          DEFAULT_QR_STYLE,
          480
        );
        const modeASvgBitmap = rasterizeQRSvgToBitmap(modeASvgMarkup);
        const modeASvgDecoded = jsQR(
          modeASvgBitmap.data,
          modeASvgBitmap.width,
          modeASvgBitmap.height
        );
        modeASvgDecodedUrl = modeASvgDecoded?.data || null;

        modeAVerified =
          modeAPngDecodedUrl === deploymentInfo.publicAgentUrl &&
          modeASvgDecodedUrl === deploymentInfo.publicAgentUrl &&
          !deploymentInfo.publicAgentUrl.includes('localhost');
      }

      return NextResponse.json({
        modeB: {
          label: 'Mode B — Direct Google Review QR',
          expectedUrl: expectedGoogleUrl,
          pngDecodedUrl: modeBPngDecoded?.data || null,
          svgDecodedUrl: modeBSvgDecoded?.data || null,
          pdfNote:
            'PDF export embeds the verified 1200x1200 PNG stream directly into an A4 standee sheet.',
          verified: modeBVerified,
          mobileDataReady: modeBVerified,
        },
        modeA: {
          label: 'Mode A — AI Agent Website QR',
          deploymentStatus: deploymentInfo.deploymentStatus,
          deploymentLabel: deploymentInfo.deploymentLabel,
          isPublicHttps: deploymentInfo.isPublicHttps,
          expectedPublicUrl: deploymentInfo.publicAgentUrl,
          localTestUrl: deploymentInfo.localTestUrl,
          pngDecodedUrl: modeAPngDecodedUrl,
          svgDecodedUrl: modeASvgDecodedUrl,
          verified: modeAVerified,
          reason: deploymentInfo.reason,
        },
      });
    }

    // Owner action 6: Honest Google Business Profile API Fetch check (never fabricates fetched reviews)
    if (body.action === 'fetch_google_reviews') {
      const db = readDb();
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      const gbp = getGbpIntegrationStatus();
      if (!gbp.configured) {
        return NextResponse.json(
          {
            error:
              'Official Google Business Profile API OAuth is not configured in this environment. No reviews were fetched. Please paste customer reviews manually below.',
            gbpFetched: false,
            gbpIntegration: gbp,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ gbpFetched: false, reviews: [], gbpIntegration: gbp });
    }

    // Owner action 7: Honest Google Business Profile API Publish check (requires human approval + live OAuth)
    if (body.action === 'publish_to_google') {
      const db = readDb();
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      if (body.humanApproved !== true) {
        return NextResponse.json(
          { error: 'Explicit owner approval is required before publishing any review reply.' },
          { status: 400 }
        );
      }
      const gbp = getGbpIntegrationStatus();
      if (!gbp.configured) {
        return NextResponse.json(
          {
            error:
              'Google Business Profile OAuth API is not connected. Reply was NOT published automatically to Google—please click "Copy Reply" and paste it on your Google Business Profile.',
            gbpPublished: false,
            gbpIntegration: gbp,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ gbpPublished: false, gbpIntegration: gbp });
    }

    // Default Action: Create a new Google Review Growth Campaign + Linked QR
    const name = sanitizeText(body.name, 80);
    const businessName = sanitizeText(body.businessName || session.activeOrg.name, 80);
    const rawGoogleUrl = String(body.googleReviewUrl || '').trim();
    const contactPhone = body.contactPhone ? sanitizeText(body.contactPhone, 24) : undefined;

    if (!name || !rawGoogleUrl) {
      return NextResponse.json(
        { error: 'Campaign name and legitimate Google Review URL are required.' },
        { status: 400 }
      );
    }

    const urlCheck = validateSafeRedirectUrl(rawGoogleUrl);
    if (!urlCheck.valid || !urlCheck.sanitizedUrl) {
      return NextResponse.json(
        { error: urlCheck.reason || 'Invalid Google Review URL.' },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const isLocalhostOrigin =
      origin.includes('localhost') || origin.includes('127.0.0.1');

    const created = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      assertPlanEntitlement(db, session.activeOrg.id, 'reviewCampaigns');

      let slug = body.slug ? sanitizeSlug(body.slug) : generateShortSlug(businessName);
      if (!slug) slug = generateShortSlug('reviews');
      if (db.reviewCampaigns.some((r) => r.slug.toLowerCase() === slug.toLowerCase())) {
        slug = generateShortSlug(slug);
      }

      const now = new Date().toISOString();
      const reviewId = crypto.randomUUID();
      const qrId = crypto.randomUUID();
      const qrSlug = generateShortSlug(`rev-${slug}`);

      // When running on localhost without a public production domain, encode the direct public HTTPS Google Review URL
      // so the QR code works on any phone over mobile data.
      db.qrCodes.unshift({
        id: qrId,
        organizationId: session.activeOrg.id,
        folderId: null,
        campaignId: null,
        name: `${businessName} — Google Review QR`,
        description: `Google Review QR code for ${businessName} (${urlCheck.sanitizedUrl})`,
        slug: qrSlug,
        qrType: isLocalhostOrigin ? 'static' : 'dynamic',
        contentType: 'google_review',
        status: 'active',
        encodedContent: isLocalhostOrigin
          ? urlCheck.sanitizedUrl!
          : `${origin}/r/${qrSlug}`,
        destinationUrl: isLocalhostOrigin
          ? urlCheck.sanitizedUrl!
          : `/review/${slug}`,
        routingRules: [],
        styleConfig: {
          ...DEFAULT_QR_STYLE,
          frameStyle: 'banner_bottom',
          frameText: 'REVIEW US ON GOOGLE',
          frameColor: '#7C3AED',
        },
        tags: ['google-reviews', 'reputation'],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      const newCampaign: ReviewCampaign = {
        id: reviewId,
        organizationId: session.activeOrg.id,
        businessProfileId: null,
        qrCodeId: qrId,
        slug,
        name,
        businessName,
        googleReviewUrl: urlCheck.sanitizedUrl!,
        contactPhone,
        headline: sanitizeText(
          body.headline || `How was your experience with ${businessName}?`,
          120
        ),
        subheadline: sanitizeText(
          body.subheadline || 'Your honest review on Google helps others discover us.',
          220
        ),
        ctaText: sanitizeText(body.ctaText || 'Continue to Google Reviews', 60),
        brandColor: sanitizeText(body.brandColor || '#7C3AED', 16),
        suggestedHighlights: Array.isArray(body.suggestedHighlights)
          ? body.suggestedHighlights.map((h: string) => sanitizeText(h, 40)).filter(Boolean)
          : ['Friendly Team', 'Great Quality', 'Fast Service', 'Good Value'],
        aiDraftsEnabled: body.aiDraftsEnabled !== false,
        scanCount: 0,
        googleClickCount: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      db.reviewCampaigns.unshift(newCampaign);

      appendAuditLog(db, {
        organizationId: session.activeOrg.id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'review_campaign.created',
        entityType: 'review_campaign',
        entityId: reviewId,
        metadata: { name, slug },
      });

      return newCampaign;
    });

    return NextResponse.json({ reviewCampaign: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Review operation failed.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Update or approve an existing saved review response log item
    if (body.action === 'update_review_response') {
      const responseId = String(body.responseId || body.id || '');
      const updatedItem = mutateDb((db) => {
        const item = (db.reviewResponseLogs || []).find((r) => r.id === responseId);
        if (!item) throw new AuthorizationError('Review response item not found.', 404);
        assertOrgAccess(db, session.user.id, item.organizationId, ['owner', 'admin', 'editor']);

        if (body.selectedReply !== undefined) {
          item.selectedReply = sanitizeText(body.selectedReply, 2000);
        }
        if (
          body.sentiment === 'positive' ||
          body.sentiment === 'neutral' ||
          body.sentiment === 'negative'
        ) {
          item.sentiment = body.sentiment;
        }
        if (body.approvalStatus === 'approved') {
          if (body.humanApproved !== true) {
            throw new AuthorizationError(
              'Explicit owner approval is required before marking a reply as Approved.',
              400
            );
          }
          item.approvalStatus = 'approved';
          item.approvedAt = new Date().toISOString();
          item.approvedBy = session.user.email;
        } else if (body.approvalStatus === 'draft') {
          item.approvalStatus = 'draft';
          item.approvedAt = null;
          item.approvedBy = null;
        }

        item.updatedAt = new Date().toISOString();
        return item;
      });

      return NextResponse.json({ reviewResponse: updatedItem });
    }

    const id = String(body.id || '');

    const updated = mutateDb((db) => {
      const rc = db.reviewCampaigns.find((r) => r.id === id);
      if (!rc) throw new AuthorizationError('Review campaign not found.', 404);
      assertOrgAccess(db, session.user.id, rc.organizationId, ['owner', 'admin', 'editor']);

      if (body.name !== undefined) rc.name = sanitizeText(body.name, 80);
      if (body.businessName !== undefined) rc.businessName = sanitizeText(body.businessName, 80);
      if (body.contactPhone !== undefined) rc.contactPhone = sanitizeText(body.contactPhone, 24);
      if (body.googleReviewUrl !== undefined) {
        const check = validateSafeRedirectUrl(body.googleReviewUrl);
        if (!check.valid || !check.sanitizedUrl) {
          throw new AuthorizationError(check.reason || 'Invalid Google Review URL.', 400);
        }
        rc.googleReviewUrl = check.sanitizedUrl;
      }
      if (body.headline !== undefined) rc.headline = sanitizeText(body.headline, 120);
      if (body.subheadline !== undefined) rc.subheadline = sanitizeText(body.subheadline, 220);
      if (body.ctaText !== undefined) rc.ctaText = sanitizeText(body.ctaText, 60);
      if (body.brandColor !== undefined) rc.brandColor = sanitizeText(body.brandColor, 16);
      if (body.aiDraftsEnabled !== undefined) rc.aiDraftsEnabled = Boolean(body.aiDraftsEnabled);
      if (body.status === 'active' || body.status === 'paused') rc.status = body.status;
      if (Array.isArray(body.suggestedHighlights)) {
        rc.suggestedHighlights = body.suggestedHighlights
          .map((h: string) => sanitizeText(h, 40))
          .filter(Boolean);
      }

      rc.updatedAt = new Date().toISOString();
      return rc;
    });

    return NextResponse.json({ reviewCampaign: updated });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update review campaign.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const responseId = searchParams.get('responseId') || '';
    if (!responseId) {
      return NextResponse.json({ error: 'responseId query parameter is required.' }, { status: 400 });
    }

    mutateDb((db) => {
      const idx = (db.reviewResponseLogs || []).findIndex((r) => r.id === responseId);
      if (idx === -1) throw new AuthorizationError('Review response item not found.', 404);
      const target = db.reviewResponseLogs[idx];
      assertOrgAccess(db, session.user.id, target.organizationId, ['owner', 'admin', 'editor']);
      db.reviewResponseLogs.splice(idx, 1);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete review response item.' }, { status: 500 });
  }
}
