import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSessionToken, getCurrentSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { assertOrgAccess, AuthorizationError, mutateDb, readDb } from '@/lib/db/store';
import { generateShortSlug, sanitizeText } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Action 1: Create a new organization workspace
    if (body.action === 'create_org') {
      const name = sanitizeText(body.name, 80);
      const industry = sanitizeText(body.industry || 'General Business', 60);
      if (!name || name.length < 2) {
        return NextResponse.json({ error: 'Workspace name is required.' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const orgId = crypto.randomUUID();
      const newOrg = mutateDb((db) => {
        const org = {
          id: orgId,
          name,
          slug: generateShortSlug(name),
          industry,
          brandPrimaryColor: '#7C3AED',
          brandSecondaryColor: '#0B0F19',
          whiteLabelEnabled: false,
          status: 'active' as const,
          createdBy: session.user.id,
          createdAt: now,
          updatedAt: now,
        };
        db.organizations.push(org);
        db.organizationMembers.push({
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId: session.user.id,
          invitedEmail: session.user.email,
          role: 'owner',
          status: 'active',
          createdAt: now,
        });
        db.subscriptions.push({
          id: crypto.randomUUID(),
          organizationId: orgId,
          planId: 'free',
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          paymentProvider: 'manual',
          createdAt: now,
          updatedAt: now,
        });
        return org;
      });

      const token = createSessionToken(session.user.id, newOrg.id);
      const res = NextResponse.json({ activeOrg: newOrg, role: 'owner' }, { status: 201 });
      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return res;
    }

    // Action 2: Switch active organization workspace
    const targetOrgId = String(body.organizationId || '');
    const db = readDb();
    const access = assertOrgAccess(db, session.user.id, targetOrgId, [
      'owner',
      'admin',
      'editor',
      'viewer',
    ]);

    const token = createSessionToken(session.user.id, access.organization.id);
    const res = NextResponse.json({
      activeOrg: access.organization,
      role: access.role,
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to switch workspace.' }, { status: 500 });
  }
}
