'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { AuditLog, SupportTicket } from '@/lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  History,
  MessageSquare,
  ShieldAlert,
  Users,
} from 'lucide-react';

interface AdminConsolePayload {
  summary: {
    totalUsers: number;
    totalOrganizations: number;
    totalQrCodes: number;
    totalDynamicQrCodes: number;
    totalScanEvents: number;
    openSupportTickets: number;
    suspendedOrgs: number;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    industry: string;
    status: 'active' | 'suspended';
    planId: string;
    qrCount: number;
    scanCount: number;
    memberCount: number;
  }>;
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
    createdAt: string;
  }>;
  supportTickets: SupportTicket[];
  auditLogs: AuditLog[];
}

export default function AdminPortalPage() {
  const [data, setData] = useState<AdminConsolePayload | null>(null);
  const [errorStatus, setErrorStatus] = useState<{ code: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin');
      const json = await res.json();
      if (!res.ok) {
        setErrorStatus({ code: res.status, message: json.error || 'Access denied.' });
      } else {
        setData(json);
        setErrorStatus(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const handleToggleOrgSuspension = async (orgId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_org_status',
        organizationId: orgId,
        status: nextStatus,
      }),
    });
    loadAdmin();
  };

  const handleUpdateTicketStatus = async (
    ticketId: string,
    status: 'open' | 'in_progress' | 'resolved'
  ) => {
    await fetch('/api/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_ticket_status',
        ticketId,
        status,
      }),
    });
    loadAdmin();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white">
        <p className="text-xs text-slate-400">Verifying System Administrator authorization...</p>
      </div>
    );
  }

  if (errorStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6">
        <div
          data-testid="admin-access-denied"
          className="max-w-md w-full rounded-3xl border border-red-500/40 bg-slate-900 p-8 text-center space-y-4"
        >
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
            HTTP {errorStatus.code} Forbidden
          </span>
          <h1 className="text-2xl font-extrabold">Administrator Privileges Required</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{errorStatus.message}</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200"
            >
              Return to Dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white"
            >
              Sign In as System Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-white">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1322] px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandLogo size="md" />
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-500 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> System Admin Console
            </span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Platform Aggregate Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Organizations</span>
            <div className="text-2xl font-extrabold mt-1">{data?.summary.totalOrganizations}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Registered Users</span>
            <div className="text-2xl font-extrabold mt-1">{data?.summary.totalUsers}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Total QR Codes</span>
            <div className="text-2xl font-extrabold mt-1 text-violet-500">
              {data?.summary.totalQrCodes}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Total Persisted Scans</span>
            <div className="text-2xl font-extrabold mt-1 text-emerald-500">
              {data?.summary.totalScanEvents}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Open Support Tickets</span>
            <div className="text-2xl font-extrabold mt-1 text-amber-500">
              {data?.summary.openSupportTickets}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <span className="text-[11px] text-slate-400">Suspended Accounts</span>
            <div className="text-2xl font-extrabold mt-1 text-red-500">
              {data?.summary.suspendedOrgs}
            </div>
          </div>
        </div>

        {/* Organization Management & Account Suspension/Restoration */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            Tenant Organizations &amp; Abuse Suspension Controls
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                  <th className="py-2 pr-4">Organization</th>
                  <th className="py-2 px-4">Plan</th>
                  <th className="py-2 px-4">QRs / Scans</th>
                  <th className="py-2 px-4">Members</th>
                  <th className="py-2 px-4">Status</th>
                  <th className="py-2 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data?.organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="py-3 pr-4">
                      <div className="font-bold">{org.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{org.slug}</div>
                    </td>
                    <td className="py-3 px-4 uppercase font-bold text-violet-500">{org.planId}</td>
                    <td className="py-3 px-4">
                      {org.qrCount} QRs &bull; {org.scanCount} scans
                    </td>
                    <td className="py-3 px-4">{org.memberCount}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          org.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-red-500/15 text-red-500'
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleOrgSuspension(org.id, org.status)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                          org.status === 'active'
                            ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                            : 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                        }`}
                      >
                        {org.status === 'active' ? 'Suspend Workspace' : 'Restore Workspace'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Support Ticket Queue */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500" />
            Support Request Queue ({data?.supportTickets.length || 0})
          </h2>
          {!data?.supportTickets || data.supportTickets.length === 0 ? (
            <p className="text-xs text-slate-500">No support requests submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {data.supportTickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold">
                      {t.subject} — <span className="text-violet-500">{t.name} ({t.email})</span>
                    </div>
                    <p className="text-slate-500">{t.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        handleUpdateTicketStatus(
                          t.id,
                          e.target.value as 'open' | 'in_progress' | 'resolved'
                        )
                      }
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-bold"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Audit History */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-500" />
            Global Platform Audit Log
          </h2>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                  <th className="py-2 pr-4">Timestamp</th>
                  <th className="py-2 px-4">Actor</th>
                  <th className="py-2 px-4">Action</th>
                  <th className="py-2 pl-4">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {data?.auditLogs.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-4 font-mono text-[11px] text-slate-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">{a.actorEmail}</td>
                    <td className="py-2 px-4 font-mono font-bold text-violet-500">{a.action}</td>
                    <td className="py-2 pl-4 text-slate-400">
                      {a.entityType} ({a.entityId.slice(0, 8)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
