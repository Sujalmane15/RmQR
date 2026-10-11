'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  QRCodeRecord,
  QRDestinationHistory,
  QRRoutingRule,
  QRScanEvent,
  QRStatus,
} from '@/lib/types';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Save,
  Shield,
  Smartphone,
} from 'lucide-react';

export default function QRCodeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [qr, setQr] = useState<QRCodeRecord | null>(null);
  const [destinations, setDestinations] = useState<QRDestinationHistory[]>([]);
  const [scanEvents, setScanEvents] = useState<QRScanEvent[]>([]);
  const [name, setName] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [status, setStatus] = useState<QRStatus>('active');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  const [routingRules, setRoutingRules] = useState<QRRoutingRule[]>([]);
  const [newRuleDevice, setNewRuleDevice] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [newRuleUrl, setNewRuleUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/qr-codes/${id}`);
      if (!res.ok) {
        setError('QR code not found or unauthorized.');
        return;
      }
      const data = await res.json();
      const record: QRCodeRecord = data.qrCode;
      setQr(record);
      setName(record.name);
      setDestinationUrl(record.destinationUrl || '');
      setStatus(record.status);
      setFallbackUrl(record.fallbackUrl || '');
      setExpiresAt(record.expiresAt ? record.expiresAt.slice(0, 10) : '');
      setRoutingRules(record.routingRules || []);
      setDestinations(data.destinations || []);
      setScanEvents(data.scanEvents || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qr) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);

    try {
      const payload: Record<string, unknown> = {
        name,
        status,
        fallbackUrl,
        expiresAt: expiresAt || null,
        routingRules,
      };
      if (qr.qrType === 'dynamic') {
        payload.destinationUrl = destinationUrl;
      }
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await fetch(`/api/qr-codes/${qr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update QR code.');
      } else {
        setSavedNotice(
          'Destination and settings updated! Notice that your printed QR code matrix (/r/' +
            qr.slug +
            ') remains 100% unchanged.'
        );
        setPassword('');
        loadDetail();
      }
    } catch {
      setError('Network error while saving changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRoutingRule = () => {
    if (!newRuleUrl.trim()) return;
    setRoutingRules([
      ...routingRules,
      {
        id: Math.random().toString(36).slice(2, 9),
        type: 'device',
        condition: newRuleDevice,
        destinationUrl: newRuleUrl.trim(),
      },
    ]);
    setNewRuleUrl('');
  };

  if (loading) {
    return <div className="py-12 text-center text-xs text-slate-500">Loading QR code details...</div>;
  }

  if (!qr) {
    return (
      <div className="rounded-3xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-8 text-center space-y-4">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">
          {error || 'QR code not found.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/qr-codes')}
          className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
        >
          Back to QR Codes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/qr-codes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to QR Codes
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {qr.name}
            </h1>
            <span className="rounded-full bg-violet-500/15 px-3 py-0.5 text-xs font-bold uppercase text-violet-600 dark:text-violet-300">
              {qr.qrType}
            </span>
          </div>
        </div>

        {qr.qrType === 'dynamic' && (
          <a
            href={`/r/${qr.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="test-redirect-link"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm"
          >
            Test Live Redirect (/r/{qr.slug}) <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="detail-error"
          className="flex items-center gap-2 rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedNotice && (
        <div
          role="status"
          data-testid="detail-saved-notice"
          className="flex items-center gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 p-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Edit Destination, Status, Expiry & Smart Routing */}
        <form onSubmit={handleSaveChanges} className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              QR Configuration &amp; Live Destination
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-qr-name" className="block text-xs font-semibold mb-1">
                  QR Code Name
                </label>
                <input
                  id="edit-qr-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="edit-qr-status" className="block text-xs font-semibold mb-1">
                  QR Status
                </label>
                <select
                  id="edit-qr-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QRStatus)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                >
                  <option value="active">Active (Redirecting)</option>
                  <option value="paused">Paused (Shows Paused Notice)</option>
                  <option value="expired">Expired (Shows Expired / Fallback)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {qr.qrType === 'dynamic' ? (
              <div>
                <label htmlFor="edit-qr-dest" className="block text-xs font-semibold mb-1">
                  Target Destination URL (Editable anytime without reprinting)
                </label>
                <input
                  id="edit-qr-dest"
                  type="text"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-medium"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Printed QR encodes <code className="font-mono">{qr.encodedContent}</code> permanently.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-500">
                Static QR Payload (Read-Only): <code className="font-mono">{qr.encodedContent}</code>
              </div>
            )}

            {qr.qrType === 'dynamic' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-violet-500" /> Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Fallback URL</label>
                  <input
                    type="url"
                    value={fallbackUrl}
                    onChange={(e) => setFallbackUrl(e.target.value)}
                    placeholder="https://fallback.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" /> Set New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={qr.passwordHash ? 'Protected (Enter to change)' : 'No password'}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Smart Device-Based Multi-URL Routing Rules */}
            {qr.qrType === 'dynamic' && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-violet-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Smart Device-Based Routing Rules (Optional)
                  </h3>
                </div>
                {routingRules.length > 0 && (
                  <div className="space-y-2">
                    {routingRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800"
                      >
                        <span>
                          <strong className="uppercase text-violet-500">{rule.condition}</strong> &rarr;{' '}
                          {rule.destinationUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRoutingRules(routingRules.filter((r) => r.id !== rule.id))
                          }
                          className="text-red-500 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newRuleDevice}
                    onChange={(e) =>
                      setNewRuleDevice(e.target.value as 'ios' | 'android' | 'desktop')
                    }
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="ios">iOS (iPhone/iPad)</option>
                    <option value="android">Android</option>
                    <option value="desktop">Desktop</option>
                  </select>
                  <input
                    type="url"
                    value={newRuleUrl}
                    onChange={(e) => setNewRuleUrl(e.target.value)}
                    placeholder="https://apps.apple.com/..."
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddRoutingRule}
                    className="rounded-xl border border-violet-500/40 px-3 py-2 text-xs font-bold text-violet-600 dark:text-violet-400"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              data-testid="save-qr-changes-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-sm font-bold text-white shadow-md shadow-violet-600/25"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save QR Changes'}
            </button>
          </div>

          {/* Destination Change Audit History */}
          {qr.qrType === 'dynamic' && (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-4 w-4 text-violet-500" />
                Destination Version History ({destinations.length})
              </h3>
              <div className="space-y-2 text-xs">
                {destinations.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                  >
                    <span className="font-mono truncate max-w-md">{d.destinationUrl}</span>
                    <span className="text-[11px] text-slate-400">
                      {d.isActive ? 'Current Active' : new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Right: Immutable Printed QR Image & Recent Scan Telemetry */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Printed QR Matrix
            </h2>
            <QRPreviewCard
              content={qr.encodedContent}
              name={qr.name}
              styleConfig={qr.styleConfig}
              size={220}
            />
            <div className="text-xs text-slate-500 space-y-1">
              <div>
                <strong>Encoded String:</strong>{' '}
                <code className="font-mono text-slate-700 dark:text-slate-300" data-testid="encoded-qr-string">
                  {qr.encodedContent}
                </code>
              </div>
              <div>
                <strong>Total Scans:</strong> {qr.scanCount || 0} ({qr.humanScanCount || 0} human)
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Persisted Scan Events ({scanEvents.length})
            </h3>
            {scanEvents.length === 0 ? (
              <p className="text-xs text-slate-500">
                No scans recorded yet. Click &ldquo;Test Live Redirect&rdquo; above or scan the QR with your phone!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                {scanEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {ev.deviceType} &bull; {ev.os} &bull; {ev.browser}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        &rarr; {ev.destinationResolved}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ev.isBot
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-emerald-500/15 text-emerald-500'
                        }`}
                      >
                        {ev.isBot ? 'Bot/Preview' : 'Human'}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(ev.scannedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
