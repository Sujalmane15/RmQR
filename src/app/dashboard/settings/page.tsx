'use client';

import React, { useEffect, useState } from 'react';
import {
  ApiKeyRecord,
  AuditLog,
  Organization,
  OrganizationMember,
  OrgRole,
  WebhookEndpoint,
} from '@/lib/types';
import {
  Building2,
  CheckCircle2,
  History,
  Key,
  Plus,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';

export default function SettingsDashboardPage() {
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgIndustry, setOrgIndustry] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [whiteLabel, setWhiteLabel] = useState(false);

  const [members, setMembers] = useState<Array<OrganizationMember & { fullName?: string }>>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('editor');

  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedPlainSecret, setGeneratedPlainSecret] = useState<string | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSettings = async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      setFullName(data.profile?.fullName || '');
      setOrg(data.organization || null);
      setOrgName(data.organization?.name || '');
      setOrgIndustry(data.organization?.industry || '');
      setCustomDomain(data.organization?.customDomain || '');
      setWhiteLabel(Boolean(data.organization?.whiteLabelEnabled));
      setMembers(data.members || []);
      setApiKeys(data.apiKeys || []);
      setWebhooks(data.webhooks || []);
      setAuditLogs(data.auditLogs || []);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_profile',
        fullName,
        newPassword: newPassword || undefined,
      }),
    });
    if (res.ok) {
      setNewPassword('');
      setNotice('User profile updated.');
      loadSettings();
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_organization',
        name: orgName,
        industry: orgIndustry,
        customDomain,
        whiteLabelEnabled: whiteLabel,
      }),
    });
    if (res.ok) {
      setNotice('Workspace settings saved.');
      loadSettings();
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite_member',
        email: inviteEmail,
        role: inviteRole,
      }),
    });
    if (res.ok) {
      setInviteEmail('');
      setNotice('Workspace member added / invited.');
      loadSettings();
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_api_key',
        name: newKeyName,
        scopes: ['qr:read', 'qr:write', 'analytics:read'],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedPlainSecret(data.plainTextSecret);
      setNewKeyName('');
      loadSettings();
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke_api_key', keyId }),
    });
    loadSettings();
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_webhook',
        url: newWebhookUrl,
        events: ['qr.scanned', 'qr.updated'],
      }),
    });
    if (res.ok) {
      setNewWebhookUrl('');
      setNotice('Webhook endpoint registered.');
      loadSettings();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Workspace Settings, Team RBAC &amp; Developer API
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your user profile, organization branding, team roles, scoped REST API keys, webhooks, and audit logs
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Personal Profile &amp; Security
          </h2>
          <div>
            <label className="block text-xs font-semibold mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Change Password (Optional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white"
          >
            Update Profile
          </button>
        </form>

        {/* Organization & Custom Domain */}
        <form
          onSubmit={handleSaveOrg}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            Organization &amp; Custom Domain ({org?.slug})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Industry</label>
              <input
                type="text"
                value={orgIndustry}
                onChange={(e) => setOrgIndustry(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Custom Short Domain (CNAME Target: cname.rmqr.app)
            </label>
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="qr.yourbrand.com"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono"
            />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={whiteLabel}
              onChange={(e) => setWhiteLabel(e.target.checked)}
            />
            <span>Enable White-Label Public Pages (Hide RMQR footer badge)</span>
          </label>

          <button
            type="submit"
            className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white"
          >
            Save Workspace Settings
          </button>
        </form>
      </div>

      {/* Team Members & RBAC Roles */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-500" />
          Workspace Team Members &amp; Role-Based Access Control (RBAC)
        </h2>

        <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="teammate@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as OrgRole)}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          >
            <option value="admin">Administrator (Full Access)</option>
            <option value="editor">Editor (Create/Edit QRs &amp; Menus)</option>
            <option value="viewer">Viewer (Read-Only Analytics)</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Invite Member
          </button>
        </form>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {m.invitedEmail}
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: {m.status} &bull; Role: <strong className="uppercase">{m.role}</strong>
                </div>
              </div>
              <span className="rounded-full bg-violet-500/15 px-3 py-0.5 text-[10px] font-bold uppercase text-violet-500">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* REST API Keys & Webhooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="h-4 w-4 text-emerald-500" />
            Scoped REST API Keys
          </h2>

          <form onSubmit={handleCreateApiKey} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Key Label (e.g., POS Integration)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white"
            >
              Generate Key
            </button>
          </form>

          {generatedPlainSecret && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs space-y-1">
              <div className="font-bold text-emerald-500">
                Copy your new API Key now (shown only once):
              </div>
              <code className="block font-mono break-all text-slate-900 dark:text-white">
                {generatedPlainSecret}
              </code>
            </div>
          )}

          <div className="space-y-2 text-xs">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3"
              >
                <div>
                  <div className="font-bold">{k.name}</div>
                  <div className="font-mono text-[11px] text-slate-400">
                    {k.keyPrefix}... &bull; {k.scopes.join(', ')}
                  </div>
                </div>
                {k.revokedAt ? (
                  <span className="text-red-500 font-bold text-[11px]">Revoked</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRevokeApiKey(k.id)}
                    className="text-red-500 font-semibold hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Webhook className="h-4 w-4 text-cyan-500" />
            Scan Event Webhooks
          </h2>
          <form onSubmit={handleCreateWebhook} className="flex gap-2">
            <input
              type="url"
              required
              placeholder="https://api.yourcompany.com/webhooks/rmqr"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white"
            >
              Add Webhook
            </button>
          </form>

          <div className="space-y-2 text-xs">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1"
              >
                <div className="font-mono font-bold truncate">{wh.url}</div>
                <div className="text-[11px] text-slate-400">
                  Events: {wh.events.join(', ')} &bull; Signing Secret: {wh.secret.slice(0, 12)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workspace Audit Log */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="h-4 w-4 text-violet-500" />
          Workspace Security &amp; Audit Trail ({auditLogs.length})
        </h2>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                <th className="py-2 pr-4">Timestamp</th>
                <th className="py-2 px-4">Actor</th>
                <th className="py-2 px-4">Action</th>
                <th className="py-2 pl-4">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 font-mono text-[11px] text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 px-4">{log.actorEmail}</td>
                  <td className="py-2 px-4 font-mono font-semibold text-violet-500">
                    {log.action}
                  </td>
                  <td className="py-2 pl-4 text-slate-500">
                    {log.entityType} ({log.entityId.slice(0, 8)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
