import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  assertPlanEntitlement,
  AuthorizationError,
  mutateDb,
  readDb,
} from '@/lib/db/store';
import {
  generateShortSlug,
  sanitizeSlug,
  sanitizeText,
  validateSafeRedirectUrl,
} from '@/lib/security';
import {
  AIAgentCategory,
  AIAgentRecord,
  AIAgentTone,
  AIKnowledgeEntry,
  AIKnowledgeSection,
  DEFAULT_QR_STYLE,
} from '@/lib/types';
import { AI_AGENT_CATEGORY_META, getAIProviderStatus } from '@/lib/ai/agent-engine';

const VALID_CATEGORIES = new Set<AIAgentCategory>([
  'restaurant_cafe',
  'retail_shop',
  'salon_spa',
  'real_estate',
  'hotel_hospitality',
  'professional_services',
  'education_training',
  'general_business',
]);

const VALID_TONES = new Set<AIAgentTone>([
  'friendly_professional',
  'warm_hospitality',
  'concise_direct',
  'formal_executive',
]);

const VALID_SECTIONS = new Set<AIKnowledgeSection>([
  'about',
  'products_services',
  'pricing',
  'opening_hours',
  'faq',
  'policies',
  'contact',
  'menu_items',
  'custom_facts',
]);

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id, [
      'owner',
      'admin',
      'editor',
      'viewer',
    ]);

    const orgId = session.activeOrg.id;
    const agents = (db.aiAgents || [])
      .filter((a) => a.organizationId === orgId)
      .map((agent) => {
        const qrCode = db.qrCodes.find((q) => q.id === agent.qrCodeId) || null;
        const knowledgeEntries = (db.aiKnowledgeEntries || []).filter(
          (k) => k.agentId === agent.id && k.organizationId === orgId
        );
        const leads = (db.aiLeads || []).filter(
          (l) => l.agentId === agent.id && l.organizationId === orgId
        );
        return {
          ...agent,
          qrCode,
          knowledgeEntries,
          knowledgeCount: knowledgeEntries.length,
          leadCount: leads.length,
        };
      });

    const menus = db.menus
      .filter((m) => m.organizationId === orgId)
      .map((m) => ({ id: m.id, restaurantName: m.restaurantName, slug: m.slug }));

    const landingPages = db.landingPages
      .filter((lp) => lp.organizationId === orgId)
      .map((lp) => ({ id: lp.id, title: lp.title, slug: lp.slug }));

    return NextResponse.json({
      agents,
      menus,
      landingPages,
      aiProviderStatus: getAIProviderStatus(),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load AI agents.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const agentName = sanitizeText(body.agentName, 80);
    const businessName = sanitizeText(body.businessName, 80);

    if (!agentName || !businessName) {
      return NextResponse.json(
        { error: 'Agent name and business name are required.' },
        { status: 400 }
      );
    }

    const rawCategory = String(body.businessCategory || 'general_business') as AIAgentCategory;
    const businessCategory: AIAgentCategory = VALID_CATEGORIES.has(rawCategory)
      ? rawCategory
      : 'general_business';

    const catDefaults = AI_AGENT_CATEGORY_META[businessCategory];

    const rawTone = String(body.tone || 'friendly_professional') as AIAgentTone;
    const tone: AIAgentTone = VALID_TONES.has(rawTone) ? rawTone : 'friendly_professional';

    const responseLength = body.responseLength === 'detailed' ? 'detailed' : 'concise';

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const created = mutateDb((db) => {
      const orgId = session.activeOrg.id;
      assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin', 'editor']);
      assertPlanEntitlement(db, orgId, 'aiAgents');
      assertPlanEntitlement(db, orgId, 'dynamicQrCodes');

      let slug = body.slug ? sanitizeSlug(body.slug) : generateShortSlug(agentName);
      if (!slug) slug = generateShortSlug('agent');
      if (db.aiAgents.some((a) => a.slug.toLowerCase() === slug.toLowerCase())) {
        slug = generateShortSlug(slug);
      }

      let qrSlug = `ai-${slug}`.slice(0, 40);
      if (db.qrCodes.some((q) => q.slug.toLowerCase() === qrSlug.toLowerCase())) {
        qrSlug = generateShortSlug(`ai-${slug}`);
      }

      // Validate optional linkedMenuId and linkedLandingPageId belong to this organization
      let linkedMenuId: string | null = null;
      if (body.linkedMenuId) {
        const menuExists = db.menus.some(
          (m) => m.id === body.linkedMenuId && m.organizationId === orgId
        );
        if (menuExists) linkedMenuId = String(body.linkedMenuId);
      }

      let linkedLandingPageId: string | null = null;
      if (body.linkedLandingPageId) {
        const lpExists = db.landingPages.some(
          (lp) => lp.id === body.linkedLandingPageId && lp.organizationId === orgId
        );
        if (lpExists) linkedLandingPageId = String(body.linkedLandingPageId);
      }

      let websiteUrl = '';
      if (body.websiteUrl) {
        const check = validateSafeRedirectUrl(String(body.websiteUrl));
        if (check.valid && check.sanitizedUrl) {
          websiteUrl = check.sanitizedUrl;
        }
      }

      let humanContactUrl = '';
      if (body.humanContactUrl) {
        const check = validateSafeRedirectUrl(String(body.humanContactUrl));
        if (check.valid && check.sanitizedUrl) {
          humanContactUrl = check.sanitizedUrl;
        }
      }

      const now = new Date().toISOString();
      const agentId = crypto.randomUUID();
      const qrId = crypto.randomUUID();

      const brandColor =
        typeof body.brandColor === 'string' && /^#[0-9A-Fa-f]{3,6}$/.test(body.brandColor.trim())
          ? body.brandColor.trim()
          : '#7C3AED';

      // Create linked Dynamic QR code routing to /agent/[slug]
      const qrRecord = {
        id: qrId,
        organizationId: orgId,
        folderId: null,
        campaignId: null,
        name: sanitizeText(body.qrName || `${agentName} (AI Agent QR)`, 80),
        description: `Dynamic AI Agent QR routing to /agent/${slug}`,
        slug: qrSlug,
        qrType: 'dynamic' as const,
        contentType: 'ai_agent' as const,
        status: 'active' as const,
        encodedContent: `${origin}/r/${qrSlug}`,
        destinationUrl: `/agent/${slug}`,
        routingRules: [],
        styleConfig: {
          ...DEFAULT_QR_STYLE,
          fgColor: '#0B0F19',
          eyeColor: brandColor,
          pattern: 'rounded' as const,
          eyeStyle: 'rounded' as const,
          frameStyle: 'banner_bottom' as const,
          frameText: sanitizeText(body.frameText || 'CHAT WITH AI', 24),
          frameColor: brandColor,
        },
        tags: ['ai-agent', businessCategory],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };
      db.qrCodes.unshift(qrRecord);

      const suggestedQuestions = Array.isArray(body.suggestedQuestions)
        ? body.suggestedQuestions
            .map((q: unknown) => sanitizeText(String(q || ''), 120))
            .filter(Boolean)
            .slice(0, 6)
        : catDefaults.defaultQuestions;

      const supportedLanguages = Array.isArray(body.supportedLanguages)
        ? body.supportedLanguages
            .map((l: unknown) => sanitizeText(String(l || ''), 30))
            .filter(Boolean)
        : ['English'];

      const newAgent: AIAgentRecord = {
        id: agentId,
        organizationId: orgId,
        qrCodeId: qrId,
        slug,
        status: body.status === 'paused' || body.status === 'inactive' ? body.status : 'active',
        agentName,
        businessName,
        businessCategory,
        businessDescription: sanitizeText(body.businessDescription || '', 400),
        websiteUrl,
        phone: sanitizeText(body.phone || '', 40),
        address: sanitizeText(body.address || '', 200),
        defaultLanguage: sanitizeText(body.defaultLanguage || 'English', 30) || 'English',
        supportedLanguages: supportedLanguages.length > 0 ? supportedLanguages : ['English'],
        linkedMenuId,
        linkedLandingPageId,
        tone,
        responseLength,
        welcomeMessage:
          sanitizeText(body.welcomeMessage || '', 300) || catDefaults.defaultWelcome,
        suggestedQuestions:
          suggestedQuestions.length > 0 ? suggestedQuestions : catDefaults.defaultQuestions,
        customInstructions: sanitizeText(body.customInstructions || '', 500),
        fallbackUnknownMessage:
          sanitizeText(body.fallbackUnknownMessage || '', 300) ||
          `I do not have that specific detail in ${businessName}'s verified knowledge base right now. Please contact our team directly for assistance.`,
        leadCollectionEnabled: Boolean(body.leadCollectionEnabled),
        humanContactUrl,
        whatsappNumber: sanitizeText(body.whatsappNumber || '', 30).replace(/[^\d+]/g, ''),
        logoUrl: body.logoUrl ? sanitizeText(body.logoUrl, 200000) : undefined,
        brandColor,
        welcomeTitle:
          sanitizeText(body.welcomeTitle || '', 80) || `Ask ${businessName} AI Assistant`,
        chatbotDisplayName: sanitizeText(body.chatbotDisplayName || '', 50) || agentName,
        contactButtonLabel: sanitizeText(body.contactButtonLabel || 'Contact Team', 40),
        conversationCount: 0,
        messageCount: 0,
        leadCount: 0,
        knowledgeUpdatedAt: now,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };

      db.aiAgents.unshift(newAgent);

      const inputEntries = Array.isArray(body.knowledgeEntries) ? body.knowledgeEntries : [];
      const createdEntries: AIKnowledgeEntry[] = [];

      for (const rawEntry of inputEntries) {
        const title = sanitizeText(String(rawEntry?.title || ''), 100);
        const content = sanitizeText(String(rawEntry?.content || ''), 2500);
        if (!title || !content) continue;
        const rawSec = String(rawEntry?.section || 'custom_facts') as AIKnowledgeSection;
        const section: AIKnowledgeSection = VALID_SECTIONS.has(rawSec) ? rawSec : 'custom_facts';

        const entry: AIKnowledgeEntry = {
          id: crypto.randomUUID(),
          agentId,
          organizationId: orgId,
          section,
          title,
          content,
          createdAt: now,
          updatedAt: now,
        };
        db.aiKnowledgeEntries.push(entry);
        createdEntries.push(entry);
      }

      appendAuditLog(db, {
        organizationId: orgId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'ai_agent.created',
        entityType: 'ai_agent',
        entityId: agentId,
        metadata: { agentName, businessName, slug, qrSlug, businessCategory },
      });

      return {
        agent: newAgent,
        qrCode: qrRecord,
        knowledgeEntries: createdEntries,
      };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to create AI agent.' }, { status: 500 });
  }
}
