'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderKanban,
  PackageCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import { QRCodeRecord } from '@/lib/types';

interface CampaignWithStats {
  id: string;
  name: string;
  description: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: string;
  qrCount: number;
  totalScans: number;
  humanScans: number;
}

export default function CampaignsAndBulkPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [selectedQrIds, setSelectedQrIds] = useState<string[]>([]);

  // New Campaign State
  const [campName, setCampName] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [utmSource, setUtmSource] = useState('qr_code');
  const [utmMedium, setUtmMedium] = useState('print');
  const [utmCampaign, setUtmCampaign] = useState('');

  // Bulk Import State
  const [bulkMode, setBulkMode] = useState<'csv' | 'urls'>('csv');
  const [bulkText, setBulkText] = useState(
    `name,destination_url,slug,qr_type,tags,description\nPatio Table 1,https://example.com/menu?t=1,patio-table-1,dynamic,"menu,patio",Table 1 standee\nPatio Table 2,https://example.com/menu?t=2,patio-table-2,dynamic,"menu,patio",Table 2 standee`
  );
  const [bulkErrors, setBulkErrors] = useState<Array<{ rowNumber: number; field: string; message: string }>>([]);
  const [bulkWarnings, setBulkWarnings] = useState<Array<{ rowNumber: number; message: string }>>([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState<number | null>(null);
  const [zipLoading, setZipLoading] = useState(false);

  const loadData = async () => {
    const [campRes, qrRes] = await Promise.all([
      fetch('/api/campaigns'),
      fetch('/api/qr-codes'),
    ]);
    if (campRes.ok) {
      const d = await campRes.json();
      setCampaigns(d.campaigns || []);
    }
    if (qrRes.ok) {
      const q = await qrRes.json();
      setQrCodes(q.qrCodes || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) return;
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campName,
        description: campDesc,
        utmSource,
        utmMedium,
        utmCampaign: utmCampaign || campName.toLowerCase().replace(/\s+/g, '_'),
      }),
    });
    if (res.ok) {
      setCampName('');
      setCampDesc('');
      setUtmCampaign('');
      loadData();
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' });
    loadData();
  };

  const handleBulkSubmit = async (action: 'validate' | 'import') => {
    setBulkErrors([]);
    setBulkWarnings([]);
    setBulkSuccessCount(null);

    const res = await fetch('/api/bulk-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        mode: bulkMode,
        rawText: bulkText,
      }),
    });
    const data = await res.json();
    if (data.errors?.length) {
      setBulkErrors(data.errors);
    }
    if (data.duplicateWarnings?.length) {
      setBulkWarnings(data.duplicateWarnings);
    }
    if (action === 'import' && res.ok) {
      setBulkSuccessCount(data.createdCount || 0);
      loadData();
    }
  };

  const handleDownloadZip = async () => {
    const targetIds =
      selectedQrIds.length > 0 ? selectedQrIds : qrCodes.slice(0, 10).map((q) => q.id);
    if (targetIds.length === 0) return;

    setZipLoading(true);
    try {
      const res = await fetch('/api/bulk-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'zip',
          qrIds: targetIds,
        }),
      });
      const data = await res.json();
      if (res.ok && data.zipBase64) {
        const a = document.createElement('a');
        a.href = `data:application/zip;base64,${data.zipBase64}`;
        a.download = data.fileName || 'rmqr-batch.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Marketing Campaigns &amp; Bulk QR Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Organize UTM-tracked QR campaigns, import CSV batches with row-level validation, and export ZIP archives.
        </p>
      </div>

      {/* SECTION 1: CAMPAIGN MANAGER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleCreateCampaign}
          className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-violet-500" />
            Create UTM Campaign
          </h2>

          <div>
            <label className="block text-xs font-semibold mb-1">Campaign Name *</label>
            <input
              type="text"
              required
              value={campName}
              onChange={(e) => setCampName(e.target.value)}
              placeholder="Diwali Table Tent Promo 2026"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <input
              type="text"
              value={campDesc}
              onChange={(e) => setCampDesc(e.target.value)}
              placeholder="Tracks scans across 20 retail stores"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold mb-1">utm_source</label>
              <input
                type="text"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">utm_medium</label>
              <input
                type="text"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1">utm_campaign</label>
              <input
                type="text"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="summer_26"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Create Campaign
          </button>
        </form>

        <div className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Active Campaigns ({campaigns.length})
          </h2>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</div>
                  <p className="text-xs text-slate-500">{c.description}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono text-violet-600 dark:text-violet-400">
                    {c.utmSource && <span>utm_source={c.utmSource}</span>}
                    {c.utmMedium && <span>utm_medium={c.utmMedium}</span>}
                    {c.utmCampaign && <span>utm_campaign={c.utmCampaign}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {c.totalScans} scans
                    </div>
                    <div className="text-[11px] text-slate-400">{c.qrCount} linked QRs</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(c.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: BULK CSV / URL GENERATION & ZIP EXPORT */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              Bulk QR Creation (CSV or Pasted URLs) &amp; ZIP Archive Download
            </h2>
            <p className="text-xs text-slate-500">
              Row-level safe URL validation and duplicate slug/destination detection
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/api/bulk-qr"
              download="rmqr-bulk-template.csv"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV Template
            </a>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={zipLoading || qrCodes.length === 0}
              data-testid="download-zip-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <PackageCheck className="h-4 w-4" />
              {zipLoading ? 'Building ZIP...' : `Download QR Batch ZIP (${selectedQrIds.length || Math.min(10, qrCodes.length)} codes)`}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBulkMode('csv')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${
              bulkMode === 'csv'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            CSV Format
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkMode('urls');
              setBulkText('https://example.com/store-1\nhttps://example.com/store-2');
            }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${
              bulkMode === 'urls'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Paste Raw URLs (One per line)
          </button>
        </div>

        <textarea
          rows={5}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 font-mono text-xs text-slate-900 dark:text-white"
        />

        {bulkErrors.length > 0 && (
          <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 space-y-1 text-xs text-red-700 dark:text-red-300">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Row Validation Errors:
            </div>
            {bulkErrors.map((err, i) => (
              <div key={i}>
                Row {err.rowNumber} ({err.field}): {err.message}
              </div>
            ))}
          </div>
        )}

        {bulkWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-1 text-xs text-amber-800 dark:text-amber-200">
            <div className="font-bold">Duplicate Detection Notices:</div>
            {bulkWarnings.map((w, i) => (
              <div key={i}>
                Row {w.rowNumber}: {w.message}
              </div>
            ))}
          </div>
        )}

        {bulkSuccessCount !== null && (
          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 p-4 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Successfully generated and persisted {bulkSuccessCount} QR codes!
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleBulkSubmit('validate')}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold"
          >
            Validate Rows Only
          </button>
          <button
            type="button"
            onClick={() => handleBulkSubmit('import')}
            data-testid="bulk-import-btn"
            className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white"
          >
            Validate &amp; Generate Batch QR Codes
          </button>
        </div>
      </div>
    </div>
  );
}
