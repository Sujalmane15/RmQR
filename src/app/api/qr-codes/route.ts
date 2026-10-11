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
  hashPassword,
  sanitizeSlug,
  sanitizeText,
  validateSafeRedirectUrl,
} from '@/lib/security';
import { DEFAULT_QR_STYLE, QRCodeRecord, QRContentType, QRType } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedOrgId = searchParams.get('organizationId') || session.activeOrg.id;
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const statusFilter = searchParams.get('status') || 'all';
    const typeFilter = searchParams.get('qrType') || 'all';
    const folderId = searchParams.get('folderId') || 'all';
    const campaignId = searchParams.get('campaignId') || 'all';

    const db = readDb();
    assertOrgAccess(db, session.user.id, requestedOrgId, ['owner', 'admin', 'editor', 'viewer']);

    let list = db.qrCodes.filter((q) => q.organizationId === requestedOrgId);

    if (statusFilter !== 'all') {
      list = list.filter((q) => q.status === statusFilter);
    } else {
      list = list.filter((q) => q.status !== 'archived');
    }

    if (typeFilter !== 'all') {
      list = list.filter((q) => q.qrType === typeFilter);
    }
    if (folderId !== 'all') {
      list = list.filter((q) => q.folderId === folderId);
    }
    if (campaignId !== 'all') {
      list = list.filter((q) => q.campaignId === campaignId);
    }
    if (search) {
      list = list.filter(
        (q) =>
          q.name.toLowerCase().includes(search) ||
          q.slug.toLowerCase().includes(search) ||
          (q.destinationUrl || '').toLowerCase().includes(search) ||
          q.tags.some((t) => t.toLowerCase().includes(search))
      );
    }

    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      qrCodes: list,
      folders: db.qrFolders.filter((f) => f.organizationId === requestedOrgId),
      campaigns: db.campaigns.filter((c) => c.organizationId === requestedOrgId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load QR codes.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const targetOrgId = body.organizationId || session.activeOrg.id;

    const qrType: QRType = body.qrType === 'static' ? 'static' : 'dynamic';
    const contentType: QRContentType = body.contentType || 'url';
    const name = sanitizeText(body.name || 'Untitled QR Code', 100);
    const description = sanitizeText(body.description || '', 300);

    if (!name) {
      return NextResponse.json({ error: 'QR code name is required.' }, { status: 400 });
    }

    let destinationUrl: string | undefined;
    if (qrType === 'dynamic') {
      const rawDest = String(body.destinationUrl || body.encodedContent || '').trim();
      const validation = validateSafeRedirectUrl(rawDest);
      if (!validation.valid || !validation.sanitizedUrl) {
        return NextResponse.json(
          { error: validation.reason || 'Valid destination URL is required for Dynamic QR codes.' },
          { status: 400 }
        );
      }
      destinationUrl = validation.sanitizedUrl;
    }

    if (body.fallbackUrl) {
      const fbCheck = validateSafeRedirectUrl(body.fallbackUrl);
      if (!fbCheck.valid) {
        return NextResponse.json(
          { error: `Invalid fallback URL: ${fbCheck.reason}` },
          { status: 400 }
        );
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const created = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, targetOrgId, ['owner', 'admin', 'editor']);

      if (qrType === 'dynamic') {
        assertPlanEntitlement(db, targetOrgId, 'dynamicQrCodes');
      }

      let slug = body.slug ? sanitizeSlug(body.slug) : generateShortSlug(name);
      if (!slug) slug = generateShortSlug('qr');

      const slugExists = db.qrCodes.some((q) => q.slug.toLowerCase() === slug.toLowerCase());
      if (slugExists) {
        if (body.slug) {
          throw new AuthorizationError(
            `The short slug "${slug}" is already in use. Please choose another slug.`,
            409
          );
        }
        slug = generateShortSlug(slug);
      }

      const now = new Date().toISOString();
      const qrId = crypto.randomUUID();

      const encodedContent =
        qrType === 'dynamic'
          ? `${origin}/r/${slug}`
          : String(body.encodedContent || body.destinationUrl || 'https://rmqr.app').trim();

      const newQr: QRCodeRecord = {
        id: qrId,
        organizationId: targetOrgId,
        folderId: body.folderId || null,
        campaignId: body.campaignId || null,
        name,
        description,
        slug,
        qrType,
        contentType,
        status: 'active',
        encodedContent,
        destinationUrl: qrType === 'dynamic' ? destinationUrl : undefined,
        fallbackUrl: body.fallbackUrl ? String(body.fallbackUrl).trim() : undefined,
        expiresAt: body.expiresAt || null,
        passwordHash: body.password ? hashPassword(String(body.password)) : null,
        routingRules: Array.isArray(body.routingRules) ? body.routingRules : [],
        styleConfig: {
          ...DEFAULT_QR_STYLE,
          ...(body.styleConfig || {}),
        },
        tags: Array.isArray(body.tags)
          ? body.tags.map((t: string) => sanitizeText(t, 32)).filter(Boolean)
          : [],
        scanCount: 0,
        humanScanCount: 0,
        lastScannedAt: null,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      };

      db.qrCodes.unshift(newQr);

      if (qrType === 'dynamic' && destinationUrl) {
        db.qrDestinations.unshift({
          id: crypto.randomUUID(),
          qrCodeId: qrId,
          organizationId: targetOrgId,
          destinationUrl,
          isActive: true,
          weight: 100,
          deviceRule: 'all',
          createdBy: session.user.id,
          createdAt: now,
        });
      }

      appendAuditLog(db, {
        organizationId: targetOrgId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'qr_code.created',
        entityType: 'qr_code',
        entityId: qrId,
        metadata: { name, slug, qrType, contentType },
      });

      return newQr;
    });

    return NextResponse.json({ qrCode: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Create QR error:', err);
    return NextResponse.json({ error: 'Failed to create QR code.' }, { status: 500 });
  }
}
