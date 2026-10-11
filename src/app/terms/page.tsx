import React from 'react';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Legal Agreement
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Terms of Service
            </h1>
            <p className="text-xs text-slate-500">Effective Date: October 2026</p>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                1. Acceptable Use &amp; Anti-Phishing Policy
              </h2>
              <p>
                You agree not to use RMQR dynamic redirects or landing pages to distribute malware,
                phishing links, deceptive financial schemes, or unlawful content. RMQR validates all
                redirect URLs and reserves the right to suspend workspaces or disable QR slugs found
                in violation.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                2. Google Review Integrity Policy
              </h2>
              <p>
                When using the RMQR Google Review Growth module, you must link only to your
                legitimate Google Business Profile review destination. You may not generate fake
                reviews, gate negative feedback, or automatically publish AI responses without
                human review.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                3. Restaurant Menu Accuracy
              </h2>
              <p>
                Restaurant owners are responsible for verifying all dish names, dietary/allergen
                tags, and prices—including items extracted via AI/OCR menu import—before publishing
                menus to guests.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                4. Subscriptions &amp; Entitlements
              </h2>
              <p>
                Plan limits for dynamic QR codes, landing pages, menus, and workspace members are
                enforced per organization. Static QR codes encode content directly and remain
                scannable indefinitely.
              </p>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
