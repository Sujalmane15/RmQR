'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  ExternalLink,
  Info,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface AnalyticsPayload {
  summary: {
    totalScans: number;
    totalRawScans: number;
    humanScans: number;
    botScans: number;
    uniqueVisitors: number;
    activeQrCount: number;
  };
  scansByDay: Array<{ date: string; count: number }>;
  scansByHour: Array<{ hour: string; count: number }>;
  qrRanking: Array<{
    id: string;
    name: string;
    slug: string;
    qrType: string;
    contentType: string;
    scans: number;
    totalAllTimeScans: number;
  }>;
  campaignPerformance: Array<{
    id: string;
    name: string;
    status: string;
    scans: number;
    uniqueVisitors: number;
  }>;
  devices: Array<{ label: string; count: number }>;
  operatingSystems: Array<{ label: string; count: number }>;
  browsers: Array<{ label: string; count: number }>;
  countries: Array<{ label: string; count: number }>;
  recentEvents: Array<{
    id: string;
    qrCodeId: string;
    qrName: string;
    qrSlug: string;
    scannedAt: string;
    isBot: boolean;
    deviceType: string;
    os: string;
    browser: string;
    country: string;
    region: string;
    destinationResolved: string;
  }>;
  qrCodes: Array<{ id: string; name: string; slug: string }>;
  campaigns: Array<{ id: string; name: string }>;
}

