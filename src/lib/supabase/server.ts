// =============================================================================
// RMQR — Server-Only Supabase PostgreSQL Client, Relational Sync & Safe Importer
// Keeps SUPABASE_SERVICE_ROLE_KEY strictly on the server. Never expose to browser.
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from '../db/store';

export interface SupabaseStatusInfo {
  configured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  projectHost: string | null;
  storageMode: 'supabase_postgres' | 'local_json_fallback';
  statusMessage: string;
}

export interface SupabaseImportReport {
  dryRun: boolean;
  configured: boolean;
  executed: boolean;
  skippedDemoAccounts: string[];
  counts: {
    organizations: number;
    profiles: number;
    qrCodes: number;
    reviewCampaigns: number;
    reviewReplies: number;
    customerReviewSessions: number;
    menus: number;
    landingPages: number;
    aiAgents: number;
  };
  warnings: string[];
  error?: string;
}

const PLACEHOLDER_PATTERNS = [
  /your-project/i,
  /example\.supabase\.co/i,
  /placeholder/i,
  /^<.*>$/,
  /^your_/i,
];

function isRealValue(val: string | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length < 10) return false;
  return !PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}

export function getSupabaseServerUrl(): string {
  const raw = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  if (!isRealValue(raw)) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

export function getSupabaseServerAnonKey(): string {
  const raw = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return isRealValue(raw) ? raw : '';
}

export function getSupabaseServiceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security violation: SUPABASE_SERVICE_ROLE_KEY must never be accessed in browser code.'
    );
  }
  const raw = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return isRealValue(raw) ? raw : '';
}

export function getSupabaseConfigStatus(): SupabaseStatusInfo {
  const url = getSupabaseServerUrl();
  const anonKey = getSupabaseServerAnonKey();
  const serviceKey = typeof window === 'undefined' ? getSupabaseServiceRoleKey() : '';

  let projectHost: string | null = null;
  if (url) {
    try {
      projectHost = new URL(url).host;
    } catch {
      projectHost = null;
    }
  }

  const configured = Boolean(url && (serviceKey || anonKey));
  return {
    configured,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceKey),
    projectHost,
    storageMode: configured ? 'supabase_postgres' : 'local_json_fallback',
    statusMessage: configured
      ? `Connected to Supabase PostgreSQL (${projectHost})${
          serviceKey ? ' with server-side service role' : ' with publishable/anon key'
        }.`
      : 'Supabase credentials are not configured in environment (.env.local). Running in local JSON/memory fallback mode.',
  };
}

let cachedAdminClient: SupabaseClient | null = null;
let cachedAnonClient: SupabaseClient | null = null;
let cachedClientUrl = '';

/**
 * Returns a server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY when available,
 * or falls back to SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY.
 */
