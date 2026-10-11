'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Campaign, QRCodeRecord, QRFolder } from '@/lib/types';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  Archive,
  Copy,
  ExternalLink,
  FolderPlus,
  Pause,
  Play,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';

function QRCodesListInner() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [qrCodes, setQrCodes] = useState<QRCodeRecord[]>([]);
  const [folders, setFolders] = useState<QRFolder[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadQRCodes = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        search,
        status: statusFilter,
        qrType: typeFilter,
        folderId: folderFilter,
        campaignId: campaignFilter,
      });
      const res = await fetch(`/api/qr-codes?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQrCodes(data.qrCodes || []);
        setFolders(data.folders || []);
        setCampaigns(data.campaigns || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, folderFilter, campaignFilter]);

  useEffect(() => {
    loadQRCodes();
  }, [loadQRCodes]);

  const handleToggleStatus = async (qr: QRCodeRecord) => {
    const nextStatus = qr.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/qr-codes/${qr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    loadQRCodes();
  };

  const handleDuplicate = async (qr: QRCodeRecord) => {
    await fetch(`/api/qr-codes/${qr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    });
    loadQRCodes();
  };

  const handleArchiveToggle = async (qr: QRCodeRecord) => {
    const nextStatus = qr.status === 'archived' ? 'active' : 'archived';
    await fetch(`/api/qr-codes/${qr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    loadQRCodes();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/qr-codes/${id}`, { method: 'DELETE' });
    loadQRCodes();
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName }),
    });
    if (res.ok) {
      setNewFolderName('');
      setShowFolderInput(false);
      loadQRCodes();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            QR Codes Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage static and dynamic QR codes, update live destinations, and organize folders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFolderInput(!showFolderInput)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Bulk CSV &amp; Campaigns
          </Link>
          <Link
            href="/dashboard/qr-codes/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25"
          >
            <Plus className="h-4 w-4" />
            Create QR Code
          </Link>
        </div>
      </div>

      {showFolderInput && (
        <form
          onSubmit={handleCreateFolder}
          className="flex items-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter folder name (e.g., Tabletop Standees)"
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
          >
            Save Folder
          </button>
        </form>
      )}

      {/* Search and Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, slug, URL..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <select
          aria-label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="all">All Active/Paused/Expired</option>
          <option value="active">Active Only</option>
          <option value="paused">Paused Only</option>
          <option value="expired">Expired Only</option>
          <option value="archived">Archived</option>
        </select>

        <select
          aria-label="Filter by QR Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="all">Static &amp; Dynamic</option>
          <option value="dynamic">Dynamic QR Only</option>
          <option value="static">Static QR Only</option>
        </select>

        <select
          aria-label="Filter by Folder"
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="all">All Folders</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              Folder: {f.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Campaign"
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="all">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              Campaign: {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* QR Code Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading QR codes...</div>
      ) : qrCodes.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 py-14 text-center space-y-3">
          <QrCode className="h-10 w-10 text-slate-400 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            No matching QR codes found
          </h2>
          <p className="text-xs text-slate-500">
            Create a new static or dynamic QR code in the Studio.
          </p>
          <Link
            href="/dashboard/qr-codes/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Launch QR Studio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {qrCodes.map((qr) => (
            <div
              key={qr.id}
              data-testid={`qr-card-${qr.slug}`}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 flex flex-col sm:flex-row gap-6 justify-between shadow-sm"
            >
              <div className="shrink-0 flex justify-center">
                <QRPreviewCard
                  content={qr.encodedContent}
                  name={qr.name}
                  styleConfig={qr.styleConfig}
                  size={140}
                  showReliabilityReport={false}
                />
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-4 min-w-0">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        qr.qrType === 'dynamic'
                          ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                          : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {qr.qrType}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        qr.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : qr.status === 'paused'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {qr.status}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 uppercase">
                      {qr.contentType}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {qr.name}
                  </h2>

                  {qr.qrType === 'dynamic' ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <span>Short Link:</span>
                        <a
                          href={`/r/${qr.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-semibold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
                        >
                          /r/{qr.slug} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 truncate">
                        <span className="text-slate-400">Redirects to: </span>
                        <span className="font-medium" data-testid={`qr-dest-${qr.slug}`}>
                          {qr.destinationUrl}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 truncate">
                      Encoded directly: {qr.encodedContent}
                    </div>
                  )}

                  {qr.qrType === 'dynamic' && (
                    <div className="pt-1 flex items-center gap-4 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {qr.scanCount || 0}
                        </span>{' '}
                        <span className="text-slate-400">total scans</span>
                      </div>
                      <div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {qr.humanScanCount || 0}
                        </span>{' '}
                        <span className="text-slate-400">human scans</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/qr-codes/${qr.id}`}
                    data-testid={`manage-qr-${qr.slug}`}
                    className="rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-1.5 text-xs font-bold text-white"
                  >
                    Edit &amp; Details
                  </Link>

                  {qr.qrType === 'dynamic' && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(qr)}
                      data-testid={`toggle-status-${qr.slug}`}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {qr.status === 'active' ? (
                        <>
                          <Pause className="h-3.5 w-3.5 text-amber-500" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 text-emerald-500" /> Activate
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDuplicate(qr)}
                    title="Duplicate QR"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleArchiveToggle(qr)}
                    title={qr.status === 'archived' ? 'Restore' : 'Archive'}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {qr.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(qr.id)}
                    title="Delete QR"
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 dark:border-red-900/50 p-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QRCodesListPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading QR codes...</div>}>
      <QRCodesListInner />
    </Suspense>
  );
}

