'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { PLAN_ENTITLEMENTS } from '@/lib/types';
import { CheckCircle2, HelpCircle } from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white">
              Simple, Predictable SaaS Pricing
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Every plan includes unlimited Static QR codes, WCAG scan validation, and safe redirect protection.
            </p>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 mt-4">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  billingCycle === 'annual'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Annual Billing (Save 20%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Object.values(PLAN_ENTITLEMENTS).map((plan) => {
              const priceInr =
                billingCycle === 'annual' ? plan.annualPriceInr : plan.monthlyPriceInr;
              const priceUsd =
                billingCycle === 'annual' ? plan.annualPriceUsd : plan.monthlyPriceUsd;

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl border p-8 flex flex-col justify-between ${
                    plan.id === 'pro'
                      ? 'border-violet-500 bg-white dark:bg-slate-900 shadow-xl shadow-violet-600/10 ring-2 ring-violet-500/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                  }`}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {plan.name}
                      </h2>
                      {plan.id === 'pro' && (
                        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{plan.tagline}</p>

                    <div className="pt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                          ₹{priceInr}
                        </span>
                        <span className="text-xs text-slate-500">
                          / month (${priceUsd} USD)
                        </span>
                      </div>
                      {billingCycle === 'annual' && priceInr > 0 && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                          Billed annually (₹{priceInr * 12}/yr)
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                      <div className="font-bold uppercase tracking-wider text-slate-400">
                        Included Entitlements
                      </div>
                      <ul className="space-y-2.5 text-slate-700 dark:text-slate-300">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Link
                    href={`/register?plan=${plan.id}`}
                    className={`mt-8 w-full inline-flex items-center justify-center rounded-xl py-3.5 text-sm font-bold transition-colors ${
                      plan.id === 'pro'
                        ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/25'
                        : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    {plan.id === 'free' ? 'Get Started Free' : `Start with ${plan.name}`}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-4xl mx-auto pt-8 space-y-6">
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
              Frequently Asked Billing Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-violet-500" />
                  Do Static QR codes ever expire?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  No. Static QR codes encode the destination directly into the image matrix and work forever without any subscription limits.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-6 space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-violet-500" />
                  Can I change a Dynamic QR destination after printing?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Yes! Dynamic QR codes point to a short RMQR redirect slug (/r/your-slug). Updating the destination URL takes effect immediately without changing the printed QR image.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
