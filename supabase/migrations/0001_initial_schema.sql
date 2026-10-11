-- =============================================================================
-- RMQR — Production Database Schema & Row Level Security (RLS) Migration
-- Database: Supabase PostgreSQL
-- Migration: 0001_initial_schema.sql
-- =============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. ORGANIZATIONS (Workspaces / Tenants)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT 'general',
  logo_url TEXT,
  brand_primary_color TEXT NOT NULL DEFAULT '#7C3AED',
  brand_secondary_color TEXT NOT NULL DEFAULT '#0B0F19',
  custom_domain TEXT UNIQUE,
  white_label_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- -----------------------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS (Multi-tenant RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_user ON public.organization_members(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

-- Helper SQL functions for Row Level Security (RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_write_access(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin', 'editor')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_admin_access(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. SUBSCRIPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  payment_provider TEXT CHECK (payment_provider IN ('stripe', 'razorpay', 'manual')),
  external_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. QR FOLDERS & CAMPAIGNS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#7C3AED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_folders_org ON public.qr_folders(organization_id);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON public.campaigns(organization_id);

-- -----------------------------------------------------------------------------
-- 6. QR CODES & QR DESTINATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.qr_folders(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  qr_type TEXT NOT NULL CHECK (qr_type IN ('static', 'dynamic')),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'url', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi',
    'vcard', 'location', 'google_review', 'menu', 'social', 'file', 'landing_page'
  )),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'archived')),
  encoded_content TEXT NOT NULL,
  destination_url TEXT,
  fallback_url TEXT,
  expires_at TIMESTAMPTZ,
  password_hash TEXT,
  routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  style_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  scan_count BIGINT NOT NULL DEFAULT 0,
  human_scan_count BIGINT NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_org ON public.qr_codes(organization_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_slug ON public.qr_codes(slug);
CREATE INDEX IF NOT EXISTS idx_qr_codes_campaign ON public.qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_folder ON public.qr_codes(folder_id);

CREATE TABLE IF NOT EXISTS public.qr_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  destination_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  weight INTEGER NOT NULL DEFAULT 100,
  device_rule TEXT CHECK (device_rule IN ('all', 'ios', 'android', 'desktop')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_destinations_qr ON public.qr_destinations(qr_code_id);

-- -----------------------------------------------------------------------------
-- 7. QR SCAN EVENTS (Privacy-Conscious Telemetry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visitor_hash TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  device_type TEXT NOT NULL DEFAULT 'mobile' CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'other')),
  os TEXT NOT NULL DEFAULT 'Unknown',
  browser TEXT NOT NULL DEFAULT 'Unknown',
  country TEXT NOT NULL DEFAULT 'Unknown',
  region TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  destination_resolved TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_events_org_date ON public.qr_scan_events(organization_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_qr_date ON public.qr_scan_events(qr_code_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_events_campaign ON public.qr_scan_events(campaign_id);

-- -----------------------------------------------------------------------------
-- 8. LANDING PAGES & BLOCKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  page_type TEXT NOT NULL CHECK (page_type IN (
    'link_in_bio', 'business_profile', 'product_service', 'contact_card',
    'event', 'restaurant_menu', 'promotion', 'google_review'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  view_count BIGINT NOT NULL DEFAULT 0,
  click_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_org ON public.landing_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON public.landing_pages(slug);

CREATE TABLE IF NOT EXISTS public.landing_page_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN ('button', 'text', 'image', 'hours', 'map', 'whatsapp', 'social')),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  url TEXT DEFAULT '',
  icon TEXT DEFAULT 'link',
  sort_order INTEGER NOT NULL DEFAULT 0,
  click_count BIGINT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_lp_blocks_page ON public.landing_page_blocks(landing_page_id, sort_order);

-- -----------------------------------------------------------------------------
-- 9. BUSINESS PROFILES & GOOGLE REVIEW CAMPAIGNS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Local Business',
  description TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  google_review_url TEXT DEFAULT '',
  google_place_id TEXT DEFAULT '',
  logo_url TEXT,
  cover_url TEXT,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_org ON public.business_profiles(organization_id);

CREATE TABLE IF NOT EXISTS public.review_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  business_profile_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  google_review_url TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT 'How was your experience with us?',
  subheadline TEXT NOT NULL DEFAULT 'Your honest feedback helps us serve you better.',
  cta_text TEXT NOT NULL DEFAULT 'Continue to Google Reviews',
  brand_color TEXT NOT NULL DEFAULT '#7C3AED',
  logo_url TEXT,
  suggested_highlights TEXT[] NOT NULL DEFAULT '{}',
  ai_drafts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  scan_count BIGINT NOT NULL DEFAULT 0,
  google_click_count BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_campaigns_org ON public.review_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_slug ON public.review_campaigns(slug);

-- -----------------------------------------------------------------------------
-- 10. DIGITAL RESTAURANT MENUS, CATEGORIES, ITEMS & FEATURED
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  restaurant_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'INR',
  currency_symbol TEXT NOT NULL DEFAULT '₹',
  logo_url TEXT,
  cover_url TEXT,
  theme_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_org ON public.menus(organization_id);
CREATE INDEX IF NOT EXISTS idx_menus_slug ON public.menus(slug);

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_menu ON public.menu_categories(menu_id, sort_order);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  is_high_margin BOOLEAN NOT NULL DEFAULT FALSE,
  show_high_margin_badge BOOLEAN NOT NULL DEFAULT FALSE,
  is_todays_special BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON public.menu_items(menu_id, category_id, sort_order);

CREATE TABLE IF NOT EXISTS public.menu_featured_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  badge_label TEXT NOT NULL DEFAULT 'Chef Special',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (menu_id, menu_item_id)
);

-- -----------------------------------------------------------------------------
-- 11. UPLOADED ASSETS, API KEYS, WEBHOOKS, AUDIT LOGS & SUPPORT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uploaded_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo', 'menu_image', 'cover', 'ocr_upload', 'document')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{qr:read}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{qr.scanned}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.menu_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'text' CHECK (source_type IN ('text', 'image', 'pdf')),
  raw_input TEXT,
  extracted_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'discarded')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_import_jobs_org ON public.menu_import_jobs(organization_id);

CREATE TABLE IF NOT EXISTS public.review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  review_campaign_id UUID REFERENCES public.review_campaigns(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'warm' CHECK (tone IN ('professional', 'warm', 'apologetic')),
  draft_reply TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_replies_org ON public.review_replies(organization_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_featured_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Helper: Check if current user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
$$;

-- Profiles: users can view/insert/update their own profile, but cannot self-promote to super_admin
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid() AND is_super_admin = FALSE);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (
    (id = auth.uid() AND is_super_admin = (SELECT p.is_super_admin FROM public.profiles p WHERE p.id = auth.uid()))
    OR public.is_super_admin()
  );

-- Organizations: members can read, authenticated users can create, admins/owners can update/delete
CREATE POLICY org_select_member ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY org_insert_auth ON public.organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY org_update_admin ON public.organizations
  FOR UPDATE USING (public.has_org_admin_access(id))
  WITH CHECK (public.has_org_admin_access(id));

CREATE POLICY org_delete_owner ON public.organizations
  FOR DELETE USING (public.has_org_admin_access(id));

-- Tenant-scoped tables: SELECT for org members, INSERT/UPDATE/DELETE with explicit WITH CHECK for write roles
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY org_members_modify ON public.organization_members
  FOR ALL USING (public.has_org_admin_access(organization_id))
  WITH CHECK (public.has_org_admin_access(organization_id));

CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY subscriptions_modify ON public.subscriptions
  FOR ALL USING (public.has_org_admin_access(organization_id))
  WITH CHECK (public.has_org_admin_access(organization_id));

CREATE POLICY qr_folders_select ON public.qr_folders
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY qr_folders_modify ON public.qr_folders
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY campaigns_modify ON public.campaigns
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY qr_codes_select ON public.qr_codes
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY qr_codes_modify ON public.qr_codes
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY qr_destinations_select ON public.qr_destinations
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY qr_destinations_modify ON public.qr_destinations
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY qr_scan_events_select ON public.qr_scan_events
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY landing_pages_select ON public.landing_pages
  FOR SELECT USING (status = 'published' OR public.is_org_member(organization_id));
CREATE POLICY landing_pages_modify ON public.landing_pages
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY lp_blocks_select ON public.landing_page_blocks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.landing_pages lp
      WHERE lp.id = landing_page_id
        AND (lp.status = 'published' OR public.is_org_member(lp.organization_id))
    )
  );
CREATE POLICY lp_blocks_modify ON public.landing_page_blocks
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY business_profiles_select ON public.business_profiles
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY business_profiles_modify ON public.business_profiles
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY review_campaigns_select ON public.review_campaigns
  FOR SELECT USING (status = 'active' OR public.is_org_member(organization_id));
CREATE POLICY review_campaigns_modify ON public.review_campaigns
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY review_replies_select ON public.review_replies
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY review_replies_modify ON public.review_replies
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY menus_select ON public.menus
  FOR SELECT USING (status = 'published' OR public.is_org_member(organization_id));
CREATE POLICY menus_modify ON public.menus
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY menu_categories_select ON public.menu_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.menus m
      WHERE m.id = menu_id
        AND (m.status = 'published' OR public.is_org_member(m.organization_id))
    )
  );
