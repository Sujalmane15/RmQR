-- =============================================================================
-- RMQR — Safe Incremental Migration for Review AI Agent, Billing Invoices & State Sync
-- Migration: 0003_supabase_sync_and_reviews.sql
-- Safe to run on existing databases: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Does NOT drop tables, truncate data, or run destructive commands.
-- =============================================================================

-- 1. Safely extend public.profiles for hybrid session auth compatibility
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Safely extend public.review_campaigns with RM Solution AI Review Agent fields
ALTER TABLE public.review_campaigns
  ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '7400342769',
  ADD COLUMN IF NOT EXISTS review_agent_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'en'
    CHECK (default_language IN ('en', 'hi', 'mr')),
  ADD COLUMN IF NOT EXISTS supported_languages TEXT[] NOT NULL DEFAULT '{en,hi,mr}';

-- 3. Safely extend public.review_replies with multilingual & approval audit fields
ALTER TABLE public.review_replies
  ADD COLUMN IF NOT EXISTS sentiment TEXT NOT NULL DEFAULT 'positive'
    CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'hi', 'mr')),
  ADD COLUMN IF NOT EXISTS reply_options TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact_phone_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS copied_count INTEGER NOT NULL DEFAULT 0;

-- Allow 'concise' in review_replies.tone constraint without dropping data
ALTER TABLE public.review_replies DROP CONSTRAINT IF EXISTS review_replies_tone_check;
ALTER TABLE public.review_replies ADD CONSTRAINT review_replies_tone_check
  CHECK (tone IN ('professional', 'warm', 'apologetic', 'concise'));

-- 4. Create public.customer_review_sessions for the public /review/[slug] AI Review Agent
CREATE TABLE IF NOT EXISTS public.customer_review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_campaign_id UUID NOT NULL REFERENCES public.review_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'mr')),
  experience_level TEXT NOT NULL DEFAULT 'good'
    CHECK (experience_level IN ('excellent', 'good', 'average', 'needs_improvement')),
  star_rating INTEGER CHECK (star_rating IS NULL OR (star_rating BETWEEN 1 AND 5)),
  feedback_details TEXT NOT NULL DEFAULT '',
  selected_topics TEXT[] NOT NULL DEFAULT '{}',
  additional_feedback TEXT NOT NULL DEFAULT '',
  generated_drafts JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_draft TEXT NOT NULL DEFAULT '',
  sentiment_preserved TEXT NOT NULL DEFAULT 'positive'
    CHECK (sentiment_preserved IN ('positive', 'neutral', 'negative')),
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'drafts_generated', 'copied', 'google_opened', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_customer_review_sessions_campaign
  ON public.customer_review_sessions(review_campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_review_sessions_org
  ON public.customer_review_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_review_sessions_expires
  ON public.customer_review_sessions(expires_at);

-- 5. Create public.billing_invoices for organization billing history
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'starter', 'pro', 'business')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount_inr NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('stripe', 'razorpay', 'manual')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'failed')),
  invoice_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_org
  ON public.billing_invoices(organization_id, created_at DESC);

-- 6. Server-managed state synchronization table for atomic Vercel persistence
CREATE TABLE IF NOT EXISTS public.rmqr_app_state (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  schema_version INTEGER NOT NULL DEFAULT 3,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.customer_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rmqr_app_state ENABLE ROW LEVEL SECURITY;

-- Organization members can read their own organization's review sessions and billing invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_review_sessions'
      AND policyname = 'customer_review_sessions_select_org'
  ) THEN
    CREATE POLICY customer_review_sessions_select_org ON public.customer_review_sessions
      FOR SELECT USING (public.is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_review_sessions'
      AND policyname = 'customer_review_sessions_modify_org'
  ) THEN
    CREATE POLICY customer_review_sessions_modify_org ON public.customer_review_sessions
      FOR ALL USING (public.has_org_write_access(organization_id))
      WITH CHECK (public.has_org_write_access(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_invoices'
      AND policyname = 'billing_invoices_select_org'
  ) THEN
    CREATE POLICY billing_invoices_select_org ON public.billing_invoices
      FOR SELECT USING (public.is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'billing_invoices'
      AND policyname = 'billing_invoices_modify_admin'
  ) THEN
    CREATE POLICY billing_invoices_modify_admin ON public.billing_invoices
      FOR ALL USING (public.has_org_admin_access(organization_id))
      WITH CHECK (public.has_org_admin_access(organization_id));
  END IF;

  -- rmqr_app_state is restricted exclusively to super admins or server-side service_role
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rmqr_app_state'
      AND policyname = 'rmqr_app_state_super_admin_only'
  ) THEN
    CREATE POLICY rmqr_app_state_super_admin_only ON public.rmqr_app_state
      FOR ALL USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END
$$;
