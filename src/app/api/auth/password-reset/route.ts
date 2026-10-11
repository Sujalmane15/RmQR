import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { mutateDb } from '@/lib/db/store';
import { checkRateLimit, hashPassword } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`pwd-reset:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Step 1: Request reset token
    if (body.action === 'request') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) {
        return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
      }

      const resetInfo = mutateDb((db) => {
        const user = db.profiles.find((p) => p.email.toLowerCase() === email);
        if (!user) return null;
        const token = crypto.randomBytes(16).toString('hex');
        user.resetToken = token;
        user.resetTokenExpiresAt = new Date(Date.now() + 3600_000).toISOString();
        return { token };
      });

      return NextResponse.json({
        ok: true,
        message:
          'If an account exists for that email, password reset instructions have been generated.',
        // In local dev without SMTP configured, return the dev token so the flow can be tested end-to-end
        devResetToken: resetInfo?.token || null,
      });
    }

    // Step 2: Confirm reset with token + newPassword
    if (body.action === 'confirm') {
      const token = String(body.token || '').trim();
      const newPassword = String(body.newPassword || '');
      if (!token || newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Valid reset token and a password of at least 8 characters are required.' },
          { status: 400 }
        );
      }

      const updated = mutateDb((db) => {
        const user = db.profiles.find(
          (p) =>
            p.resetToken === token &&
            p.resetTokenExpiresAt &&
            new Date(p.resetTokenExpiresAt).getTime() > Date.now()
        );
        if (!user) return false;
        user.passwordHash = hashPassword(newPassword);
        user.resetToken = undefined;
        user.resetTokenExpiresAt = undefined;
        user.updatedAt = new Date().toISOString();
        return true;
      });

      if (!updated) {
        return NextResponse.json(
          { error: 'Invalid or expired password reset token.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: 'Password has been reset successfully. You can now log in.',
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Password reset failed.' }, { status: 500 });
  }
}