export function getSupabaseServerClient(options?: {
  requireServiceRole?: boolean;
}): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security violation: getSupabaseServerClient() must only be called on the server.'
    );
  }

  const url = getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  const anonKey = getSupabaseServerAnonKey();

  if (!url) return null;
  if (options?.requireServiceRole && !serviceKey) return null;

  const activeKey = serviceKey || anonKey;
  if (!activeKey) return null;

  if (cachedClientUrl !== url) {
    cachedAdminClient = null;
    cachedAnonClient = null;
    cachedClientUrl = url;
  }

  if (serviceKey) {
    if (!cachedAdminClient) {
      cachedAdminClient = createClient(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    }
    return cachedAdminClient;
  }

  if (!cachedAnonClient) {
    cachedAnonClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedAnonClient;
}

export type SupabaseLoadResult =
  | { status: 'ok'; data: DatabaseSchema }
  | { status: 'empty' }
  | { status: 'unconfigured' }
  | { status: 'missing_table'; error: string }
  | { status: 'error'; error: string };

/**
 * Loads the persisted DatabaseSchema from Supabase PostgreSQL when configured.
 * Distinguishes between:
 * - 'ok': valid state loaded
 * - 'empty': connected successfully, but no state row exists yet
 * - 'unconfigured': Supabase credentials not set
 * - 'missing_table': migration not applied (table does not exist)
 * - 'error': network failure, auth/RLS error, or query timeout
 */
export async function loadStateFromSupabase(): Promise<SupabaseLoadResult> {
  const client = getSupabaseServerClient();
  if (!client) return { status: 'unconfigured' };

  try {
    const { data, error } = await client
      .from('rmqr_app_state')
      .select('payload')
      .eq('id', 'primary')
      .maybeSingle();

    if (error) {
      const errCode = (error as { code?: string }).code || '';
      const errMsg = error.message || 'Unknown Supabase error';
      // PostgreSQL / PostgREST error codes for missing table
      if (errCode === '42P01' || errCode === 'PGRST205' || errMsg.includes('relation') || errMsg.includes('does not exist')) {
        return { status: 'missing_table', error: errMsg };
      }
      return { status: 'error', error: errMsg };
    }

    if (!data || !data.payload || typeof data.payload !== 'object') {
      return { status: 'empty' };
    }

    return { status: 'ok', data: data.payload as DatabaseSchema };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network failure contacting Supabase';
    return { status: 'error', error: msg };
  }
}

/**
 * Persists the application state snapshot AND syncs relational tables in Supabase PostgreSQL.
 * Never throws unhandled rejections or logs secret credentials.
 */
export async function syncStateToSupabase(
  db: DatabaseSchema
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseServerClient();
  if (!client) {
    return { ok: false, error: 'Supabase server client is not configured.' };
  }

  try {
    const now = new Date().toISOString();

    // 1. Upsert atomic state snapshot in rmqr_app_state
    const { error: stateErr } = await client.from('rmqr_app_state').upsert(
      {
        id: 'primary',
        schema_version: 3,
        payload: db,
        updated_at: now,
      },
      { onConflict: 'id' }
    );

    // 2. Sync core relational tables so SQL queries & RLS policies operate on normalized rows
    if (Array.isArray(db.organizations) && db.organizations.length > 0) {
      const orgRows = db.organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        industry: o.industry || 'general',
        logo_url: o.logoUrl || null,
        brand_primary_color: o.brandPrimaryColor || '#7C3AED',
        brand_secondary_color: o.brandSecondaryColor || '#0B0F19',
        custom_domain: o.customDomain || null,
        white_label_enabled: Boolean(o.whiteLabelEnabled),
        status: o.status || 'active',
        created_at: o.createdAt || now,
        updated_at: o.updatedAt || now,
      }));
      await client.from('organizations').upsert(orgRows, { onConflict: 'id' });
    }

    if (Array.isArray(db.reviewCampaigns) && db.reviewCampaigns.length > 0) {
      const rcRows = db.reviewCampaigns.map((r) => ({
        id: r.id,
        organization_id: r.organizationId,
        slug: r.slug,
        name: r.name,
        business_name: r.businessName,
        google_review_url: r.googleReviewUrl,
        contact_phone: r.contactPhone || '7400342769',
        headline: r.headline,
        subheadline: r.subheadline,
        cta_text: r.ctaText,
        brand_color: r.brandColor || '#7C3AED',
        suggested_highlights: r.suggestedHighlights || [],
        ai_drafts_enabled: r.aiDraftsEnabled !== false,
        review_agent_enabled: r.reviewAgentEnabled !== false,
        default_language: r.defaultLanguage || 'en',
        supported_languages: r.supportedLanguages || ['en', 'hi', 'mr'],
        scan_count: r.scanCount || 0,
        google_click_count: r.googleClickCount || 0,
        status: r.status || 'active',
        created_at: r.createdAt || now,
        updated_at: r.updatedAt || now,
      }));
      await client.from('review_campaigns').upsert(rcRows, { onConflict: 'id' });
    }

    if (Array.isArray(db.reviewResponseLogs) && db.reviewResponseLogs.length > 0) {
      const replyRows = db.reviewResponseLogs.slice(0, 200).map((item) => ({
        id: item.id,
        organization_id: item.organizationId,
        review_campaign_id: item.campaignId || null,
        reviewer_name: item.reviewerName,
        rating: item.rating,
        review_text: item.reviewText,
        sentiment: item.sentiment || 'positive',
        language: item.language || 'en',
        tone: item.tone || 'warm',
        draft_reply: item.selectedReply,
        reply_options: item.replyOptions || [],
        contact_phone_included: Boolean(item.includeContactPhone),
        status: item.approvalStatus === 'approved' ? 'approved' : 'draft',
        human_approved: item.approvalStatus === 'approved',
        approved_at: item.approvedAt || null,
        copied_count: 0,
        created_at: item.createdAt || now,
        updated_at: item.updatedAt || now,
      }));
      await client.from('review_replies').upsert(replyRows, { onConflict: 'id' });
    }

    if (Array.isArray(db.customerReviewSessions) && db.customerReviewSessions.length > 0) {
      const sessionRows = db.customerReviewSessions.slice(0, 200).map((s) => ({
        id: s.id,
        review_campaign_id: s.campaignId,
        organization_id: s.organizationId,
        language: s.language || 'en',
        experience_level: s.experienceLevel || 'good',
        star_rating: s.starRating ?? null,
        feedback_details: s.feedbackDetails || '',
        selected_topics: s.selectedTopics || [],
        additional_feedback: s.additionalFeedback || '',
        generated_drafts: s.draftOptions || [],
        selected_draft: s.selectedDraft || '',
        sentiment_preserved:
          s.experienceLevel === 'needs_improvement'
            ? 'negative'
            : s.experienceLevel === 'average'
            ? 'neutral'
            : 'positive',
        ai_generated: s.aiProviderUsed === 'gemini' || s.aiProviderUsed === 'openai',
        status:
          s.status === 'in_progress'
            ? 'started'
            : s.status === 'drafts_ready'
            ? 'drafts_generated'
            : s.status === 'google_opened'
            ? 'google_opened'
            : s.status === 'copied'
            ? 'copied'
            : s.status === 'completed'
            ? 'completed'
            : 'started',
        created_at: s.createdAt || now,
        updated_at: s.updatedAt || now,
        expires_at: s.expiresAt || new Date(Date.now() + 86400000).toISOString(),
      }));
      await client
        .from('customer_review_sessions')
        .upsert(sessionRows, { onConflict: 'id' });
    }

    if (stateErr) {
      return { ok: false, error: 'Supabase table sync returned a constraint or schema warning.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to reach Supabase PostgreSQL endpoint.' };
  }
}

