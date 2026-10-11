import React from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ShieldCheck, Globe, Cpu, Users } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="space-y-4 text-center max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              About RMQR
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white">
              Bridging Physical Spaces &amp; Digital Experiences
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              RMQR was built so restaurants, clinics, retailers, and multi-location brands can manage
              QR redirects, digital menus, branded micro-pages, and Google Review campaigns in one
              trustworthy, privacy-conscious platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-3">
              <ShieldCheck className="h-7 w-7 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Security &amp; Redirect Integrity
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Every dynamic QR link is validated against malicious schemes before redirecting.
                We enforce strict multi-tenant Row Level Security so your organization&apos;s data stays isolated.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-3">
              <Cpu className="h-7 w-7 text-violet-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Human-in-the-Loop AI Workflows
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Whether importing a restaurant menu from an upload or drafting replies to customer
                reviews, RMQR keeps humans in control—never auto-publishing unverified prices or automated replies.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-3">
              <Globe className="h-7 w-7 text-cyan-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Honest, Privacy-First Telemetry
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                We never store raw visitor IP addresses or fabricate scan totals. Our analytics
                transparently separate bot/crawler hits from estimated human scans.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 space-y-3">
              <Users className="h-7 w-7 text-amber-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Built for Real Teams
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Collaborate across Owner, Admin, Editor, and Viewer roles with complete audit trails
                and workspace-level billing entitlements.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-bold text-white"
            >
              Get in Touch with Our Team
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
