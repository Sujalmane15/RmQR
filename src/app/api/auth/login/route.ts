import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appendAuditLog, mutateDbAsync, readDbAsync } from '@/lib/db/store';
import { checkRateLimit, verifyPassword } from '@/lib/security';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`login:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid credentials.' },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const db = await readDbAsync();
    const profile = db.profiles.find((p) => p.email.toLowerCase() === email);

    if (!profile || !verifyPassword(parsed.data.password, profile.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    // Prevent default seeded demo accounts from being used as admin in production
    if (isProduction && (email === 'admin@rmqr.app' || email === 'owner@rmqr.app')) {
      return NextResponse.json(
        { error: 'Default demo accounts are disabled in production for security. Please sign in with your registered organization account.' },
        { status: 403 }
      );
    }

    const memberships = db.organizationMembers.filter(
      (m) => m.userId === profile.id && m.status === 'active'
    );
    const firstOrgId = memberships[0]?.organizationId;
    const activeOrg = db.organizations.find((o) => o.id === firstOrgId) || db.organizations[0];

    if (!activeOrg) {
      return NextResponse.json(
        { error: 'No active workspace found for this user.' },
        { status: 403 }
      );
    }

    await mutateDbAsync((state) => {
      appendAuditLog(state, {
        organizationId: activeOrg.id,
        actorId: profile.id,
        actorEmail: profile.email,
        action: 'user.login',
        entityType: 'profile',
        entityId: profile.id,
      });
    });

    const token = createSessionToken(profile.id, activeOrg.id);
    const { passwordHash: _omitted, ...safeUser } = profile;
    void _omitted;

    const res = NextResponse.json({
      user: safeUser,
      activeOrg,
      role: memberships[0]?.role || 'owner',
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
  }
}
