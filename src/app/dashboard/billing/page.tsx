'use client';

import React, { useEffect, useState } from 'react';
import { BillingInvoice, PLAN_ENTITLEMENTS, PlanId, Subscription } from '@/lib/types';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Info,
  Sparkles,
} from 'lucide-react';

interface BillingData {
  subscription: Subscription;
  usage: {
    dynamicQrCodes: number;
    staticQrCodes: number;
    monthlyScanEvents: number;
    landingPages: number;
    menus: number;
    reviewCampaigns: number;
    teamMembers: number;
  };
  invoices: BillingInvoice[];
  paymentGateways: {
    stripeConfigured: boolean;
    razorpayConfigured: boolean;
  };
}

export default function BillingAndPlansPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingPlan, setUpdatingPlan] = useState<PlanId | null>(null);

  const loadBilling = async () => {
    const res = await fetch('/api/billing');
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (json.subscription?.billingCycle) {
        setBillingCycle(json.subscription.billingCycle);
      }
    }
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleSelectPlan = async (planId: PlanId) => {
    setUpdatingPlan(planId);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not update subscription plan.');
      } else {
        setNotice(json.notice || 'Subscription plan updated.');
        loadBilling();
      }
    } finally {
      setUpdatingPlan(null);
    }
  };

  const currentPlanId = data?.subscription?.planId || 'free';
  const currentEntitlement = PLAN_ENTITLEMENTS[currentPlanId];

  const renderMeter = (label: string, used: number, limit: number) => {
    const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {used} / {limit}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-violet-600'
            }`}
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Subscription &amp; Billing
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Server-enforced workspace entitlements, real usage meters, and plan management
        </p>
      </div>

      {notice && (
        <div
          role="status"
          data-testid="billing-notice"
          className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs font-bold text-red-600 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Payment Gateway Configuration Status */}
      {data &&
        !data.paymentGateways.stripeConfigured &&
        !data.paymentGateways.razorpayConfigured && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-slate-600 dark:text-slate-300">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white">
                Payment Gateway Configuration Status:
              </strong>{' '}
              Live merchant keys (<code className="font-mono">STRIPE_SECRET_KEY</code> /{' '}
              <code className="font-mono">RAZORPAY_KEY_ID</code>) are not currently set in{' '}
              <code className="font-mono">.env.local</code>. Switching plans below updates your
              server-side workspace entitlements in Sandbox Mode and records a transparent{' '}
              <code className="font-mono">pending</code> billing entry rather than claiming a real
              credit card charge.
            </div>
          </div>
        )}

      {/* Current Plan & Usage Meters */}
      {data && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Current Plan
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-500">
                  {data.subscription.status}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white" data-testid="current-plan-name">
                {currentEntitlement.name} ({data.subscription.billingCycle})
              </h2>
              <p className="text-xs text-slate-500">{currentEntitlement.tagline}</p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  billingCycle === 'monthly' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  billingCycle === 'annual' ? 'bg-violet-600 text-white' : 'text-slate-500'
                }`}
              >
                Annual (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderMeter(
              'Active Dynamic QR Codes',
              data.usage.dynamicQrCodes,
              currentEntitlement.limits.dynamicQrCodes
            )}
            {renderMeter(
              'Tracked Scans This Month',
              data.usage.monthlyScanEvents,
              currentEntitlement.limits.monthlyScanEvents
            )}
            {renderMeter(
              'Digital Restaurant Menus',
              data.usage.menus,
              currentEntitlement.limits.menus
            )}
            {renderMeter(
              'Branded Landing Pages',
              data.usage.landingPages,
              currentEntitlement.limits.landingPages
            )}
            {renderMeter(
              'Google Review Campaigns',
              data.usage.reviewCampaigns,
              currentEntitlement.limits.reviewCampaigns
            )}
            {renderMeter(
              'Workspace Team Members',
              data.usage.teamMembers,
              currentEntitlement.limits.teamMembers
            )}
          </div>
        </div>
      )}

      {/* Plan Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(PLAN_ENTITLEMENTS).map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const priceInr =
            billingCycle === 'annual' ? plan.annualPriceInr : plan.monthlyPriceInr;

          return (
            <div
              key={plan.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between ${
                isCurrent
                  ? 'border-violet-500 bg-violet-500/5 ring-2 ring-violet-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {plan.name}
                  </h3>
                  {isCurrent && (
                    <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      Active Plan
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    ₹{priceInr}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">/ month</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isCurrent || updatingPlan !== null}
                onClick={() => handleSelectPlan(plan.id)}
                data-testid={`select-plan-${plan.id}`}
                className={`mt-6 w-full rounded-xl py-2.5 text-xs font-bold transition-colors ${
                  isCurrent
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-default'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {isCurrent
                  ? 'Current Active Plan'
                  : updatingPlan === plan.id
                  ? 'Updating...'
                  : `Switch to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Billing History */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-violet-500" />
          Billing &amp; Plan History
        </h2>
        {!data?.invoices || data.invoices.length === 0 ? (
          <p className="text-xs text-slate-500">No billing events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 px-4">Description</th>
                  <th className="py-2 px-4">Amount</th>
                  <th className="py-2 pl-4">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 pr-4 font-mono text-slate-500">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">{inv.description}</td>
                    <td className="py-2.5 px-4 font-bold">
                      ₹{inv.amountInr} (${inv.amountUsd})
                    </td>
                    <td className="py-2.5 pl-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-amber-500/15 text-amber-500'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
