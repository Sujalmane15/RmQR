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
import { DEFAULT_QR_STYLE, LandingPage, LandingPageBlock, LandingPageType } from '@/lib/types';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id);

    const pages = db.landingPages
      .filter((lp) => lp.organizationId === session.activeOrg.id)
      .map((lp) => ({
        ...lp,
        blocks: db.landingPageBlocks
          .filter((b) => b.landingPageId === lp.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));

    return NextResponse.json({ landingPages: pages });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load landing pages.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Public button click tracking on published landing pages (no auth required)
    if (body.action === 'track_click') {
      const landingPageId = String(body.landingPageId || '');
      const blockId = String(body.blockId || '');
      mutateDb((db) => {
        const lp = db.landingPages.find((p) => p.id === landingPageId && p.status === 'published');
        if (lp) lp.clickCount = (lp.clickCount || 0) + 1;
        if (blockId) {
          const blk = db.landingPageBlocks.find((b) => b.id === blockId);
          if (blk) blk.clickCount = (blk.clickCount || 0) + 1;
        }
      });
      return NextResponse.json({ ok: true });
    }

    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const title = sanitizeText(body.title, 100);
    if (!title) {
      return NextResponse.json({ error: 'Landing page title is required.' }, { status: 400 });
    }

    const pageType: LandingPageType = body.pageType || 'business_profile';
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const created = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      assertPlanEntitlement(db, session.activeOrg.id, 'landingPages');

      let slug = body.slug ? sanitizeSlug(body.slug) : generateShortSlug(title);
      if (!slug) slug = generateShortSlug('page');
      if (db.landingPages.some((p) => p.slug.toLowerCase() === slug.toLowerCase())) {
        slug = generateShortSlug(slug);
      }

      const now = new Date().toISOString();
      const pageId = crypto.randomUUID();
      const qrId = crypto.randomUUID();
      const qrSlug = generateShortSlug(`lp-${slug}`);

      // Automatically create a linked Dynamic QR code for this landing page
      db.qrCodes.unshift({
        id: qrId,
        organizationId: session.activeOrg.id,
        folderId: null,
        campaignId: null,
        name: `${title} (Landing Page QR)`,
        description: `Dynamic QR linked to landing page /p/${slug}`,
        slug: qrSlug,
        qrType: 'dynamic',
        contentType: 'landing_page',
        status: 'active',
        encodedContent: `${origin}/r/${qrSlug}`,
        destinationUrl: `/p/${slug}`,
        routingRules: [],
        styleConfig: { ...DEFAULT_QR_STYLE },
        tags: ['landing-page'],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      });

      const newPage: LandingPage = {
        id: pageId,
        organizationId: session.activeOrg.id,
        qrCodeId: qrId,
        slug,
        title,
        description: sanitizeText(body.description || '', 400),
        pageType,
        status: body.status === 'published' ? 'published' : 'draft',
        themeConfig: {
          primaryColor: sanitizeText(body.themeConfig?.primaryColor || '#7C3AED', 20),
          bgColor: sanitizeText(body.themeConfig?.bgColor || '#0B0F19', 20),
          textColor: sanitizeText(body.themeConfig?.textColor || '#FFFFFF', 20),
          logoUrl: body.themeConfig?.logoUrl
            ? sanitizeText(body.themeConfig.logoUrl, 200000)
            : undefined,
          coverUrl: body.themeConfig?.coverUrl
            ? sanitizeText(body.themeConfig.coverUrl, 200000)
            : undefined,
          buttonStyle: body.themeConfig?.buttonStyle || 'rounded',
        },
        socialLinks: Array.isArray(body.socialLinks) ? body.socialLinks : [],
        contactInfo: {
          phone: sanitizeText(body.contactInfo?.phone || '', 40),
          whatsapp: sanitizeText(body.contactInfo?.whatsapp || '', 40),
          email: sanitizeText(body.contactInfo?.email || '', 80),
          address: sanitizeText(body.contactInfo?.address || '', 200),
          website: sanitizeText(body.contactInfo?.website || '', 200),
          openingHours: sanitizeText(body.contactInfo?.openingHours || '', 120),
        },
        viewCount: 0,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      db.landingPages.unshift(newPage);

      const inputBlocks = Array.isArray(body.blocks) ? body.blocks : [];
      const createdBlocks: LandingPageBlock[] = inputBlocks.map((b: Record<string, unknown>, idx: number) => {
        const rawUrl = String(b.url || 'https://example.com').trim();
        const urlCheck = validateSafeRedirectUrl(rawUrl);
        return {
          id: crypto.randomUUID(),
          landingPageId: pageId,
          organizationId: session.activeOrg.id,
          blockType: (b.blockType as LandingPageBlock['blockType']) || 'button',
          title: sanitizeText(String(b.title || 'View Link'), 80),
          subtitle: sanitizeText(String(b.subtitle || ''), 120),
          url: urlCheck.valid && urlCheck.sanitizedUrl ? urlCheck.sanitizedUrl : 'https://example.com',
          icon: sanitizeText(String(b.icon || 'link'), 30),
          sortOrder: idx + 1,
          clickCount: 0,
          isEnabled: true,
        };
      });

      db.landingPageBlocks.push(...createdBlocks);

      appendAuditLog(db, {
        organizationId: session.activeOrg.id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'landing_page.created',
        entityType: 'landing_page',
        entityId: pageId,
        metadata: { title, slug, pageType },
      });

      return { ...newPage, blocks: createdBlocks };
    });

    return NextResponse.json({ landingPage: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to create landing page.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = String(body.id || '');

    const updated = mutateDb((db) => {
      const lp = db.landingPages.find((p) => p.id === id);
      if (!lp) throw new AuthorizationError('Landing page not found.', 404);
      assertOrgAccess(db, session.user.id, lp.organizationId, ['owner', 'admin', 'editor']);

      if (body.title !== undefined) {
        const cleanTitle = sanitizeText(body.title, 100);
        if (!cleanTitle) throw new AuthorizationError('Title cannot be empty.', 400);
        lp.title = cleanTitle;
      }
      if (body.description !== undefined) {
        lp.description = sanitizeText(body.description, 400);
      }
      if (body.status === 'draft' || body.status === 'published') {
        lp.status = body.status;
      }
      if (body.themeConfig) {
        lp.themeConfig = {
          ...lp.themeConfig,
          primaryColor: sanitizeText(body.themeConfig.primaryColor || lp.themeConfig.primaryColor, 20),
          bgColor: sanitizeText(body.themeConfig.bgColor || lp.themeConfig.bgColor, 20),
          textColor: sanitizeText(body.themeConfig.textColor || lp.themeConfig.textColor, 20),
          logoUrl: body.themeConfig.logoUrl !== undefined ? sanitizeText(body.themeConfig.logoUrl, 200000) : lp.themeConfig.logoUrl,
          buttonStyle: body.themeConfig.buttonStyle || lp.themeConfig.buttonStyle,
        };
      }
      if (body.contactInfo) {
        lp.contactInfo = {
          phone: sanitizeText(body.contactInfo.phone || '', 40),
          whatsapp: sanitizeText(body.contactInfo.whatsapp || '', 40),
          email: sanitizeText(body.contactInfo.email || '', 80),
          address: sanitizeText(body.contactInfo.address || '', 200),
          website: sanitizeText(body.contactInfo.website || '', 200),
          openingHours: sanitizeText(body.contactInfo.openingHours || '', 120),
        };
      }

      if (Array.isArray(body.blocks)) {
        db.landingPageBlocks = db.landingPageBlocks.filter((b) => b.landingPageId !== lp.id);
        const newBlocks: LandingPageBlock[] = body.blocks.map(
          (b: Record<string, unknown>, idx: number) => {
            const rawUrl = String(b.url || 'https://example.com').trim();
            const urlCheck = validateSafeRedirectUrl(rawUrl);
            return {
              id: (b.id as string) || crypto.randomUUID(),
              landingPageId: lp.id,
              organizationId: lp.organizationId,
              blockType: (b.blockType as LandingPageBlock['blockType']) || 'button',
              title: sanitizeText(String(b.title || 'Action'), 80),
              subtitle: sanitizeText(String(b.subtitle || ''), 120),
              url: urlCheck.valid && urlCheck.sanitizedUrl ? urlCheck.sanitizedUrl : 'https://example.com',
              icon: sanitizeText(String(b.icon || 'link'), 30),
              sortOrder: idx + 1,
              clickCount: Number(b.clickCount || 0),
              isEnabled: b.isEnabled !== false,
            };
          }
        );
        db.landingPageBlocks.push(...newBlocks);
      }

      lp.updatedAt = new Date().toISOString();

      appendAuditLog(db, {
        organizationId: lp.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'landing_page.updated',
        entityType: 'landing_page',
        entityId: lp.id,
        metadata: { status: lp.status, title: lp.title },
      });

      return {
        ...lp,
        blocks: db.landingPageBlocks
          .filter((b) => b.landingPageId === lp.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      };
    });

    return NextResponse.json({ landingPage: updated });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update landing page.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Landing page ID is required.' }, { status: 400 });

    mutateDb((db) => {
      const lp = db.landingPages.find((p) => p.id === id);
      if (!lp) throw new AuthorizationError('Landing page not found.', 404);
      assertOrgAccess(db, session.user.id, lp.organizationId, ['owner', 'admin', 'editor']);
      db.landingPages = db.landingPages.filter((p) => p.id !== id);
      db.landingPageBlocks = db.landingPageBlocks.filter((b) => b.landingPageId !== id);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete landing page.' }, { status: 500 });
  }
}
