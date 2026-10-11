import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  AuthorizationError,
  mutateDb,
  readDb,
} from '@/lib/db/store';
import { sanitizeText } from '@/lib/security';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    assertOrgAccess(db, session.user.id, session.activeOrg.id);

    const campaigns = db.campaigns
      .filter((c) => c.organizationId === session.activeOrg.id)
      .map((c) => {
        const linkedQrs = db.qrCodes.filter((q) => q.campaignId === c.id);
        const totalScans = linkedQrs.reduce((acc, q) => acc + (q.scanCount || 0), 0);
        const humanScans = linkedQrs.reduce((acc, q) => acc + (q.humanScanCount || 0), 0);
        return {
          ...c,
          qrCount: linkedQrs.length,
          totalScans,
          humanScans,
        };
      });

    return NextResponse.json({
      campaigns,
      folders: db.qrFolders.filter((f) => f.organizationId === session.activeOrg.id),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load campaigns.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const name = sanitizeText(body.name, 80);
    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const created = mutateDb((db) => {
      assertOrgAccess(db, session.user.id, session.activeOrg.id, ['owner', 'admin', 'editor']);
      const campaign = {
        id: crypto.randomUUID(),
        organizationId: session.activeOrg.id,
        name,
        description: sanitizeText(body.description || '', 300),
        startDate: body.startDate || undefined,
        endDate: body.endDate || undefined,
        utmSource: sanitizeText(body.utmSource || '', 60) || undefined,
        utmMedium: sanitizeText(body.utmMedium || '', 60) || undefined,
        utmCampaign: sanitizeText(body.utmCampaign || '', 60) || undefined,
        utmTerm: sanitizeText(body.utmTerm || '', 60) || undefined,
        utmContent: sanitizeText(body.utmContent || '', 60) || undefined,
        status: 'active' as const,
        createdAt: now,
        updatedAt: now,
      };
      db.campaigns.unshift(campaign);
      appendAuditLog(db, {
        organizationId: session.activeOrg.id,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'campaign.created',
        entityType: 'campaign',
        entityId: campaign.id,
        metadata: { name },
      });
      return campaign;
    });

    return NextResponse.json({ campaign: created }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const id = String(body.id || '');
    const updated = mutateDb((db) => {
      const c = db.campaigns.find((item) => item.id === id);
      if (!c) throw new AuthorizationError('Campaign not found.', 404);
      assertOrgAccess(db, session.user.id, c.organizationId, ['owner', 'admin', 'editor']);
      if (body.name) c.name = sanitizeText(body.name, 80);
      if (body.description !== undefined) c.description = sanitizeText(body.description, 300);
      if (body.status) c.status = body.status;
      if (body.utmSource !== undefined) c.utmSource = sanitizeText(body.utmSource, 60);
      if (body.utmMedium !== undefined) c.utmMedium = sanitizeText(body.utmMedium, 60);
      if (body.utmCampaign !== undefined) c.utmCampaign = sanitizeText(body.utmCampaign, 60);
      c.updatedAt = new Date().toISOString();
      return c;
    });

    return NextResponse.json({ campaign: updated });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to update campaign.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Campaign ID is required.' }, { status: 400 });

    mutateDb((db) => {
      const c = db.campaigns.find((item) => item.id === id);
      if (!c) throw new AuthorizationError('Campaign not found.', 404);
      assertOrgAccess(db, session.user.id, c.organizationId, ['owner', 'admin', 'editor']);
      db.campaigns = db.campaigns.filter((item) => item.id !== id);
      for (const q of db.qrCodes) {
        if (q.campaignId === id) q.campaignId = null;
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to delete campaign.' }, { status: 500 });
  }
}
