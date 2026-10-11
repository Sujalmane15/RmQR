import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  assertPlanEntitlement,
  AuthorizationError,
  mutateDbAsync,
  readDbAsync,
} from '@/lib/db/store';
import {
  generateShortSlug,
  hashPassword,
  sanitizeText,
  validateSafeRedirectUrl,
} from '@/lib/security';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const db = await readDbAsync();
    const qr = db.qrCodes.find((q) => q.id === id);
    if (!qr) {
      return NextResponse.json({ error: 'QR code not found.' }, { status: 404 });
    }

    // Enforce tenant isolation: user must belong to qr.organizationId
    assertOrgAccess(db, session.user.id, qr.organizationId, [
      'owner',
      'admin',
      'editor',
      'viewer',
    ]);

    const destinations = db.qrDestinations.filter((d) => d.qrCodeId === qr.id);
    const scanEvents = db.qrScanEvents
      .filter((e) => e.qrCodeId === qr.id)
      .slice(0, 100);

    return NextResponse.json({
      qrCode: qr,
      destinations,
      scanEvents,
      folders: db.qrFolders.filter((f) => f.organizationId === qr.organizationId),
      campaigns: db.campaigns.filter((c) => c.organizationId === qr.organizationId),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load QR code.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      `http://${req.headers.get('host') || 'localhost:3000'}`;

    const result = await mutateDbAsync((db) => {
      const qr = db.qrCodes.find((q) => q.id === id);
      if (!qr) {
        throw new AuthorizationError('QR code not found.', 404);
      }

      // Enforce strict tenant isolation & write role check
      assertOrgAccess(db, session.user.id, qr.organizationId, ['owner', 'admin', 'editor']);

      // Handle Duplicate Action
      if (body.action === 'duplicate') {
        if (qr.qrType === 'dynamic') {
          assertPlanEntitlement(db, qr.organizationId, 'dynamicQrCodes');
        }
        const now = new Date().toISOString();
        const newSlug = generateShortSlug(`${qr.slug}-copy`);
        const newId = crypto.randomUUID();
        const duplicated = {
          ...qr,
          id: newId,
          name: `${qr.name} (Copy)`,
          slug: newSlug,
          encodedContent:
            qr.qrType === 'dynamic' ? `${origin}/r/${newSlug}` : qr.encodedContent,
          scanCount: 0,
          humanScanCount: 0,
          lastScannedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        db.qrCodes.unshift(duplicated);
        appendAuditLog(db, {
          organizationId: qr.organizationId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'qr_code.duplicated',
          entityType: 'qr_code',
          entityId: newId,
          metadata: { sourceQrId: qr.id },
        });
        return duplicated;
      }

      if (body.name !== undefined) {
        const cleanName = sanitizeText(body.name, 100);
        if (!cleanName) {
          throw new AuthorizationError('QR code name cannot be empty.', 400);
        }
        qr.name = cleanName;
      }

      if (body.description !== undefined) {
        qr.description = sanitizeText(body.description, 300);
      }

      if (body.status !== undefined) {
        const allowedStatuses = ['active', 'paused', 'expired', 'archived'];
        if (!allowedStatuses.includes(body.status)) {
          throw new AuthorizationError('Invalid QR status.', 400);
        }
        qr.status = body.status;
      }

      // Editing destination on a Dynamic QR updates destinationUrl ONLY — never encodedContent!
      if (body.destinationUrl !== undefined) {
        if (qr.qrType === 'static') {
          throw new AuthorizationError(
            'Static QR code destinations are encoded directly in the image and cannot be edited after creation.',
            400
          );
        }
        const check = validateSafeRedirectUrl(body.destinationUrl);
        if (!check.valid || !check.sanitizedUrl) {
          throw new AuthorizationError(check.reason || 'Invalid destination URL.', 400);
        }
        const previousUrl = qr.destinationUrl;
        qr.destinationUrl = check.sanitizedUrl;

        if (previousUrl !== check.sanitizedUrl) {
          for (const d of db.qrDestinations) {
            if (d.qrCodeId === qr.id) d.isActive = false;
          }
          db.qrDestinations.unshift({
            id: crypto.randomUUID(),
            qrCodeId: qr.id,
            organizationId: qr.organizationId,
            destinationUrl: check.sanitizedUrl,
            isActive: true,
            weight: 100,
            deviceRule: 'all',
            createdBy: session.user.id,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (body.fallbackUrl !== undefined) {
        if (body.fallbackUrl === '' || body.fallbackUrl === null) {
          qr.fallbackUrl = undefined;
        } else {
          const fbCheck = validateSafeRedirectUrl(body.fallbackUrl);
          if (!fbCheck.valid || !fbCheck.sanitizedUrl) {
            throw new AuthorizationError(
              `Invalid fallback URL: ${fbCheck.reason}`,
              400
            );
          }
          qr.fallbackUrl = fbCheck.sanitizedUrl;
        }
      }

      if (body.expiresAt !== undefined) {
        qr.expiresAt = body.expiresAt || null;
      }

      if (body.password !== undefined) {
        qr.passwordHash = body.password ? hashPassword(String(body.password)) : null;
      }

      if (body.folderId !== undefined) {
        qr.folderId = body.folderId || null;
      }

      if (body.campaignId !== undefined) {
        qr.campaignId = body.campaignId || null;
      }

      if (Array.isArray(body.tags)) {
        qr.tags = body.tags.map((t: string) => sanitizeText(t, 32)).filter(Boolean);
      }

      if (Array.isArray(body.routingRules)) {
        qr.routingRules = body.routingRules;
      }

      if (body.styleConfig) {
        qr.styleConfig = {
          ...qr.styleConfig,
          ...body.styleConfig,
        };
      }

      qr.updatedAt = new Date().toISOString();

      appendAuditLog(db, {
        organizationId: qr.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'qr_code.updated',
        entityType: 'qr_code',
        entityId: qr.id,
        metadata: {
          status: qr.status,
          destinationUrl: qr.destinationUrl,
        },
      });

      return qr;
    });

    return NextResponse.json({ qrCode: result });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update QR code.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    await mutateDbAsync((db) => {
      const idx = db.qrCodes.findIndex((q) => q.id === id);
      if (idx === -1) {
        throw new AuthorizationError('QR code not found.', 404);
      }
      const qr = db.qrCodes[idx];
      assertOrgAccess(db, session.user.id, qr.organizationId, ['owner', 'admin', 'editor']);

      db.qrCodes.splice(idx, 1);
      db.qrDestinations = db.qrDestinations.filter((d) => d.qrCodeId !== id);
      db.qrScanEvents = db.qrScanEvents.filter((e) => e.qrCodeId !== id);

      appendAuditLog(db, {
        organizationId: qr.organizationId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'qr_code.deleted',
        entityType: 'qr_code',
        entityId: id,
        metadata: { name: qr.name, slug: qr.slug },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete QR code.' }, { status: 500 });
  }
}
