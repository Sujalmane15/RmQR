import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { mutateDb } from '@/lib/db/store';
import { checkRateLimit, sanitizeText } from '@/lib/security';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your name.'),
  email: z.string().email('Please enter a valid email address.'),
  subject: z.string().min(3, 'Please enter a subject.'),
  message: z.string().min(10, 'Message must be at least 10 characters.'),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`contact:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many messages sent. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid form input.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession();

    const ticket = mutateDb((db) => {
      const created = {
        id: crypto.randomUUID(),
        organizationId: session?.activeOrg.id || null,
        name: sanitizeText(parsed.data.name, 80),
        email: parsed.data.email.toLowerCase().trim(),
        subject: sanitizeText(parsed.data.subject, 120),
        message: sanitizeText(parsed.data.message, 2000),
        status: 'open' as const,
        createdAt: new Date().toISOString(),
      };
      db.supportTickets.unshift(created);
      return created;
    });

    return NextResponse.json({ ticket, ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to submit support request.' },
      { status: 500 }
    );
  }
}
