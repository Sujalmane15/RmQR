// =============================================================================
// RMQR — Server-Side Session Signing, Cookie Auth & API Key Verification
// =============================================================================

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { readDbAsync } from '../db/store';
import { Organization, OrgRole, Profile, Subscription } from '../types';

export const SESSION_COOKIE_NAME = 'rmqr_session';

export interface SessionPayload {
  userId: string;
  activeOrgId: string;
  exp: number;
}

export interface AuthenticatedContext {
  user: Omit<Profile, 'passwordHash'>;
  activeOrg: Organization;
  role: OrgRole;
  organizations: Array<{ organization: Organization; role: OrgRole }>;
  subscription: Subscription;
}

export function getSigningSecret(): string {
  const secret = (process.env.RMQR_SESSION_SECRET || '').trim();
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  if (!secret) {
    if (isProduction) {
      throw new Error(
        'Critical security violation: RMQR_SESSION_SECRET environment variable is required in production and cannot be empty.'
      );
    }
    return 'rmqr-default-hmac-signing-secret-2026-secure';
  }

  if (isProduction && secret.length < 32) {
    throw new Error(
      'Critical security violation: RMQR_SESSION_SECRET must be at least 32 characters long in production.'
    );
  }

  return secret;
}

export function createSessionToken(userId: string, activeOrgId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const payload: SessionPayload = {
    userId,
    activeOrgId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encoded)
    .digest('base64url');

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<AuthenticatedContext | null> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const payload = verifySessionToken(rawToken);
    if (!payload) return null;

    const db = await readDbAsync();
    const profile = db.profiles.find((p) => p.id === payload.userId);
    if (!profile) return null;

    const memberships = db.organizationMembers.filter(
      (m) => m.userId === profile.id && m.status === 'active'
    );

    const orgList: Array<{ organization: Organization; role: OrgRole }> = [];
    for (const m of memberships) {
      const org = db.organizations.find((o) => o.id === m.organizationId);
      if (org) {
        orgList.push({ organization: org, role: m.role });
      }
    }

    if (orgList.length === 0) return null;

    const activeEntry =
      orgList.find((item) => item.organization.id === payload.activeOrgId) || orgList[0];

    const sub =
      db.subscriptions.find((s) => s.organizationId === activeEntry.organization.id) || {
        id: 'default-free',
        organizationId: activeEntry.organization.id,
        planId: 'free' as const,
        status: 'active' as const,
        billingCycle: 'monthly' as const,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

    const { passwordHash: _omitted, ...safeUser } = profile;
    void _omitted;

    return {
      user: safeUser,
      activeOrg: activeEntry.organization,
      role: activeEntry.role,
      organizations: orgList,
      subscription: sub,
    };
  } catch {
    return null;
  }
}
