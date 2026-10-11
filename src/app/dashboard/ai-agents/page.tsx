'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AIAgentCategory,
  AIAgentRecord,
  AIAgentStatus,
  AIAgentTone,
  AIConversation,
  AIKnowledgeEntry,
  AIKnowledgeSection,
  AILeadRecord,
  AIMessage,
  QRCodeRecord,
} from '@/lib/types';
import { AI_AGENT_CATEGORY_META, AIProviderStatus } from '@/lib/ai/agent-engine';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  MessageSquare,
  Pause,
  Play,
  Plus,
  PowerOff,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface EnrichedAgent extends AIAgentRecord {
  qrCode: QRCodeRecord | null;
  knowledgeEntries: AIKnowledgeEntry[];
  knowledgeCount: number;
}

interface EnrichedConversation extends AIConversation {
  messages: AIMessage[];
}

const CATEGORY_OPTIONS: Array<{ id: AIAgentCategory; label: string }> = [
  { id: 'restaurant_cafe', label: 'Restaurant & Cafe Assistant' },
  { id: 'retail_shop', label: 'Retail Shop Assistant' },
  { id: 'salon_spa', label: 'Salon & Spa Assistant' },
  { id: 'real_estate', label: 'Real Estate Assistant' },
  { id: 'hotel_hospitality', label: 'Hotel & Hospitality Assistant' },
  { id: 'professional_services', label: 'Professional Services Assistant' },
  { id: 'education_training', label: 'Education & Training Assistant' },
  { id: 'general_business', label: 'General Business Assistant' },
];

const KNOWLEDGE_SECTIONS: Array<{ id: AIKnowledgeSection; label: string }> = [
  { id: 'about', label: 'About the Business' },
  { id: 'products_services', label: 'Products & Services' },
  { id: 'pricing', label: 'Prices & Pricing Rules' },
  { id: 'opening_hours', label: 'Opening Hours' },
  { id: 'faq', label: 'FAQs & Answers' },
  { id: 'policies', label: 'Policies & Terms' },
  { id: 'contact', label: 'Contact Information' },
  { id: 'menu_items', label: 'Restaurant Menu Items' },
  { id: 'custom_facts', label: 'Other Business Facts' },
];