CREATE POLICY menu_categories_modify ON public.menu_categories
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY menu_items_select ON public.menu_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.menus m
      WHERE m.id = menu_id
        AND (m.status = 'published' OR public.is_org_member(m.organization_id))
    )
  );
CREATE POLICY menu_items_modify ON public.menu_items
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY menu_featured_select ON public.menu_featured_items
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY menu_featured_modify ON public.menu_featured_items
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY menu_import_jobs_select ON public.menu_import_jobs
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY menu_import_jobs_modify ON public.menu_import_jobs
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY uploaded_assets_select ON public.uploaded_assets
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY uploaded_assets_modify ON public.uploaded_assets
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

CREATE POLICY api_keys_select ON public.api_keys
  FOR SELECT USING (public.has_org_admin_access(organization_id));
CREATE POLICY api_keys_modify ON public.api_keys
  FOR ALL USING (public.has_org_admin_access(organization_id))
  WITH CHECK (public.has_org_admin_access(organization_id));

CREATE POLICY webhooks_select ON public.webhook_endpoints
  FOR SELECT USING (public.has_org_admin_access(organization_id));
CREATE POLICY webhooks_modify ON public.webhook_endpoints
  FOR ALL USING (public.has_org_admin_access(organization_id))
  WITH CHECK (public.has_org_admin_access(organization_id));

CREATE POLICY webhook_deliveries_select ON public.webhook_deliveries
  FOR SELECT USING (public.has_org_admin_access(organization_id));

CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT USING (public.is_org_member(organization_id) OR public.is_super_admin());

-- Support tickets: public/authenticated users can submit via contact form; org members can view their own org tickets; super admins can view/update all
CREATE POLICY support_tickets_insert_any ON public.support_tickets
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR public.is_super_admin()
  );
CREATE POLICY support_tickets_update_admin ON public.support_tickets
  FOR UPDATE USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

