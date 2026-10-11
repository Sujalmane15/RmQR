import React from 'react';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Legal &amp; Privacy
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500">Effective Date: October 2026</p>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                1. Information We Collect
              </h2>
              <p>
                When you register for an RMQR workspace, we collect your account email, name,
                organization details, and the QR codes, landing pages, digital menus, and review
                campaigns you explicitly create.
              </p>
            </section>

            <section id="telemetry" className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                2. Privacy-Conscious QR Scan Telemetry
              </h2>
              <p>
                When an end-user scans a Dynamic QR code (/r/[slug]), RMQR records the timestamp,
                general device category (mobile, tablet, desktop), operating system family, browser
                family, and coarse region when provided by standard edge headers.
              </p>
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                RMQR never persists raw visitor IP addresses in the database. Unique visitor
                estimates are computed using a daily-rotating, one-way SHA-256 salted hash of the
                anonymized network subnet and user-agent string.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                3. Tenant Isolation &amp; Data Security
              </h2>
              <p>
                Workspace resources are strictly isolated by organization ID and protected by
                server-side role checks and PostgreSQL Row Level Security (RLS) policies. We never
                sell customer data or scan logs to third-party advertisers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                4. Data Deletion &amp; Export
              </h2>
              <p>
                Workspace owners can export scan analytics as CSV or permanently delete QR codes,
                landing pages, and menus at any time from the RMQR dashboard.
              </p>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