export default function AIAgentsDashboardPage() {
  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [menus, setMenus] = useState<Array<{ id: string; restaurantName: string; slug: string }>>([]);
  const [landingPages, setLandingPages] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selected Agent Inspector
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'knowledge' | 'settings' | 'conversations' | 'leads'>('knowledge');
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [leads, setLeads] = useState<AILeadRecord[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Knowledge Editor State (for selected agent)
  const [newKnowSection, setNewKnowSection] = useState<AIKnowledgeSection>('about');
  const [newKnowTitle, setNewKnowTitle] = useState('');
  const [newKnowContent, setNewKnowContent] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editKnowSection, setEditKnowSection] = useState<AIKnowledgeSection>('about');
  const [editKnowTitle, setEditKnowTitle] = useState('');
  const [editKnowContent, setEditKnowContent] = useState('');
  const [showKnowledgePreview, setShowKnowledgePreview] = useState(false);

  // Selected Agent Settings Editor State
  const [editAgentForm, setEditAgentForm] = useState<Partial<AIAgentRecord>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // 5-Step Creation Wizard State
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [creatingAgent, setCreatingAgent] = useState(false);

  // Wizard Step A — Basic Info
  const [wAgentName, setWAgentName] = useState('');
  const [wBusinessName, setWBusinessName] = useState('');
  const [wCategory, setWCategory] = useState<AIAgentCategory>('restaurant_cafe');
  const [wDescription, setWDescription] = useState('');
  const [wWebsite, setWWebsite] = useState('');
  const [wPhone, setWPhone] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [wDefaultLang, setWDefaultLang] = useState('English');
  const [wSupportedLangs, setWSupportedLangs] = useState('English, Hindi');

  // Wizard Step B — Business Knowledge
  const [wLinkedMenuId, setWLinkedMenuId] = useState('');
  const [wLinkedLpId, setWLinkedLpId] = useState('');
  const [wKnowledgeList, setWKnowledgeList] = useState<
    Array<{ section: AIKnowledgeSection; title: string; content: string }>
  >([
    {
      section: 'about',
      title: 'About Our Business',
      content: 'We provide high-quality products and hospitable service to our customers.',
    },
    {
      section: 'opening_hours',
      title: 'Opening Hours & Location',
      content: 'Open Monday to Sunday, 10:00 AM – 10:00 PM.',
    },
  ]);
  const [wDraftSec, setWDraftSec] = useState<AIKnowledgeSection>('pricing');
  const [wDraftTitle, setWDraftTitle] = useState('');
  const [wDraftContent, setWDraftContent] = useState('');

  // Wizard Step C — Personality & Behavior
  const [wTone, setWTone] = useState<AIAgentTone>('friendly_professional');
  const [wRespLength, setWRespLength] = useState<'concise' | 'detailed'>('concise');
  const [wWelcomeMsg, setWWelcomeMsg] = useState(
    AI_AGENT_CATEGORY_META.restaurant_cafe.defaultWelcome
  );
  const [wSuggestedQs, setWSuggestedQs] = useState(
    AI_AGENT_CATEGORY_META.restaurant_cafe.defaultQuestions.join('\n')
  );
  const [wCustomInstructions, setWCustomInstructions] = useState(
    'Answer strictly using the saved business knowledge. Never invent prices, hours, or policies.'
  );
  const [wFallbackMsg, setWFallbackMsg] = useState(
    'I do not have that specific information in our verified business records. Please contact our team directly so we can help you.'
  );
  const [wLeadCollection, setWLeadCollection] = useState(true);
  const [wWhatsapp, setWWhatsapp] = useState('');
  const [wHumanContactUrl, setWHumanContactUrl] = useState('');

  // Wizard Step D — Branding
  const [wLogoUrl, setWLogoUrl] = useState('');
  const [wBrandColor, setWBrandColor] = useState('#7C3AED');
  const [wWelcomeTitle, setWWelcomeTitle] = useState('');
  const [wChatbotName, setWChatbotName] = useState('');
  const [wContactBtnLabel, setWContactBtnLabel] = useState('Contact Our Team');

  // Wizard Step E — QR Creation
  const [wSlug, setWSlug] = useState('');
  const [wFrameText, setWFrameText] = useState('ASK AI ASSISTANT');

  const appOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-agents');
      if (res.ok) {
        const data = await res.json();
        const list: EnrichedAgent[] = data.agents || [];
        setAgents(list);
        setMenus(data.menus || []);
        setLandingPages(data.landingPages || []);
        setProviderStatus(data.aiProviderStatus || null);
        if (list.length > 0 && !selectedAgentId) {
          setSelectedAgentId(list[0].id);
        }
      }
    } catch {
      setErrorBanner('Failed to load AI agents.');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  // Load conversations and leads when selectedAgentId changes
  useEffect(() => {
    if (!selectedAgentId) return;
    fetch(`/api/ai-agents/${selectedAgentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setConversations(data.conversations || []);
          setLeads(data.leads || []);
          setEditAgentForm({
            agentName: data.agent.agentName,
            businessName: data.agent.businessName,
            businessCategory: data.agent.businessCategory,
            businessDescription: data.agent.businessDescription,
            websiteUrl: data.agent.websiteUrl || '',
            phone: data.agent.phone || '',
            address: data.agent.address || '',
            defaultLanguage: data.agent.defaultLanguage,
            supportedLanguages: data.agent.supportedLanguages,
            linkedMenuId: data.agent.linkedMenuId || '',
            linkedLandingPageId: data.agent.linkedLandingPageId || '',
            tone: data.agent.tone,
            responseLength: data.agent.responseLength,
            welcomeMessage: data.agent.welcomeMessage,
            suggestedQuestions: data.agent.suggestedQuestions,
            customInstructions: data.agent.customInstructions,
            fallbackUnknownMessage: data.agent.fallbackUnknownMessage,
            leadCollectionEnabled: data.agent.leadCollectionEnabled,
            humanContactUrl: data.agent.humanContactUrl || '',
            whatsappNumber: data.agent.whatsappNumber || '',
            brandColor: data.agent.brandColor,
            welcomeTitle: data.agent.welcomeTitle,
            chatbotDisplayName: data.agent.chatbotDisplayName,
            contactButtonLabel: data.agent.contactButtonLabel || 'Contact Us',
          });
        }
      })
      .catch(() => {});
  }, [selectedAgentId]);

  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      if (categoryFilter !== 'all' && a.businessCategory !== categoryFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          a.agentName.toLowerCase().includes(q) ||
          a.businessName.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [agents, categoryFilter, statusFilter, search]);

  const handleWizardCategoryChange = (cat: AIAgentCategory) => {
    setWCategory(cat);
    const meta = AI_AGENT_CATEGORY_META[cat];
    setWWelcomeMsg(meta.defaultWelcome);
    setWSuggestedQs(meta.defaultQuestions.join('\n'));
  };

  const handleAddWizardKnowledge = () => {
    if (!wDraftTitle.trim() || !wDraftContent.trim()) return;
    setWKnowledgeList((prev) => [
      ...prev,
      {
        section: wDraftSec,
        title: wDraftTitle.trim(),
        content: wDraftContent.trim(),
      },
    ]);
    setWDraftTitle('');
    setWDraftContent('');
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setWLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAgent = async () => {
    if (!wAgentName.trim() || !wBusinessName.trim()) {
      setErrorBanner('Please enter both an Agent Name and a Business Name in Step A.');
      setWizardStep(1);
      return;
    }

    setCreatingAgent(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/ai-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: wAgentName.trim(),
          businessName: wBusinessName.trim(),
          businessCategory: wCategory,
          businessDescription: wDescription.trim(),
          websiteUrl: wWebsite.trim(),
          phone: wPhone.trim(),
          address: wAddress.trim(),
          defaultLanguage: wDefaultLang.trim() || 'English',
          supportedLanguages: wSupportedLangs
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          linkedMenuId: wLinkedMenuId || null,
          linkedLandingPageId: wLinkedLpId || null,
          knowledgeEntries: wKnowledgeList,
          tone: wTone,
          responseLength: wRespLength,
          welcomeMessage: wWelcomeMsg.trim(),
          suggestedQuestions: wSuggestedQs
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          customInstructions: wCustomInstructions.trim(),
          fallbackUnknownMessage: wFallbackMsg.trim(),
          leadCollectionEnabled: wLeadCollection,
          whatsappNumber: wWhatsapp.trim(),
          humanContactUrl: wHumanContactUrl.trim(),
          logoUrl: wLogoUrl || undefined,
          brandColor: wBrandColor,
          welcomeTitle: wWelcomeTitle.trim() || `Ask ${wBusinessName.trim()} AI`,
          chatbotDisplayName: wChatbotName.trim() || wAgentName.trim(),
          contactButtonLabel: wContactBtnLabel.trim() || 'Contact Team',
          slug: wSlug.trim() || undefined,
          frameText: wFrameText.trim() || 'ASK AI ASSISTANT',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Failed to create AI Agent.');
        return;
      }

      setShowWizard(false);
      setWizardStep(1);
      setWAgentName('');
      setWBusinessName('');
      setWSlug('');
      setStatusFeedback(`Created AI Agent "${data.agent.agentName}" and generated its Dynamic QR code!`);
      await loadAgents();
      setSelectedAgentId(data.agent.id);
    } catch {
      setErrorBanner('Network error while creating AI Agent.');
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleToggleAgentStatus = async (agent: EnrichedAgent, nextStatus: AIAgentStatus) => {
    setErrorBanner(null);
    const res = await fetch(`/api/ai-agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setStatusFeedback(`Agent "${agent.agentName}" is now ${nextStatus}.`);
      await loadAgents();
    } else {
      const err = await res.json();
      setErrorBanner(err.error || 'Failed to update status.');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const res = await fetch(`/api/ai-agents/${agentId}`, { method: 'DELETE' });
    if (res.ok) {
      setDeleteConfirmId(null);
      setStatusFeedback('AI Agent and linked QR code deleted.');
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }
      await loadAgents();
    }
  };

  const handleAddKnowledgeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent || !newKnowTitle.trim() || !newKnowContent.trim()) return;

    const res = await fetch(`/api/ai-agents/${selectedAgent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_knowledge',
        section: newKnowSection,
        title: newKnowTitle.trim(),
        content: newKnowContent.trim(),
      }),
    });

    if (res.ok) {
      setNewKnowTitle('');
      setNewKnowContent('');
      setStatusFeedback('Saved new knowledge entry to agent knowledge base.');
      await loadAgents();
    } else {
      const err = await res.json();
      setErrorBanner(err.error || 'Failed to add knowledge entry.');
    }
  };

  const handleSaveEditedKnowledge = async (entryId: string) => {
    if (!selectedAgent || !editKnowTitle.trim() || !editKnowContent.trim()) return;

    const res = await fetch(`/api/ai-agents/${selectedAgent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_knowledge',
        entryId,
        section: editKnowSection,
        title: editKnowTitle.trim(),
        content: editKnowContent.trim(),
      }),
    });

    if (res.ok) {
      setEditingEntryId(null);
      setStatusFeedback('Updated knowledge entry.');
      await loadAgents();
    }
  };

  const handleDeleteKnowledgeEntry = async (entryId: string) => {
    if (!selectedAgent) return;
    const res = await fetch(`/api/ai-agents/${selectedAgent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_knowledge',
        entryId,
      }),
    });
    if (res.ok) {
      setStatusFeedback('Removed knowledge entry.');
      await loadAgents();
    }
  };

  const handleSaveAgentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setSavingSettings(true);
    setErrorBanner(null);

    try {
      const res = await fetch(`/api/ai-agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAgentForm),
      });
      if (res.ok) {
        setStatusFeedback('Saved AI Agent settings and branding.');
        await loadAgents();
      } else {
        const err = await res.json();
        setErrorBanner(err.error || 'Failed to update settings.');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const copyAgentUrl = (slug: string) => {
    const url = `${appOrigin}/agent/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const totalConversations = agents.reduce((sum, a) => sum + (a.conversationCount || 0), 0);
  const totalMessages = agents.reduce((sum, a) => sum + (a.messageCount || 0), 0);
  const totalLeads = agents.reduce((sum, a) => sum + (a.leadCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 px-3 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
            <Bot className="h-3.5 w-3.5" /> AI Agent QR Studio
          </span>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            AI Agent QR Assistants
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create business-specific AI assistants grounded in your verified knowledge and deploy them via dynamic QR codes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowWizard(true);
            setWizardStep(1);
          }}
          data-testid="open-ai-agent-wizard-btn"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-all"
        >
          <Plus className="h-4 w-4" />
          Create AI Agent QR
        </button>
      </div>

      {/* Honest AI Provider Configuration Banner */}
      {providerStatus && (
        <div
          data-testid="ai-provider-status-banner"
          className={`rounded-2xl border p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            providerStatus.configured
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {providerStatus.configured ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold">
                {providerStatus.configured
                  ? `Live AI Provider Connected (${providerStatus.provider.toUpperCase()} — ${providerStatus.model})`
                  : 'AI API Key Not Configured — Running in Grounded Knowledge Retrieval Mode'}
              </span>
              <p className="mt-0.5 opacity-90 leading-relaxed">{providerStatus.setupMessage}</p>
            </div>
          </div>
        </div>
      )}

      {statusFeedback && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{statusFeedback}</span>
          <button type="button" onClick={() => setStatusFeedback(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-300 flex items-center justify-between"
        >
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Metrics (Strictly Persisted) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Agents</span>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {agents.length}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {agents.filter((a) => a.status === 'active').length} active QRs
          </span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Recorded Conversations
          </span>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalConversations}
          </div>
          <span className="text-[11px] text-slate-400">From real visitor sessions</span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Chat Messages
          </span>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalMessages}
          </div>
          <span className="text-[11px] text-slate-400">User + assistant turns</span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Consented Leads
          </span>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalLeads}
          </div>
          <span className="text-[11px] text-slate-400">Opt-in contact submissions</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents by name, business, or slug..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2 text-xs"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          <option value="all">All Business Categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Main Grid: Agent List + Selected Agent Inspector */}
      {loading ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
          Loading AI Agent QR workspaces...
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-3">
          <Bot className="h-10 w-10 text-violet-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            No AI Agents Found
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create your first AI Agent QR code to let customers scan and ask questions about your business, menu, services, or hours.
          </p>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Create First AI Agent QR
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Agent Cards */}
          <div className="lg:col-span-4 space-y-3">
            {filteredAgents.map((agent) => {
              const isSelected = agent.id === selectedAgent?.id;
              const catLabel =
                CATEGORY_OPTIONS.find((c) => c.id === agent.businessCategory)?.label ||
                agent.businessCategory;

              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  data-testid={`agent-card-${agent.slug}`}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-violet-600 bg-violet-500/5 dark:bg-violet-500/10 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                        {catLabel}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {agent.agentName}
                      </h3>
                      <p className="text-xs text-slate-500">{agent.businessName}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        agent.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : agent.status === 'paused'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/15 text-slate-500'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span>{agent.knowledgeCount} knowledge entries</span>
                    <span>{agent.conversationCount} chats • {agent.messageCount} msgs</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Agent Inspector & QR Studio */}
          {selectedAgent && (
            <div className="lg:col-span-8 space-y-6">
              {/* Top Action Bar & QR Preview */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                          selectedAgent.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : selectedAgent.status === 'paused'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-500/15 text-slate-500'
                        }`}
                      >
                        {selectedAgent.status}
                      </span>
                      <span className="text-xs text-slate-400">
                        Created {new Date(selectedAgent.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {selectedAgent.agentName}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedAgent.businessName} • Default Language: {selectedAgent.defaultLanguage}
                      </p>
                    </div>

                    {/* Public Agent URL & Dynamic QR Redirect URL */}
                    <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-500">Public AI Chat URL:</span>
                        <code
                          data-testid="selected-agent-public-url"
                          className="font-mono text-violet-600 dark:text-violet-400 break-all"
                        >
                          {appOrigin}/agent/{selectedAgent.slug}
                        </code>
                      </div>
                      {selectedAgent.qrCode && (
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-800">
                          <span className="font-semibold text-slate-500">Dynamic QR Redirect:</span>
                          <code className="font-mono text-slate-700 dark:text-slate-300 break-all">
                            {appOrigin}/r/{selectedAgent.qrCode.slug}
                          </code>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href={`/agent/${selectedAgent.slug}`}
                        target="_blank"
                        data-testid="test-agent-chat-link"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-bold text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Test Public AI Chat
                      </Link>

                      <button
                        type="button"
                        onClick={() => copyAgentUrl(selectedAgent.slug)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copiedSlug === selectedAgent.slug ? 'Copied Link!' : 'Copy Public URL'}
                      </button>

                      {selectedAgent.status !== 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAgentStatus(selectedAgent, 'active')}
                          data-testid="activate-agent-btn"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                        >
                          <Play className="h-3.5 w-3.5" /> Resume Agent
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleAgentStatus(selectedAgent, 'paused')}
                          data-testid="pause-agent-btn"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400"
                        >
                          <Pause className="h-3.5 w-3.5" /> Pause Agent
                        </button>
                      )}

                      {selectedAgent.status !== 'inactive' && (
                        <button
                          type="button"
                          onClick={() => handleToggleAgentStatus(selectedAgent, 'inactive')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400"
                        >
                          <PowerOff className="h-3.5 w-3.5" /> Deactivate
                        </button>
                      )}

                      {deleteConfirmId === selectedAgent.id ? (
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs">
                          <span className="font-bold text-red-600 dark:text-red-400">Confirm delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgent(selectedAgent.id)}
                            className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white"
                          >
                            Yes, Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[11px] text-slate-500 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(selectedAgent.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 dark:border-red-900/50 px-2.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* QR Code Preview & Export Card */}
                  <div className="md:col-span-5">
                    <QRPreviewCard
                      content={
                        selectedAgent.qrCode
                          ? `${appOrigin}/r/${selectedAgent.qrCode.slug}`
                          : `${appOrigin}/agent/${selectedAgent.slug}`
                      }
                      name={`${selectedAgent.slug}-ai-qr`}
                      styleConfig={{
                        eyeColor: selectedAgent.brandColor,
                        frameStyle: 'banner_bottom',
                        frameText: 'ASK AI ASSISTANT',
                        frameColor: selectedAgent.brandColor,
                        pattern: 'rounded',
                        eyeStyle: 'rounded',
                      }}
                      size={180}
                      showReliabilityReport={false}
                    />
                  </div>
                </div>
              </div>

              {/* Inspector Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('knowledge')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                    activeTab === 'knowledge'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Business Knowledge ({selectedAgent.knowledgeEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Agent Setup &amp; Branding
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('conversations')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                    activeTab === 'conversations'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversations ({conversations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('leads')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                    activeTab === 'leads'
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Captured Leads ({leads.length})
                </button>
              </div>

              {/* TAB 1: BUSINESS KNOWLEDGE MANAGEMENT */}
              {activeTab === 'knowledge' && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Verified Business Knowledge Base
                        </h3>
                        <p className="text-xs text-slate-500">
                          Last updated:{' '}
                          <span data-testid="knowledge-last-updated">
                            {new Date(selectedAgent.knowledgeUpdatedAt).toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowKnowledgePreview((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {showKnowledgePreview ? 'Hide Knowledge Preview' : 'Preview Compiled Knowledge'}
                      </button>
                    </div>

                    {showKnowledgePreview && (
                      <div className="rounded-2xl border border-violet-500/30 bg-slate-950 text-slate-200 p-4 text-xs font-mono whitespace-pre-wrap space-y-2 max-h-64 overflow-y-auto">
                        <div className="text-violet-400 font-bold">
                          === COMPILED KNOWLEDGE FOR {selectedAgent.businessName.toUpperCase()} ===
                        </div>
                        {selectedAgent.knowledgeEntries.map((k) => (
                          <div key={k.id}>
                            [{k.section.toUpperCase()}] {k.title}: {k.content}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Knowledge Entry Form */}
                    <form
                      onSubmit={handleAddKnowledgeEntry}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
                    >
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Add Knowledge Entry
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1">Section</label>
                          <select
                            value={newKnowSection}
                            onChange={(e) => setNewKnowSection(e.target.value as AIKnowledgeSection)}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                          >
                            {KNOWLEDGE_SECTIONS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold mb-1">Entry Title *</label>
                          <input
                            type="text"
                            required
                            value={newKnowTitle}
                            onChange={(e) => setNewKnowTitle(e.target.value)}
                            data-testid="new-knowledge-title-input"
                            placeholder="e.g., Weekend Brunch Hours & Pricing"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">
                          Verified Facts / Details *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={newKnowContent}
                          onChange={(e) => setNewKnowContent(e.target.value)}
                          data-testid="new-knowledge-content-input"
                          placeholder="Enter accurate prices, timings, policies, or FAQs..."
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        data-testid="add-knowledge-submit-btn"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> Save Knowledge Entry
                      </button>
                    </form>

                    {/* Existing Knowledge Entries List */}
                    <div className="space-y-3">
                      {selectedAgent.knowledgeEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                        >
                          {editingEntryId === entry.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                  value={editKnowSection}
                                  onChange={(e) =>
                                    setEditKnowSection(e.target.value as AIKnowledgeSection)
                                  }
                                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                                >
                                  {KNOWLEDGE_SECTIONS.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={editKnowTitle}
                                  onChange={(e) => setEditKnowTitle(e.target.value)}
                                  className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-bold"
                                />
                              </div>
                              <textarea
                                rows={3}
                                value={editKnowContent}
                                onChange={(e) => setEditKnowContent(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedKnowledge(entry.id)}
                                  className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Save Changes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingEntryId(null)}
                                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="inline-block rounded-lg bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600 dark:text-violet-400">
                                    {KNOWLEDGE_SECTIONS.find((s) => s.id === entry.section)?.label ||
                                      entry.section}
                                  </span>
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                    {entry.title}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEntryId(entry.id);
                                      setEditKnowSection(entry.section);
                                      setEditKnowTitle(entry.title);
                                      setEditKnowContent(entry.content);
                                    }}
                                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                    title="Edit entry"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                                    className="rounded-lg border border-red-200 dark:border-red-900/40 p-1.5 text-red-500 hover:bg-red-500/10"
                                    title="Delete entry"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                {entry.content}
                              </p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AGENT SETUP, PERSONALITY & BRANDING */}
              {activeTab === 'settings' && (
                <form
                  onSubmit={handleSaveAgentSettings}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-5"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Configure Agent Profile, Behavior &amp; Branding
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Agent Name *</label>
                      <input
                        type="text"
                        required
                        value={editAgentForm.agentName || ''}
                        onChange={(e) =>
                          setEditAgentForm({ ...editAgentForm, agentName: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Business Name *</label>
                      <input
                        type="text"
                        required
                        value={editAgentForm.businessName || ''}
                        onChange={(e) =>
                          setEditAgentForm({ ...editAgentForm, businessName: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Business Category</label>
                      <select
                        value={editAgentForm.businessCategory || 'general_business'}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            businessCategory: e.target.value as AIAgentCategory,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        Linked Workspace Restaurant Menu (Optional)
                      </label>
                      <select
                        value={editAgentForm.linkedMenuId || ''}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            linkedMenuId: e.target.value || null,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="">None</option>
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.restaurantName} (/m/{m.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={editAgentForm.phone || ''}
                        onChange={(e) =>
                          setEditAgentForm({ ...editAgentForm, phone: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Business Address</label>
                      <input
                        type="text"
                        value={editAgentForm.address || ''}
                        onChange={(e) =>
                          setEditAgentForm({ ...editAgentForm, address: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Tone</label>
                      <select
                        value={editAgentForm.tone || 'friendly_professional'}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            tone: e.target.value as AIAgentTone,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="friendly_professional">Friendly &amp; Professional</option>
                        <option value="warm_hospitality">Warm Hospitality</option>
                        <option value="concise_direct">Concise &amp; Direct</option>
                        <option value="formal_executive">Formal &amp; Executive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Response Length</label>
                      <select
                        value={editAgentForm.responseLength || 'concise'}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            responseLength: e.target.value as 'concise' | 'detailed',
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="concise">Concise</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Welcome Message</label>
                    <textarea
                      rows={2}
                      value={editAgentForm.welcomeMessage || ''}
                      onChange={(e) =>
                        setEditAgentForm({ ...editAgentForm, welcomeMessage: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Fallback Message When Answer Is Unknown
                    </label>
                    <textarea
                      rows={2}
                      value={editAgentForm.fallbackUnknownMessage || ''}
                      onChange={(e) =>
                        setEditAgentForm({
                          ...editAgentForm,
                          fallbackUnknownMessage: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Brand Color</label>
                      <input
                        type="color"
                        value={editAgentForm.brandColor || '#7C3AED'}
                        onChange={(e) =>
                          setEditAgentForm({ ...editAgentForm, brandColor: e.target.value })
                        }
                        className="h-9 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Chatbot Display Name</label>
                      <input
                        type="text"
                        value={editAgentForm.chatbotDisplayName || ''}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            chatbotDisplayName: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">WhatsApp Number</label>
                      <input
                        type="text"
                        value={editAgentForm.whatsappNumber || ''}
                        onChange={(e) =>
                          setEditAgentForm({
                            ...editAgentForm,
                            whatsappNumber: e.target.value,
                          })
                        }
                        placeholder="919820012345"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(editAgentForm.leadCollectionEnabled)}
                      onChange={(e) =>
                        setEditAgentForm({
                          ...editAgentForm,
                          leadCollectionEnabled: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300"
                    />
                    Enable Optional Visitor Contact / Lead Collection (with explicit consent)
                  </label>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Agent Settings'}
                  </button>
                </form>
              )}

              {/* TAB 3: CONVERSATIONS */}
              {activeTab === 'conversations' && (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Recent Visitor Conversations
                  </h3>
                  {conversations.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No visitor conversations have been recorded for this agent yet. Open the public chat link to test it!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Session #{conv.id.slice(0, 8)}
                            </span>
                            <span>{new Date(conv.lastMessageAt).toLocaleString()}</span>
                          </div>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {conv.messages.map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-xl p-2.5 text-xs ${
                                  m.role === 'user'
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                                    : 'bg-violet-500/10 border border-violet-500/20 text-slate-800 dark:text-slate-100'
                                }`}
                              >
                                <span className="font-bold uppercase text-[10px] mr-2 text-violet-600 dark:text-violet-400">
                                  {m.role}:
                                </span>
                                <span className="whitespace-pre-line">{m.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CAPTURED LEADS */}
              {activeTab === 'leads' && (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Consented Visitor Leads
                  </h3>
                  {leads.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">
                      No leads submitted yet. When visitors opt in and consent to share their contact details in chat, they appear here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {leads.map((lead) => (
                        <div
                          key={lead.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                            <span>{lead.name || 'Visitor'}</span>
                            <span className="text-[11px] font-normal text-slate-400">
                              {new Date(lead.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            {lead.email && <span className="mr-4">Email: {lead.email}</span>}
                            {lead.phone && <span>Phone: {lead.phone}</span>}
                          </div>
                          {lead.note && <p className="text-slate-500 italic">&ldquo;{lead.note}&rdquo;</p>}
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            ✓ {lead.consentText}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5-STEP AI AGENT CREATION WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Step {wizardStep} of 5
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {wizardStep === 1 && 'Step A — Basic Business Information'}
                  {wizardStep === 2 && 'Step B — Business Knowledge Base'}
                  {wizardStep === 3 && 'Step C — Agent Personality & Behavior'}
                  {wizardStep === 4 && 'Step D — Branding & Display'}
                  {wizardStep === 5 && 'Step E — QR Code Generation & Launch'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowWizard(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Indicator Pills */}
            <div className="grid grid-cols-5 gap-2 text-center text-[11px] font-bold">
              {[
                { step: 1, label: 'A. Basic Info' },
                { step: 2, label: 'B. Knowledge' },
                { step: 3, label: 'C. Behavior' },
                { step: 4, label: 'D. Branding' },
                { step: 5, label: 'E. QR Launch' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setWizardStep(s.step as 1 | 2 | 3 | 4 | 5)}
                  className={`rounded-xl py-2 px-2 transition-colors ${
                    wizardStep === s.step
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* STEP 1: BASIC INFO */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Agent Name *</label>
                    <input
                      type="text"
                      value={wAgentName}
                      onChange={(e) => setWAgentName(e.target.value)}
                      data-testid="wizard-agent-name-input"
                      placeholder="e.g., Lotus Spa Concierge"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Business Name *</label>
                    <input
                      type="text"
                      value={wBusinessName}
                      onChange={(e) => setWBusinessName(e.target.value)}
                      data-testid="wizard-business-name-input"
                      placeholder="e.g., Lotus Wellness & Spa"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Business Category *</label>
                    <select
                      value={wCategory}
                      onChange={(e) =>
                        handleWizardCategoryChange(e.target.value as AIAgentCategory)
                      }
                      data-testid="wizard-category-select"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Business Website (Optional)
                    </label>
                    <input
                      type="text"
                      value={wWebsite}
                      onChange={(e) => setWWebsite(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Business Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={wPhone}
                      onChange={(e) => setWPhone(e.target.value)}
                      placeholder="+91 98200 00000"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Business Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={wAddress}
                      onChange={(e) => setWAddress(e.target.value)}
                      placeholder="Street, Area, City"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Default Language</label>
                    <input
                      type="text"
                      value={wDefaultLang}
                      onChange={(e) => setWDefaultLang(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Additional Supported Languages
                    </label>
                    <input
                      type="text"
                      value={wSupportedLangs}
                      onChange={(e) => setWSupportedLangs(e.target.value)}
                      placeholder="English, Hindi, Marathi"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Business Description</label>
                  <textarea
                    rows={2}
                    value={wDescription}
                    onChange={(e) => setWDescription(e.target.value)}
                    placeholder="Brief overview of your business, offerings, and specialties..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS KNOWLEDGE */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <strong>Recommended for {AI_AGENT_CATEGORY_META[wCategory].label}:</strong>{' '}
                  {AI_AGENT_CATEGORY_META[wCategory].knowledgeHint}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Link Existing Restaurant Menu (Optional)
                    </label>
                    <select
                      value={wLinkedMenuId}
                      onChange={(e) => setWLinkedMenuId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      <option value="">Do not link a menu</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.restaurantName} (/m/{m.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Link Existing Landing Page (Optional)
                    </label>
                    <select
                      value={wLinkedLpId}
                      onChange={(e) => setWLinkedLpId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      <option value="">Do not link a landing page</option>
                      {landingPages.map((lp) => (
                        <option key={lp.id} value={lp.id}>
                          {lp.title} (/p/{lp.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Add Knowledge Item */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={wDraftSec}
                      onChange={(e) => setWDraftSec(e.target.value as AIKnowledgeSection)}
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    >
                      {KNOWLEDGE_SECTIONS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={wDraftTitle}
                      onChange={(e) => setWDraftTitle(e.target.value)}
                      data-testid="wizard-knowledge-title-input"
                      placeholder="Knowledge Title (e.g., Service Price List)"
                      className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={wDraftContent}
                    onChange={(e) => setWDraftContent(e.target.value)}
                    data-testid="wizard-knowledge-content-input"
                    placeholder="Enter specific prices, services, hours, FAQs, or policies..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddWizardKnowledge}
                    data-testid="wizard-add-knowledge-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to Knowledge List
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {wKnowledgeList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-violet-600 dark:text-violet-400 uppercase mr-2">
                          [{item.section}]
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.title}:
                        </span>{' '}
                        <span className="text-slate-600 dark:text-slate-300">{item.content}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setWKnowledgeList((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: PERSONALITY & BEHAVIOR */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Agent Tone</label>
                    <select
                      value={wTone}
                      onChange={(e) => setWTone(e.target.value as AIAgentTone)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    >
                      <option value="friendly_professional">Friendly &amp; Professional</option>
                      <option value="warm_hospitality">Warm Hospitality</option>
                      <option value="concise_direct">Concise &amp; Direct</option>
                      <option value="formal_executive">Formal &amp; Executive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Response Detail</label>
                    <select
                      value={wRespLength}
                      onChange={(e) => setWRespLength(e.target.value as 'concise' | 'detailed')}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    >
                      <option value="concise">Concise (Short, quick mobile answers)</option>
                      <option value="detailed">Detailed (Comprehensive explanations)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Default Welcome Message</label>
                  <textarea
                    rows={2}
                    value={wWelcomeMsg}
                    onChange={(e) => setWWelcomeMsg(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Suggested Starter Questions (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={wSuggestedQs}
                    onChange={(e) => setWSuggestedQs(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Fallback Message When Answer Is Not in Knowledge Base
                  </label>
                  <textarea
                    rows={2}
                    value={wFallbackMsg}
                    onChange={(e) => setWFallbackMsg(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      WhatsApp Contact Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={wWhatsapp}
                      onChange={(e) => setWWhatsapp(e.target.value)}
                      placeholder="919820012345"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Human Support Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={wHumanContactUrl}
                      onChange={(e) => setWHumanContactUrl(e.target.value)}
                      placeholder="https://yourbusiness.com/contact"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={wLeadCollection}
                    onChange={(e) => setWLeadCollection(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Allow customers to optionally share contact details (Name, Email, or Phone) with explicit consent
                </label>
              </div>
            )}

            {/* STEP 4: BRANDING */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Welcome Screen Title
                    </label>
                    <input
                      type="text"
                      value={wWelcomeTitle}
                      onChange={(e) => setWWelcomeTitle(e.target.value)}
                      placeholder={`Ask ${wBusinessName || 'Our'} AI Assistant`}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Chatbot Display Name
                    </label>
                    <input
                      type="text"
                      value={wChatbotName}
                      onChange={(e) => setWChatbotName(e.target.value)}
                      placeholder={wAgentName || 'AI Concierge'}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Brand Accent Color</label>
                    <input
                      type="color"
                      value={wBrandColor}
                      onChange={(e) => setWBrandColor(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Contact Button Label
                    </label>
                    <input
                      type="text"
                      value={wContactBtnLabel}
                      onChange={(e) => setWContactBtnLabel(e.target.value)}
                      placeholder="Contact Host Desk"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Business Logo (Optional Image Upload)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                  />
                </div>
              </div>
            )}

            {/* STEP 5: QR CREATION & LAUNCH */}
            {wizardStep === 5 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Public Agent Slug (Optional)
                    </label>
                    <div className="flex items-center">
                      <span className="rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500">
                        {appOrigin}/agent/
                      </span>
                      <input
                        type="text"
                        value={wSlug}
                        onChange={(e) => setWSlug(e.target.value)}
                        data-testid="wizard-slug-input"
                        placeholder="auto-generated"
                        className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      QR Frame Call-to-Action Text
                    </label>
                    <input
                      type="text"
                      value={wFrameText}
                      onChange={(e) => setWFrameText(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-violet-500" /> Ready to Launch
                    </div>
                    <p className="text-slate-500">
                      Agent: <strong>{wAgentName || 'Unnamed Agent'}</strong> for{' '}
                      <strong>{wBusinessName || 'Your Business'}</strong>
                    </p>
                    <p className="text-slate-500">
                      Knowledge entries configured: <strong>{wKnowledgeList.length}</strong>
                    </p>
                  </div>
                </div>

                <div className="md:col-span-5">
                  <QRPreviewCard
                    content={`${appOrigin}/agent/${wSlug || 'preview-agent'}`}
                    name={wSlug || 'ai-agent-qr'}
                    styleConfig={{
                      eyeColor: wBrandColor,
                      frameStyle: 'banner_bottom',
                      frameText: wFrameText || 'ASK AI ASSISTANT',
                      frameColor: wBrandColor,
                      pattern: 'rounded',
                      eyeStyle: 'rounded',
                    }}
                    size={180}
                    showExportButtons={false}
                    showReliabilityReport={false}
                  />
                </div>
              </div>
            )}

            {/* Wizard Footer Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  wizardStep > 1
                    ? setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)
                    : setShowWizard(false)
                }
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {wizardStep > 1 ? '← Previous Step' : 'Cancel'}
              </button>

              {wizardStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)}
                  data-testid="wizard-next-step-btn"
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={creatingAgent}
                  onClick={handleCreateAgent}
                  data-testid="wizard-create-agent-submit-btn"
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-violet-600/30 disabled:opacity-50"
                >
                  {creatingAgent ? 'Creating Agent & QR...' : 'Create AI Agent & Generate QR'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
