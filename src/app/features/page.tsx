import React from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FolderKanban,
  Globe,
  Lock,
  QrCode,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Utensils,
} from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Platform Capabilities
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Engineered for Reliability, Customization &amp; Conversion
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-400">
              Explore every module inside RMQR—from dynamic link redirection and bulk CSV generation
              to digital restaurant menus and Google Review growth flows.
            </p>
          </div>

          {/* Feature Grid */}
          <div id="reviews-and-menus" className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: QrCode,
                title: '14 Content Formats & Custom Styling',
                desc: 'Encode URLs, Wi-Fi credentials, vCards, WhatsApp chats, Google Review flows, digital menus, SMS, email, phone, and geo-coordinates with custom module shapes and logos.',
              },
              {
                icon: Globe,
                title: 'Zero-Downtime Dynamic Redirects',
                desc: 'Every dynamic QR uses a stable /r/[slug] endpoint. Edit the target destination, pause campaigns, set expiration dates, or configure device-based routing without reprinting.',
              },
              {
                icon: Utensils,
                title: 'Digital Restaurant Menus & AI OCR',
                desc: 'Publish mobile-first menus with category tabs, Veg/Non-Veg filters, Today’s Specials, and instant price updates. Extract items from existing menu text or uploads with human review.',
              },
              {
                icon: Star,
                title: 'Google Review Growth System',
                desc: 'Direct happy customers to your legitimate Google Business review page. Offer optional review starter templates and generate AI-assisted owner responses.',
              },
              {
                icon: Smartphone,
                title: 'Branded Mobile Landing Pages',
                desc: 'Create fast-loading Link-in-Bio, Business Profile, Contact Card, Event, and Promotion micro-pages with button click tracking.',
              },
              {
                icon: BarChart3,
                title: 'Privacy-Conscious Scan Analytics',
                desc: 'Track total scans, unique daily visitor hashes, device categories, OS/browser breakdowns, and top-performing QR codes while separating bot crawlers.',
              },
              {
                icon: FolderKanban,
                title: 'Campaigns, UTM Builder & Bulk ZIP',
                desc: 'Group QR codes into folders and UTM-tagged marketing campaigns. Import CSV batches with row-level validation and export print-ready ZIP archives.',
              },
              {
                icon: Lock,
                title: 'Multi-Tenant Workspaces & RBAC',
                desc: 'Isolate client or brand resources with Organization workspaces, Owner/Admin/Editor/Viewer roles, scoped REST API keys, and audit logs.',
              },
              {
                icon: Shield,
                title: 'Safe Redirects & Contrast Guardrails',
                desc: 'Automatic WCAG contrast and quiet-zone checks warn you before exporting un-scannable codes, while server-side validation blocks malicious URL schemes.',
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-3 shadow-sm"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{feat.title}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-violet-700 via-indigo-700 to-slate-900 p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-200">
                <Sparkles className="h-4 w-4" /> Ready in 60 Seconds
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold">
                Build Your First Dynamic QR, Menu, or Review Standee Today
              </h2>
              <p className="text-sm text-violet-100">
                Start on our Free tier with no credit card required, or explore the live dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Compare Plans
              </Link>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
