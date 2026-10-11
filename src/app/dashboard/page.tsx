'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  ExternalLink,
  FolderKanban,
  Plus,
  QrCode,
  Smartphone,
  Sparkles,
  Star,
  Utensils,
} from 'lucide-react';
import { QRCodeRecord } from '@/lib/types';

export default function DashboardOverviewPage() {
  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalScans: number;
    humanScans: number;
    uniqueVisitors: number;
    activeQrCount: number;
  }>({
    totalScans: 0,
    humanScans: 0,
    uniqueVisitors: 0,
    activeQrCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/qr-codes').then((r) => (r.ok ? r.json() : { qrCodes: [] })),
      fetch('/api/analytics?days=30').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([qrData, analyticsData]) => {
        setQrCodes(qrData.qrCodes || []);
        if (analyticsData?.summary) {
          setAnalytics(analyticsData.summary);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Workspace Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time metrics across your QR codes, restaurant menus, landing pages, and Google review flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Setup Wizard
          </Link>
          <Link
            href="/dashboard/qr-codes/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25"
          >
            <Plus className="h-4 w-4" />
            New QR Code
          </Link>
        </div>
      </div>

      {/* Real Persisted Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Active QR Codes
          </span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white" data-testid="metric-active-qrs">
            {loading ? '—' : qrCodes.length}
          </div>
          <p className="text-[11px] text-slate-400">
            {qrCodes.filter((q) => q.qrType === 'dynamic').length} Dynamic &bull;{' '}
            {qrCodes.filter((q) => q.qrType === 'static').length} Static
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Total Persisted Scans (30d)
          </span>
          <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400" data-testid="metric-total-scans">
            {loading ? '—' : analytics.totalScans}
          </div>
          <p className="text-[11px] text-slate-400">
            Strictly persisted from /r/[slug] events
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Estimated Human Scans
          </span>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {loading ? '—' : analytics.humanScans}
          </div>
          <p className="text-[11px] text-slate-400">
            Excludes detected bot/crawler hits
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Unique Daily Visitors
          </span>
          <div className="text-3xl font-extrabold text-cyan-600 dark:text-cyan-400">
            {loading ? '—' : analytics.uniqueVisitors}
          </div>
          <p className="text-[11px] text-slate-400">
            Privacy-preserving salted daily hash
          </p>
        </div>
      </div>

      {/* Modular Product Launchpad */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/dashboard/qr-codes/new"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 hover:border-violet-500 transition-colors space-y-2"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
            <QrCode className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
            QR Code Studio <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </h2>
          <p className="text-xs text-slate-500">
            Create customized static or dynamic QR codes in 14 formats.
          </p>
        </Link>

        <Link
          href="/dashboard/menus"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 hover:border-emerald-500 transition-colors space-y-2"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <Utensils className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
            Digital QR Menus <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </h2>
          <p className="text-xs text-slate-500">
            Manage restaurant dishes, prices, Specials, and AI OCR imports.
          </p>
        </Link>

        <Link
          href="/dashboard/reviews"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 hover:border-amber-500 transition-colors space-y-2"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <Star className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
            Google Reviews <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </h2>
          <p className="text-xs text-slate-500">
            Grow Google reviews via QR and generate AI owner reply drafts.
          </p>
        </Link>

        <Link
          href="/dashboard/landing-pages"
          className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 hover:border-cyan-500 transition-colors space-y-2"
        >
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
            <Smartphone className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
            Landing Pages <ArrowRight className="h-4 w-4 opacity-50 group-hover:translate-x-1 transition-transform" />
          </h2>
          <p className="text-xs text-slate-500">
            Build mobile-first business profiles, bio links, and contact cards.
          </p>
        </Link>
      </div>

      {/* Recent QR Codes Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent QR Codes
            </h2>
            <p className="text-xs text-slate-500">
              Manage destinations, test live redirects, or inspect scan performance
            </p>
          </div>
          <Link
            href="/dashboard/qr-codes"
            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
          >
            View All ({qrCodes.length}) &rarr;
          </Link>
        </div>

        {qrCodes.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <QrCode className="h-10 w-10 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No QR codes created yet
            </p>
            <Link
              href="/dashboard/qr-codes/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Create Your First QR Code
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 pr-4">Name &amp; Slug</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Destination / Target</th>
                  <th className="py-2.5 px-4">Scans</th>
                  <th className="py-2.5 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/70">
                {qrCodes.slice(0, 6).map((qr) => (
                  <tr key={qr.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4">
                      <div className="font-bold text-slate-900 dark:text-white">{qr.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">/r/{qr.slug}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          qr.qrType === 'dynamic'
                            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {qr.qrType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          qr.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {qr.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300">
                      {qr.destinationUrl || qr.encodedContent}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {qr.scanCount || 0}
                    </td>
                    <td className="py-3 pl-4 text-right space-x-2">
                      {qr.qrType === 'dynamic' && (
                        <a
                          href={`/r/${qr.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                        >
                          Test Scan <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <Link
                        href={`/dashboard/qr-codes/${qr.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Manage
                      </Link>
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