const DEFAULT_DEMO_EMAILS = new Set(['admin@rmqr.app', 'owner@rmqr.app']);

/**
 * Safe, idempotent importer from local JSON DatabaseSchema to Supabase PostgreSQL.
 * - Supports dryRun: true (validates and counts records without writing to Supabase)
 * - Automatically excludes seeded demo accounts (admin@rmqr.app, owner@rmqr.app) unless includeDemoAccounts is explicitly true
 * - Deduplicates records by ID and slug
 */
export async function importJsonToSupabase(params: {
  db: DatabaseSchema;
  dryRun?: boolean;
  includeDemoAccounts?: boolean;
}): Promise<SupabaseImportReport> {
  const dryRun = params.dryRun !== false;
  const includeDemo = Boolean(params.includeDemoAccounts);
  const status = getSupabaseConfigStatus();
  const warnings: string[] = [];
  const skippedDemoAccounts: string[] = [];

  const filteredProfiles = (params.db.profiles || []).filter((p) => {
    const emailLower = (p.email || '').toLowerCase().trim();
    if (!includeDemo && DEFAULT_DEMO_EMAILS.has(emailLower)) {
      skippedDemoAccounts.push(emailLower);
      return false;
    }
    return Boolean(p.id && emailLower);
  });

  if (skippedDemoAccounts.length > 0) {
    warnings.push(
      `Skipped ${skippedDemoAccounts.length} seeded demo account(s) (${skippedDemoAccounts.join(
        ', '
      )}) so default passwords are never imported into production.`
    );
  }

  // Deduplicate organizations & QR codes by ID and slug
  const seenOrgIds = new Set<string>();
  const seenOrgSlugs = new Set<string>();
  const validOrgs = (params.db.organizations || []).filter((o) => {
    if (!o.id || !o.slug || seenOrgIds.has(o.id) || seenOrgSlugs.has(o.slug)) {
      return false;
    }
    seenOrgIds.add(o.id);
    seenOrgSlugs.add(o.slug);
    return true;
  });

  const seenQrIds = new Set<string>();
  const seenQrSlugs = new Set<string>();
  const validQrs = (params.db.qrCodes || []).filter((q) => {
    if (!q.id || !q.slug || seenQrIds.has(q.id) || seenQrSlugs.has(q.slug)) {
      return false;
    }
    seenQrIds.add(q.id);
    seenQrSlugs.add(q.slug);
    return true;
  });

  const counts = {
    organizations: validOrgs.length,
    profiles: filteredProfiles.length,
    qrCodes: validQrs.length,
    reviewCampaigns: (params.db.reviewCampaigns || []).length,
    reviewReplies: (params.db.reviewResponseLogs || []).length,
    customerReviewSessions: (params.db.customerReviewSessions || []).length,
    menus: (params.db.menus || []).length,
    landingPages: (params.db.landingPages || []).length,
    aiAgents: (params.db.aiAgents || []).length,
  };

  if (dryRun) {
    return {
      dryRun: true,
      configured: status.configured,
      executed: false,
      skippedDemoAccounts,
      counts,
      warnings,
    };
  }

  if (!status.configured) {
    return {
      dryRun: false,
      configured: false,
      executed: false,
      skippedDemoAccounts,
      counts,
      warnings,
      error:
        'Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are not configured.',
    };
  }

  const sanitizedDb: DatabaseSchema = {
    ...params.db,
    profiles: filteredProfiles,
    organizations: validOrgs,
    qrCodes: validQrs,
  };

  const syncRes = await syncStateToSupabase(sanitizedDb);
  return {
    dryRun: false,
    configured: true,
    executed: syncRes.ok,
    skippedDemoAccounts,
    counts,
    warnings,
    error: syncRes.error,
  };
}
