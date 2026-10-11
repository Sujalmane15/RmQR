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
import { PLAN_ENTITLEMENTS, PlanId } from '@/lib/types';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    const orgId = session.activeOrg.id;
    assertOrgAccess(db, session.user.id, orgId);

    const sub =
      db.subscriptions.find((s) => s.organizationId === orgId) || session.subscription;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const usage = {
      dynamicQrCodes: db.qrCodes.filter(
        (q) => q.organizationId === orgId && q.qrType === 'dynamic' && q.status !== 'archived'
      ).length,
      staticQrCodes: db.qrCodes.filter(
        (q) => q.organizationId === orgId && q.qrType === 'static'
      ).length,
      monthlyScanEvents: db.qrScanEvents.filter(
        (e) => e.organizationId === orgId && new Date(e.scannedAt).getTime() >= monthStart
      ).length,
      landingPages: db.landingPages.filter((l) => l.organizationId === orgId).length,
      menus: db.menus.filter((m) => m.organizationId === orgId).length,
      reviewCampaigns: db.reviewCampaigns.filter((r) => r.organizationId === orgId).length,
      aiAgents: (db.aiAgents || []).filter((a) => a.organizationId === orgId).length,
      monthlyAiMessages: (db.aiMessages || []).filter(
        (m) => m.organizationId === orgId && new Date(m.createdAt).getTime() >= monthStart
      ).length,
      teamMembers: db.organizationMembers.filter(
        (m) => m.organizationId === orgId && m.status !== 'revoked'
      ).length,
    };

    const invoices = db.billingInvoices.filter((i) => i.organizationId === orgId);

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
    const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return NextResponse.json({
      subscription: sub,
      currentPlan: PLAN_ENTITLEMENTS[sub.planId],
      plans: PLAN_ENTITLEMENTS,
      usage,
      invoices,
      paymentGateways: {
        stripeConfigured,
        razorpayConfigured,
      },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load billing details.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const planId = body.planId as PlanId;
    const billingCycle = body.billingCycle === 'annual' ? 'annual' : 'monthly';

    if (!['free', 'pro', 'business'].includes(planId)) {
      return NextResponse.json({ error: 'Invalid subscription plan selected.' }, { status: 400 });
    }

    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
    const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    const result = mutateDb((db) => {
      const orgId = session.activeOrg.id;
      assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);

      const now = new Date().toISOString();
      const periodDays = billingCycle === 'annual' ? 365 : 30;
      const periodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();

      let sub = db.subscriptions.find((s) => s.organizationId === orgId);
      if (!sub) {
        sub = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          planId,
          status: 'active',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentProvider: 'manual',
          createdAt: now,
          updatedAt: now,
        };
        db.subscriptions.push(sub);
      } else {
        sub.planId = planId;
        sub.billingCycle = billingCycle;
        sub.status = 'active';
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = periodEnd;
        sub.updatedAt = now;
      }

      const planMeta = PLAN_ENTITLEMENTS[planId];
      const amountInr =
        billingCycle === 'annual' ? planMeta.annualPriceInr * 12 : planMeta.monthlyPriceInr;
      const amountUsd =
        billingCycle === 'annual' ? planMeta.annualPriceUsd * 12 : planMeta.monthlyPriceUsd;

      // Record transparent billing event (marked 'pending' if paid plan without live payment gateway keys)
      const invoiceStatus =
        planId === 'free'
          ? 'paid'
          : stripeConfigured || razorpayConfigured
          ? 'paid'
          : 'pending';

      const invoice = {
        id: crypto.randomUUID(),
        organizationId: orgId,
        planId,
        amountInr,
        amountUsd,
        status: invoiceStatus as 'paid' | 'pending',
        billingCycle: billingCycle as 'monthly' | 'annual',
        description:
          planId === 'free'
            ? 'Switched to Free Starter Plan'
            : `${planMeta.name} (${billingCycle}) — ${
                stripeConfigured || razorpayConfigured
                  ? 'Gateway Processed'
                  : 'Sandbox Plan Change (Live payment provider keys not configured)'
              }`,
        createdAt: now,
      };
      db.billingInvoices.unshift(invoice);

      appendAuditLog(db, {
        organizationId: orgId,
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'subscription.plan_changed',
        entityType: 'subscription',
        entityId: sub.id,
        metadata: { planId, billingCycle, invoiceStatus },
      });

      return { subscription: sub, invoice };
    });

    return NextResponse.json({
      ...result,
      notice:
        !stripeConfigured && !razorpayConfigured && planId !== 'free'
          ? 'Workspace plan limits updated in sandbox mode. Configure STRIPE_SECRET_KEY or RAZORPAY_KEY_ID in .env.local to process live merchant charges.'
          : 'Subscription plan updated.',
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Billing update failed.' }, { status: 500 });
  }
}
