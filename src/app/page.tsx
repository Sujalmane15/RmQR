'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  DEFAULT_QR_STYLE,
  PLAN_ENTITLEMENTS,
  QREyeStyle,
  QRFrameStyle,
  QRPatternType,
} from '@/lib/types';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Globe,
  Layers,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Utensils,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  const [demoUrl, setDemoUrl] = useState('https://rmqr.app/m/saffron-bistro');
  const [fgColor, setFgColor] = useState('#0B0F19');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [eyeColor, setEyeColor] = useState('#7C3AED');
  const [pattern, setPattern] = useState<QRPatternType>('rounded');
  const [eyeStyle, setEyeStyle] = useState<QREyeStyle>('rounded');
  const [frameStyle, setFrameStyle] = useState<QRFrameStyle>('banner_bottom');
  const [frameText, setFrameText] = useState('SCAN FOR MENU');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <PublicHeader />

      <main className="flex-1">
        {/* HERO SECTION + INTERACTIVE QR STUDIO */}
        <section className="relative overflow-hidden py-16 lg:py-24 border-b border-slate-200 dark:border-slate-800/80">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-[48rem] rounded-full bg-violet-600/15 blur-3xl" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/60 dark:border-violet-700/60 bg-violet-50/90 dark:bg-violet-950/60 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  Modular Smart QR SaaS Platform
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                  Connect Physical &amp; Digital Worlds{' '}
                  <span className="bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">
                    One Scan at a Time
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  RMQR combines dynamic QR code management, mobile business landing pages,
                  AI-assisted digital restaurant menus, and Google Review growth flows into one
                  secure, high-velocity workspace.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition-all"
                  >
                    Start Free Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/qr-codes/new"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-6 py-3.5 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors"
                  >
                    Open Full QR Studio
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Zero-Downtime Dynamic QRs
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    AI Digital Menu Import
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    Google Review Growth
                  </div>
                </div>
              </div>

              {/* Interactive Live QR Customizer Card */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                        Instant Studio Preview
                      </span>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Customize &amp; Download Now
                      </h2>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      100% Scannable
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label
                        htmlFor="home-qr-url"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Destination URL or Content
                      </label>
                      <input
                        id="home-qr-url"
                        type="text"
                        value={demoUrl}
                        onChange={(e) => setDemoUrl(e.target.value)}
                        placeholder="https://yourbusiness.com"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Pattern
                        </label>
                        <select
                          aria-label="QR Pattern"
                          value={pattern}
                          onChange={(e) => setPattern(e.target.value as QRPatternType)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="dots">Dots</option>
                          <option value="square">Classic Square</option>
                          <option value="classy">Classy</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Corner Eyes
                        </label>
                        <select
                          aria-label="Corner Eye Style"
                          value={eyeStyle}
                          onChange={(e) => setEyeStyle(e.target.value as QREyeStyle)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="circle">Circle</option>
                          <option value="square">Square</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Frame Badge
                        </label>
                        <select
                          aria-label="Frame Style"
                          value={frameStyle}
                          onChange={(e) => setFrameStyle(e.target.value as QRFrameStyle)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="banner_bottom">Bottom CTA</option>
                          <option value="banner_top">Top Header</option>
                          <option value="none">No Frame</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Foreground
                        </label>
                        <input
                          type="color"
                          aria-label="Foreground Color"
                          value={fgColor}
                          onChange={(e) => setFgColor(e.target.value)}
                          className="h-8 w-full rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Background
                        </label>
                        <input
                          type="color"
                          aria-label="Background Color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="h-8 w-full rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Eye Accent
                        </label>
                        <input
                          type="color"
                          aria-label="Eye Color"
                          value={eyeColor}
                          onChange={(e) => setEyeColor(e.target.value)}
                          className="h-8 w-full rounded-lg cursor-pointer border border-slate-300 dark:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          CTA Text
                        </label>
                        <input
                          type="text"
                          aria-label="Frame CTA Text"
                          value={frameText}
                          onChange={(e) => setFrameText(e.target.value)}
                          className="h-8 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <QRPreviewCard
                    content={demoUrl}
                    name="rmqr-instant-demo"
                    size={210}
                    styleConfig={{
                      ...DEFAULT_QR_STYLE,
                      fgColor,
                      bgColor,
                      eyeColor,
                      frameColor: eyeColor,
                      pattern,
                      eyeStyle,
                      frameStyle,
                      frameText,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE PRODUCT PILLARS */}
        <section className="py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              Four Integrated Suites
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Everything Your Business Needs Behind a Single Scan
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Built for restaurants, clinics, retail stores, hospitality brands, and marketing teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pillar 1: Dynamic QR Studio */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-8 space-y-4 shadow-sm hover:border-violet-500/50 transition-colors">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/15 text-violet-600 dark:text-violet-400">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Dynamic &amp; Static QR Code Studio
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Update destination URLs anytime without reprinting standees or packaging. Includes
                14 content formats, custom module patterns, center logo overlays, WCAG contrast
                validation, password protection, and print-ready PDF/SVG/PNG exports.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard/qr-codes/new"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Launch QR Studio <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Pillar 2: Digital Restaurant Menu */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-8 space-y-4 shadow-sm hover:border-emerald-500/50 transition-colors">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Utensils className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Digital Restaurant Menus + AI Menu Import
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Replace worn paper menus with a fast mobile QR menu. Manage categories, Veg/Non-Veg
                filters, Today&apos;s Specials, Best-Seller badges, and instant price updates—or
                extract dishes from existing menus with mandatory human review before publishing.
              </p>
              <div className="pt-2 flex items-center gap-4">
                <Link
                  href="/m/saffron-bistro"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  View Live Demo Menu <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/menus"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Manage Menus &rarr;
                </Link>
              </div>
            </div>

            {/* Pillar 3: Google Review Growth */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-8 space-y-4 shadow-sm hover:border-amber-500/50 transition-colors">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Google Review Growth &amp; Reply Assistant
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect your legitimate Google Business review link to a frictionless QR standee.
                Offer optional review-writing prompts for busy guests and draft personalized owner
                replies to every customer review with human approval safeguards.
              </p>
              <div className="pt-2 flex items-center gap-4">
                <Link
                  href="/review/saffron-reviews"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Try Live Review Flow <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/reviews"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Review Console &rarr;
                </Link>
              </div>
            </div>

            {/* Pillar 4: Branded Landing Pages & Analytics */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-8 space-y-4 shadow-sm hover:border-cyan-500/50 transition-colors">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                Branded Micro Landing Pages &amp; Scan Telemetry
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Launch mobile-first business profiles, digital contact cards, event hubs, and
                link-in-bio pages in seconds. Track real human scans vs. bot crawlers with
                privacy-conscious analytics and CSV exports.
              </p>
              <div className="pt-2 flex items-center gap-4">
                <Link
                  href="/p/saffron-hub"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Preview Live Landing Page <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/landing-pages"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Page Builder &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & ARCHITECTURE BAR */}
        <section className="border-y border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <ShieldCheck className="h-6 w-6 text-violet-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Safe Redirect Validation
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Every dynamic QR redirect blocks dangerous schemes and unrestricted open redirects on the server.
                </p>
              </div>
              <div className="space-y-2">
                <Lock className="h-6 w-6 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Strict Tenant Isolation
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Multi-workspace Row Level Security and Owner/Admin/Editor/Viewer RBAC enforced on every endpoint.
                </p>
              </div>
              <div className="space-y-2">
                <BarChart3 className="h-6 w-6 text-cyan-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Privacy-First Analytics
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Daily salted visitor hashes without storing raw IP addresses, separating bot crawlers from real people.
                </p>
              </div>
              <div className="space-y-2">
                <Layers className="h-6 w-6 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Bulk CSV &amp; ZIP Pipeline
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Generate dozens of dynamic QR codes from CSV with row-level validation and 1-click ZIP archive export.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING PREVIEW */}
        <section className="py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Transparent Plans for Every Stage
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Start free with unlimited static QR codes and up to 5 dynamic QR codes. Upgrade as your scan volume grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Object.values(PLAN_ENTITLEMENTS).map((plan) => (
              <div
                key={plan.id}
                className={`rounded-3xl border p-8 flex flex-col justify-between ${
                  plan.id === 'pro'
                    ? 'border-violet-500 bg-violet-950/10 dark:bg-violet-950/25 shadow-lg shadow-violet-600/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {plan.id === 'pro' && (
                      <span className="rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold text-white">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{plan.tagline}</p>
                  <div className="pt-2">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      ₹{plan.monthlyPriceInr}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">/ month</span>
                  </div>
                  <ul className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/register"
                  className={`mt-8 w-full inline-flex items-center justify-center rounded-xl py-3 text-xs font-bold transition-colors ${
                    plan.id === 'pro'
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                  }`}
                >
                  {plan.id === 'free' ? 'Start Free' : `Choose ${plan.name}`}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