export default function AnalyticsDashboardPage() {
  const [days, setDays] = useState('30');
  const [qrCodeId, setQrCodeId] = useState('all');
  const [campaignId, setCampaignId] = useState('all');
  const [excludeBots, setExcludeBots] = useState(true);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        days,
        qrCodeId,
        campaignId,
        excludeBots: String(excludeBots),
      });
      const res = await fetch(`/api/analytics?${qs.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [days, qrCodeId, campaignId, excludeBots]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportCsv = () => {
    const qs = new URLSearchParams({
      days,
      qrCodeId,
      campaignId,
      excludeBots: String(excludeBots),
      format: 'csv',
    });
    window.open(`/api/analytics?${qs.toString()}`, '_blank');
  };

  const maxDayCount = Math.max(
    1,
    ...(data?.scansByDay.map((d) => d.count) || [1])
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Scan Analytics &amp; Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Strictly computed from persisted /r/[slug] redirect events — zero fabricated data
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          data-testid="export-analytics-csv-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm"
        >
          <Download className="h-4 w-4" />
          Export Scan Events (CSV)
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Date Range
          </label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last 12 Months</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Filter by QR Code
          </label>
          <select
            value={qrCodeId}
            onChange={(e) => setQrCodeId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">All Workspace QR Codes</option>
            {data?.qrCodes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name} (/r/{q.slug})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Filter by Campaign
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">All Campaigns</option>
            {data?.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-1">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={excludeBots}
              onChange={(e) => setExcludeBots(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
            />
            Exclude Detected Bots &amp; Previews
          </label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
          <span className="text-xs font-semibold text-slate-500">Total Filtered Scans</span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1" data-testid="analytics-total-scans">
            {loading ? '—' : data?.summary.totalScans ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Raw total: {data?.summary.totalRawScans ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
          <span className="text-xs font-semibold text-slate-500">Estimated Unique Visitors</span>
          <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 mt-1" data-testid="analytics-unique-visitors">
            {loading ? '—' : data?.summary.uniqueVisitors ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Daily rotating SHA-256 visitor hash</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
          <span className="text-xs font-semibold text-slate-500">Estimated Human Scans</span>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '—' : data?.summary.humanScans ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Standard browser &amp; phone cameras</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5">
          <span className="text-xs font-semibold text-slate-500">Bot / Link Preview Hits</span>
          <div className="text-3xl font-extrabold text-amber-500 mt-1">
            {loading ? '—' : data?.summary.botScans ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Crawlers, WhatsApp/Slack link unfurlers</p>
        </div>
      </div>

      {/* Privacy & Estimation Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-slate-600 dark:text-slate-300">
        <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 dark:text-white">
            Privacy-Conscious Tracking &amp; Estimation Methodology:
          </strong>{' '}
          RMQR never stores full visitor IP addresses or third-party tracking cookies on public
          redirects. Unique visitors are estimated using a daily salted hash of the truncated
          network subnet and User-Agent. Bot separation relies on User-Agent heuristics and is
          reported as an estimate rather than a guarantee.
        </div>
      </div>

      {/* Empty State or Visual Breakdowns */}
      {!loading && (data?.summary.totalRawScans ?? 0) === 0 ? (
        <div
          data-testid="analytics-empty-state"
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-12 text-center space-y-4"
        >
          <BarChart3 className="h-12 w-12 text-violet-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            No Persisted Scan Events Yet
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            RMQR never fabricates scan charts or fake visitor numbers. Scan any of your Dynamic QR
            codes or click the test link below to record your first real scan event!
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <a
              href="/r/saffron-menu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white"
            >
              Trigger Live Scan (/r/saffron-menu) <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={loadAnalytics}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold"
            >
              Refresh Metrics
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Time Series & Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Scans by Day
              </h2>
              <div className="space-y-2.5">
                {data?.scansByDay.map((d) => (
                  <div key={d.date} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-slate-500">{d.date}</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {d.count} scans
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500"
                        style={{ width: `${Math.max(6, (d.count / maxDayCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-violet-500" />
                Device, OS &amp; Browser Breakdown
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400 mb-1.5">
                    Devices
                  </div>
                  {data?.devices.map((item) => (
                    <div key={item.label} className="flex justify-between py-1">
                      <span className="capitalize">{item.label}</span>
                      <span className="font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400 mb-1.5">
                    Operating Systems
                  </div>
                  {data?.operatingSystems.map((item) => (
                    <div key={item.label} className="flex justify-between py-1">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="font-bold uppercase text-[10px] tracking-wider text-slate-400 mb-1.5">
                    Browsers &amp; Regions
                  </div>
                  {data?.browsers.map((item) => (
                    <div key={item.label} className="flex justify-between py-1">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Performance Ranking */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              QR Code Performance Ranking
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2 pr-4">QR Code</th>
                    <th className="py-2 px-4">Type</th>
                    <th className="py-2 px-4">Period Scans</th>
                    <th className="py-2 px-4">All-Time Scans</th>
                    <th className="py-2 pl-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data?.qrRanking.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-4 font-bold text-slate-900 dark:text-white">
                        {r.name} <span className="font-mono text-slate-400 font-normal">(/r/{r.slug})</span>
                      </td>
                      <td className="py-2.5 px-4 uppercase text-[11px]">{r.qrType}</td>
                      <td className="py-2.5 px-4 font-bold text-violet-600 dark:text-violet-400">
                        {r.scans}
                      </td>
                      <td className="py-2.5 px-4">{r.totalAllTimeScans}</td>
                      <td className="py-2.5 pl-4 text-right">
                        <Link
                          href={`/dashboard/qr-codes/${r.id}`}
                          className="text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                        >
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Scan Events Log */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Scan Events Log
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2 pr-4">Timestamp</th>
                    <th className="py-2 px-4">QR Code</th>
                    <th className="py-2 px-4">Device / OS / Browser</th>
                    <th className="py-2 px-4">Region</th>
                    <th className="py-2 px-4">Classification</th>
                    <th className="py-2 pl-4">Resolved Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data?.recentEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-500">
                        {new Date(ev.scannedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-semibold">{ev.qrName}</td>
                      <td className="py-2.5 px-4">
                        {ev.deviceType} &bull; {ev.os} &bull; {ev.browser}
                      </td>
                      <td className="py-2.5 px-4">
                        {ev.country} {ev.region ? `(${ev.region})` : ''}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            ev.isBot
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {ev.isBot ? 'Bot' : 'Human'}
                        </span>
                      </td>
                      <td className="py-2.5 pl-4 truncate max-w-xs text-slate-500">
                        {ev.destinationResolved}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
