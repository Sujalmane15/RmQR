import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentSession } from '@/lib/auth/session';
import {
  appendAuditLog,
  assertOrgAccess,
  assertPlanEntitlement,
  AuthorizationError,
  initializeSupabaseDatabase,
  mutateDb,
  mutateDbAsync,
  readDb,
  readDbAsync,
} from '@/lib/db/store';
import {
  hashPassword,
  sanitizeText,
  validateSafeRedirectUrl,
} from '@/lib/security';
import { getAIProviderStatus } from '@/lib/ai/agent-engine';
import { getSupabaseConfigStatus, importJsonToSupabase } from '@/lib/supabase/server';
import { OrgRole } from '@/lib/types';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = readDb();
    const orgId = session.activeOrg.id;
    assertOrgAccess(db, session.user.id, orgId);

    const members = db.organizationMembers
      .filter((m) => m.organizationId === orgId)
      .map((m) => {
        const user = db.profiles.find((p) => p.id === m.userId);
        return {
          ...m,
          fullName: user?.fullName || 'Invited Member',
        };
      });

    const apiKeys = db.apiKeys
      .filter((k) => k.organizationId === orgId)
      .map(({ keyHash: _omitted, ...safeKey }) => {
        void _omitted;
        return safeKey;
      });

    const webhooks = db.webhookEndpoints.filter((w) => w.organizationId === orgId);
    const auditLogs = db.auditLogs
      .filter((a) => a.organizationId === orgId)
      .slice(0, 60);

    return NextResponse.json({
      profile: session.user,
      organization: session.activeOrg,
      role: session.role,
      members,
      apiKeys,
      webhooks,
      auditLogs,
      supabaseStatus: getSupabaseConfigStatus(),
      aiProviderStatus: getAIProviderStatus(),
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || '';
    const orgId = session.activeOrg.id;

    // 1. Update User Profile
    if (action === 'update_profile') {
      const updatedUser = mutateDb((db) => {
        const p = db.profiles.find((u) => u.id === session.user.id);
        if (!p) throw new AuthorizationError('Profile not found.', 404);
        if (body.fullName) p.fullName = sanitizeText(body.fullName, 80);
        if (body.newPassword && String(body.newPassword).length >= 8) {
          p.passwordHash = hashPassword(String(body.newPassword));
        }
        p.updatedAt = new Date().toISOString();
        const { passwordHash: _omitted, ...safe } = p;
        void _omitted;
        return safe;
      });
      return NextResponse.json({ profile: updatedUser });
    }

    // 2. Update Organization Workspace Settings
    if (action === 'update_organization') {
      const updatedOrg = mutateDb((db) => {
        const { organization } = assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        if (body.name) organization.name = sanitizeText(body.name, 80);
        if (body.industry) organization.industry = sanitizeText(body.industry, 60);
        if (body.brandPrimaryColor)
          organization.brandPrimaryColor = sanitizeText(body.brandPrimaryColor, 16);
        if (body.brandSecondaryColor)
          organization.brandSecondaryColor = sanitizeText(body.brandSecondaryColor, 16);
        if (body.customDomain !== undefined) {
          organization.customDomain = sanitizeText(body.customDomain, 120) || undefined;
        }
        if (body.whiteLabelEnabled !== undefined) {
          organization.whiteLabelEnabled = Boolean(body.whiteLabelEnabled);
        }
        if (body.logoUrl !== undefined) {
          organization.logoUrl = sanitizeText(body.logoUrl, 200000) || undefined;
        }
        organization.updatedAt = new Date().toISOString();

        appendAuditLog(db, {
          organizationId: orgId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'organization.updated',
          entityType: 'organization',
          entityId: orgId,
          metadata: { name: organization.name, customDomain: organization.customDomain },
        });
        return organization;
      });
      return NextResponse.json({ organization: updatedOrg });
    }

    // 3. Invite Team Member
    if (action === 'invite_member') {
      const email = String(body.email || '').toLowerCase().trim();
      const role: OrgRole = ['admin', 'editor', 'viewer'].includes(body.role)
        ? body.role
        : 'viewer';

      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
      }

      const member = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        assertPlanEntitlement(db, orgId, 'teamMembers');

        const existing = db.organizationMembers.find(
          (m) => m.organizationId === orgId && m.invitedEmail.toLowerCase() === email
        );
        if (existing) {
          existing.role = role;
          existing.status = existing.userId ? 'active' : 'invited';
          return existing;
        }

        const existingUser = db.profiles.find((p) => p.email.toLowerCase() === email);
        const newMember = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          userId: existingUser?.id,
          invitedEmail: email,
          role,
          status: existingUser ? ('active' as const) : ('invited' as const),
          createdAt: new Date().toISOString(),
        };
        db.organizationMembers.push(newMember);

        appendAuditLog(db, {
          organizationId: orgId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'member.invited',
          entityType: 'organization_member',
          entityId: newMember.id,
          metadata: { invitedEmail: email, role },
        });

        return newMember;
      });

      return NextResponse.json({ member }, { status: 201 });
    }

    // 4. Update or Remove Team Member
    if (action === 'update_member_role') {
      const memberId = String(body.memberId || '');
      const role = body.role as OrgRole;
      const updated = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        const m = db.organizationMembers.find(
          (item) => item.id === memberId && item.organizationId === orgId
        );
        if (!m) throw new AuthorizationError('Member not found.', 404);
        if (m.role === 'owner') {
          throw new AuthorizationError('Workspace owner role cannot be demoted.', 400);
        }
        m.role = role;
        return m;
      });
      return NextResponse.json({ member: updated });
    }

    if (action === 'remove_member') {
      const memberId = String(body.memberId || '');
      mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        const m = db.organizationMembers.find(
          (item) => item.id === memberId && item.organizationId === orgId
        );
        if (!m) throw new AuthorizationError('Member not found.', 404);
        if (m.role === 'owner') {
          throw new AuthorizationError('Cannot remove the workspace owner.', 400);
        }
        db.organizationMembers = db.organizationMembers.filter((item) => item.id !== memberId);
      });
      return NextResponse.json({ ok: true });
    }

    // 5. Create Scoped REST API Key
    if (action === 'create_api_key') {
      const name = sanitizeText(body.name || 'Production Key', 60);
      const scopes = Array.isArray(body.scopes) ? body.scopes : ['qr:read', 'qr:write'];
      const rawPlainKey = `rmqr_live_${crypto.randomBytes(18).toString('hex')}`;
      const keyPrefix = rawPlainKey.slice(0, 16);
      const keyHash = crypto.createHash('sha256').update(rawPlainKey).digest('hex');

      const record = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        const newKey = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          name,
          keyPrefix,
          keyHash,
          scopes,
          lastUsedAt: null,
          expiresAt: null,
          revokedAt: null,
          createdBy: session.user.id,
          createdAt: new Date().toISOString(),
        };
        db.apiKeys.unshift(newKey);
        appendAuditLog(db, {
          organizationId: orgId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'api_key.created',
          entityType: 'api_key',
          entityId: newKey.id,
          metadata: { name, keyPrefix, scopes },
        });
        return newKey;
      });

      return NextResponse.json(
        {
          apiKey: { ...record, keyHash: undefined },
          plainTextSecret: rawPlainKey,
        },
        { status: 201 }
      );
    }

    // 6. Revoke API Key
    if (action === 'revoke_api_key') {
      const keyId = String(body.keyId || '');
      mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        const key = db.apiKeys.find((k) => k.id === keyId && k.organizationId === orgId);
        if (!key) throw new AuthorizationError('API key not found.', 404);
        key.revokedAt = new Date().toISOString();
        appendAuditLog(db, {
          organizationId: orgId,
          actorId: session.user.id,
          actorEmail: session.user.email,
          action: 'api_key.revoked',
          entityType: 'api_key',
          entityId: key.id,
        });
      });
      return NextResponse.json({ ok: true });
    }

    // 7. Create Webhook Endpoint
    if (action === 'create_webhook') {
      const urlCheck = validateSafeRedirectUrl(body.url);
      if (!urlCheck.valid || !urlCheck.sanitizedUrl) {
        return NextResponse.json({ error: 'Valid HTTPS webhook URL is required.' }, { status: 400 });
      }
      const wh = mutateDb((db) => {
        assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
        const endpoint = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          url: urlCheck.sanitizedUrl!,
          secret: `whsec_${crypto.randomBytes(16).toString('hex')}`,
          events: Array.isArray(body.events) ? body.events : ['qr.scanned', 'qr.updated'],
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        db.webhookEndpoints.unshift(endpoint);
        return endpoint;
      });
      return NextResponse.json({ webhook: wh }, { status: 201 });
    }

    // 8. Idempotent JSON-to-Supabase PostgreSQL Migration / Dry-Run
    if (action === 'migrate_json_to_supabase') {
      const db = await readDbAsync();
      assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
      const dryRun = body.dryRun !== false;
      const includeDemoAccounts = body.includeDemoAccounts === true || body.includeDemoUsers === true;
      const report = await importJsonToSupabase({
        db,
        dryRun,
        includeDemoAccounts,
      });

      if (!dryRun) {
        await mutateDbAsync((state) => {
          appendAuditLog(state, {
            organizationId: orgId,
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: 'database.supabase_migrated',
            entityType: 'database',
            entityId: orgId,
            metadata: {
              dryRun: false,
              counts: report.counts,
              warningsCount: report.warnings.length,
            },
          });
        });
      }

      return NextResponse.json({ report });
    }

    // 9. Guarded Supabase Database Initialization
    if (action === 'initialize_supabase') {
      const db = await readDbAsync();
      assertOrgAccess(db, session.user.id, orgId, ['owner', 'admin']);
      const confirmed = body.confirmed === true;
      const initResult = await initializeSupabaseDatabase({
        confirmed,
        sourceDb: db,
      });
      return NextResponse.json(initResult, { status: initResult.ok ? 200 : 400 });
    }

    return NextResponse.json({ error: 'Unsupported settings action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: 'Settings update failed.' }, { status: 500 });
  }
}
