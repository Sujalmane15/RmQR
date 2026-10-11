-- =============================================================================
-- RMQR — AI Agent QR Migration & Row Level Security (RLS) Policies
-- Migration: 0002_ai_agent_qr.sql
-- =============================================================================

-- Allow 'ai_agent' in qr_codes.content_type check constraint
ALTER TABLE public.qr_codes DROP CONSTRAINT IF EXISTS qr_codes_content_type_check;
ALTER TABLE public.qr_codes ADD CONSTRAINT qr_codes_content_type_check CHECK (
  content_type IN (
    'url', 'text', 'email', 'phone', 'sms', 'whatsapp', 'wifi',
    'vcard', 'location', 'google_review', 'menu', 'social', 'file', 'landing_page', 'ai_agent'
  )
);

-- 1. AI AGENTS
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  qr_code_id UUID REFERENCES public.qr_codes(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
  agent_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_category TEXT NOT NULL DEFAULT 'general_business' CHECK (
    business_category IN (
      'restaurant_cafe', 'retail_shop', 'salon_spa', 'real_estate',
      'hotel_hospitality', 'professional_services', 'education_training', 'general_business'
    )
  ),
  business_description TEXT NOT NULL DEFAULT '',
  website_url TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  default_language TEXT NOT NULL DEFAULT 'English',
  supported_languages TEXT[] NOT NULL DEFAULT '{English}',
  linked_menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
  linked_landing_page_id UUID REFERENCES public.landing_pages(id) ON DELETE SET NULL,
  tone TEXT NOT NULL DEFAULT 'friendly_professional' CHECK (
    tone IN ('friendly_professional', 'warm_hospitality', 'concise_direct', 'formal_executive')
  ),
  response_length TEXT NOT NULL DEFAULT 'concise' CHECK (response_length IN ('concise', 'detailed')),
  welcome_message TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
  suggested_questions TEXT[] NOT NULL DEFAULT '{}',
  custom_instructions TEXT NOT NULL DEFAULT '',
  fallback_unknown_message TEXT NOT NULL DEFAULT 'I do not have that specific information in our business records. Please contact our team directly.',
  lead_collection_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  human_contact_url TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#7C3AED',
  welcome_title TEXT NOT NULL DEFAULT 'Chat with our AI Assistant',
  chatbot_display_name TEXT NOT NULL DEFAULT 'AI Assistant',
  contact_button_label TEXT DEFAULT 'Contact Us',
  conversation_count BIGINT NOT NULL DEFAULT 0,
  message_count BIGINT NOT NULL DEFAULT 0,
  lead_count BIGINT NOT NULL DEFAULT 0,
  knowledge_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_org ON public.ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_slug ON public.ai_agents(slug);

-- 2. AI KNOWLEDGE ENTRIES
CREATE TABLE IF NOT EXISTS public.ai_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'custom_facts' CHECK (
    section IN (
      'about', 'products_services', 'pricing', 'opening_hours',
      'faq', 'policies', 'contact', 'menu_items', 'custom_facts'
    )
  ),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_agent ON public.ai_knowledge_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_org ON public.ai_knowledge_entries(organization_id);

-- 3. AI CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  visitor_session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent ON public.ai_conversations(agent_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  provider_used TEXT DEFAULT 'unconfigured',
  grounded_sources TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at ASC);

-- 4. AI LEADS (With explicit consent tracking)
CREATE TABLE IF NOT EXISTS public.ai_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  note TEXT DEFAULT '',
  consent_given BOOLEAN NOT NULL DEFAULT FALSE CHECK (consent_given = TRUE),
  consent_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_leads_agent ON public.ai_leads(agent_id, created_at DESC);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_leads ENABLE ROW LEVEL SECURITY;

-- Public can view active agents; org members can view all their org's agents
CREATE POLICY ai_agents_select ON public.ai_agents
  FOR SELECT USING (status = 'active' OR public.is_org_member(organization_id));
CREATE POLICY ai_agents_modify ON public.ai_agents
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

-- Knowledge entries: org members can read/modify their own org's entries
CREATE POLICY ai_knowledge_select ON public.ai_knowledge_entries
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY ai_knowledge_modify ON public.ai_knowledge_entries
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));

-- Conversations, Messages & Leads: org members can view their own org's records
CREATE POLICY ai_conversations_select ON public.ai_conversations
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY ai_messages_select ON public.ai_messages
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY ai_leads_select ON public.ai_leads
  FOR SELECT USING (public.is_org_member(organization_id));
CREATE POLICY ai_leads_modify ON public.ai_leads
  FOR ALL USING (public.has_org_write_access(organization_id))
  WITH CHECK (public.has_org_write_access(organization_id));
