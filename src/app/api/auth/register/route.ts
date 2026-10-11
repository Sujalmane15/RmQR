import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { appendAuditLog, mutateDbAsync, readDbAsync } from '@/lib/db/store';
import {
  checkRateLimit,
  generateShortSlug,
  hashPassword,
  sanitizeText,
} from '@/lib/security';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
  organizationName: z.string().optional(),
  industry: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`register:${ip}`, 15, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid registration data.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const fullName = sanitizeText(parsed.data.fullName, 80);
    const orgName = sanitizeText(
      parsed.data.organizationName || `${fullName}'s Workspace`,
      80
    );
    const industry = sanitizeText(parsed.data.industry || 'General Business', 60);

    const existingDb = await readDbAsync();
    if (existingDb.profiles.some((p) => p.email.toLowerCase() === email)) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const orgSlug = generateShortSlug(orgName);

    const result = await mutateDbAsync((db) => {
      const newProfile = {
        id: userId,
        email,
        fullName,
        passwordHash: hashPassword(parsed.data.password),
        isSuperAdmin: false,
        emailVerified: true,
        onboardingCompleted: false,
        onboardingStep: 2,
        createdAt: now,
        updatedAt: now,
      };

      const newOrg = {
        id: orgId,
        name: orgName,
        slug: orgSlug,
        industry,
        brandPrimaryColor: '#7C3AED',
        brandSecondaryColor: '#0B0F19',
        whiteLabelEnabled: false,
        status: 'active' as const,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };

      db.profiles.push(newProfile);
      db.organizations.push(newOrg);

      // Activate any pending invitations for this email as well
      for (const m of db.organizationMembers) {
        if (m.invitedEmail.toLowerCase() === email && m.status === 'invited') {
          m.userId = userId;
          m.status = 'active';
        }
      }

      db.organizationMembers.push({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId,
        invitedEmail: email,
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
        currentPeriodEnd: thirtyDays,
        paymentProvider: 'manual',
        createdAt: now,
        updatedAt: now,
      });

      appendAuditLog(db, {
        organizationId: orgId,
        actorId: userId,
        actorEmail: email,
        action: 'user.registered',
        entityType: 'profile',
        entityId: userId,
        metadata: { organizationId: orgId, organizationName: orgName },
      });

      const { passwordHash: _omitted, ...safeProfile } = newProfile;
      void _omitted;
      return { user: safeProfile, organization: newOrg };
    });

    const token = createSessionToken(userId, orgId);
    const res = NextResponse.json(
      {
        user: result.user,
        activeOrg: result.organization,
        role: 'owner',
      },
      { status: 201 }
    );

    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json(
      { error: 'Unable to complete registration.' },
      { status: 500 }
    );
  }
}
