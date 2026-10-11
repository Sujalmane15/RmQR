'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  Send,
  RotateCcw,
  Phone,
  Globe,
  MapPin,
  MessageCircle,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  CheckCircle2,
  X,
  BookOpen,
  PauseCircle,
} from 'lucide-react';

interface PublicAgentProfile {
  slug: string;
  agentName: string;
  businessName: string;
  businessCategory: string;
  businessDescription: string;
  websiteUrl: string;
  phone: string;
  address: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  welcomeTitle: string;
  welcomeMessage: string;
  chatbotDisplayName: string;
  brandColor: string;
  logoUrl: string;
  suggestedQuestions: string[];
  leadCollectionEnabled: boolean;
  humanContactUrl: string;
  whatsappNumber: string;
  contactButtonLabel: string;
}

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  groundedSources?: string[];
  providerUsed?: string;
}

export default function PublicAIAgentChatPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';

  const [loading, setLoading] = useState(true);
  const [unavailableState, setUnavailableState] = useState<{
    reason: 'not_found' | 'paused' | 'inactive' | 'error';
    businessName?: string;
    agentName?: string;
    brandColor?: string;
    humanContactUrl?: string;
    whatsappNumber?: string;
    phone?: string;
    message?: string;
  } | null>(null);

  const [agent, setAgent] = useState<PublicAgentProfile | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [aiProviderName, setAiProviderName] = useState<string>('none');

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');

  // Optional Lead Modal State
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadNote, setLeadNote] = useState('');
  const [leadConsent, setLeadConsent] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState('');
  const [leadSuccess, setLeadSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let storedSession = '';
    try {
      storedSession = sessionStorage.getItem(`rmqr_visitor_${slug}`) || '';
      if (!storedSession) {
        storedSession = `vis_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
        sessionStorage.setItem(`rmqr_visitor_${slug}`, storedSession);
      }
    } catch {
      storedSession = `vis_${Date.now()}`;
    }
    setVisitorSessionId(storedSession);
  }, [slug]);

  useEffect(() => {
    async function fetchAgent() {
      if (!slug) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/agent/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok || !data.available) {
          setUnavailableState({
            reason: data.reason || (res.status === 404 ? 'not_found' : 'inactive'),
            businessName: data.businessName,
            agentName: data.agentName,
            brandColor: data.brandColor,
            humanContactUrl: data.humanContactUrl,
            whatsappNumber: data.whatsappNumber,
            phone: data.phone,
            message: data.error,
          });
          setAgent(null);
        } else {
          setAgent(data.agent);
          setAiConfigured(Boolean(data.aiProvider?.configured));
          setAiProviderName(data.aiProvider?.provider || 'none');
          setUnavailableState(null);
          setMessages([
            {
              id: 'welcome-msg',
              role: 'assistant',
              content: data.agent.welcomeMessage,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch {
        setUnavailableState({
          reason: 'error',
          message: 'Unable to load AI assistant right now. Please check your connection.',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAgent();
  }, [slug]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function sendMessage(rawQuestion?: string) {
    if (!agent || sending) return;
    const text = (rawQuestion !== undefined ? rawQuestion : inputText).trim();
    if (!text) return;

    setChatError('');
    if (rawQuestion === undefined) {
      setInputText('');
    }

    const tempUserMsg: ChatBubble = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/agent/${encodeURIComponent(agent.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          conversationId,
          visitorSessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatError(data.error || 'Unable to get a response right now.');
      } else {
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
        const assistantMsg: ChatBubble = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
          groundedSources: data.groundedSources || [],
          providerUsed: data.providerUsed,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      setChatError('Network error while contacting the assistant. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleResetConversation() {
    if (!agent) return;
    setConversationId(null);
    setChatError('');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: agent.welcomeMessage,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent) return;
    setLeadError('');

    if (!leadConsent) {
      setLeadError('Please check the consent box to share your contact information.');
      return;
    }

    if (!leadName.trim() && !leadEmail.trim() && !leadPhone.trim()) {
      setLeadError('Please provide at least your name, email, or phone number.');
      return;
    }

    setLeadSubmitting(true);
    try {
      const consentText = `I consent to share my contact details with ${agent.businessName} so they can follow up regarding my inquiry.`;
      const res = await fetch(`/api/agent/${encodeURIComponent(agent.slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_lead',
          conversationId,
          name: leadName,
          email: leadEmail,
          phone: leadPhone,
          note: leadNote,
          consentGiven: leadConsent,
          consentText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLeadError(data.error || 'Could not submit details.');
      } else {
        setLeadSuccess(true);
        setLeadName('');
        setLeadEmail('');
        setLeadPhone('');
        setLeadNote('');
      }
    } catch {
      setLeadError('Network error while submitting contact details.');
    } finally {
      setLeadSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center animate-pulse mb-4">
          <Bot className="w-6 h-6 text-violet-400" />
        </div>
        <p className="text-sm text-slate-400">Loading AI Assistant...</p>
      </div>
    );
  }

  if (unavailableState || !agent) {
    const isPaused = unavailableState?.reason === 'paused' || unavailableState?.reason === 'inactive';
    return (
      <div
        data-testid="agent-unavailable-state"
        className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            {isPaused ? (
              <PauseCircle className="w-7 h-7 text-amber-400" />
            ) : (
              <AlertCircle className="w-7 h-7 text-rose-400" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {unavailableState?.businessName || 'AI Assistant Unavailable'}
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              {isPaused
                ? `This AI assistant is currently ${unavailableState?.reason} by the business owner.`
                : unavailableState?.message || 'We could not find an active AI assistant at this QR link.'}
            </p>
          </div>

          {(unavailableState?.phone ||
            unavailableState?.whatsappNumber ||
            unavailableState?.humanContactUrl) && (
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Direct Business Contact
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {unavailableState.phone && (
                  <a
                    href={`tel:${unavailableState.phone}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call {unavailableState.phone}
                  </a>
                )}
                {unavailableState.whatsappNumber && (
                  <a
                    href={`https://wa.me/${unavailableState.whatsappNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {unavailableState.humanContactUrl && (
                  <a
                    href={unavailableState.humanContactUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-medium text-white transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Visit Website
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Powered by RMQR AI Agent QR
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const brandColor = agent.brandColor || '#6D28D9';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between md:py-6 md:px-4">
      <div className="w-full max-w-2xl bg-slate-900 md:border md:border-slate-800 md:rounded-3xl shadow-2xl flex flex-col h-screen md:h-[88vh] overflow-hidden">
        {/* Top Branded Header */}
        <header
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, #0F172A 100%)`,
          }}
          className="px-5 py-4 border-b border-white/10 shrink-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {agent.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={agent.logoUrl}
                  alt={agent.businessName}
                  className="w-12 h-12 rounded-2xl object-cover border border-white/20 bg-slate-950 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {agent.businessName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1
                    data-testid="public-agent-business-name"
                    className="font-bold text-white text-base sm:text-lg leading-tight"
                  >
                    {agent.businessName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {agent.chatbotDisplayName}
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5 line-clamp-1">
                  {agent.welcomeTitle || agent.businessDescription}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetConversation}
              title="Reset Conversation"
              data-testid="reset-conversation-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/25 hover:bg-black/40 border border-white/15 text-xs font-medium text-white transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>

          {/* Quick Contact Bar */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-white/10 text-xs text-white/85">
            {agent.phone && (
              <a
                href={`tel:${agent.phone}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/35 transition"
              >
                <Phone className="w-3 h-3" /> {agent.phone}
              </a>
            )}
            {agent.whatsappNumber && (
              <a
                href={`https://wa.me/${agent.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-100 border border-emerald-400/30 transition"
              >
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </a>
            )}
            {agent.humanContactUrl && (
              <a
                href={agent.humanContactUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/35 transition"
              >
                <ExternalLink className="w-3 h-3" />{' '}
                {agent.contactButtonLabel || 'Contact Human Support'}
              </a>
            )}
            {agent.websiteUrl && (
              <a
                href={agent.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/35 transition"
              >
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
            {agent.leadCollectionEnabled && (
              <button
                type="button"
                onClick={() => {
                  setLeadSuccess(false);
                  setLeadError('');
                  setLeadModalOpen(true);
                }}
                data-testid="open-lead-modal-btn"
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-slate-900 hover:bg-slate-100 font-semibold transition shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" /> Leave Contact Info
              </button>
            )}
          </div>
        </header>

        {/* Transparent Mode Banner (Never disguise local grounded retrieval as live LLM) */}
        <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>
              Answers are grounded strictly in verified{' '}
              <strong className="text-slate-200">{agent.businessName}</strong> knowledge.
            </span>
          </div>
          <span
            data-testid="ai-mode-badge"
            className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 shrink-0"
          >
            {aiConfigured
              ? `Live LLM (${aiProviderName})`
              : 'Grounded Knowledge Retrieval Mode'}
          </span>
        </div>

        {/* Chat Messages Area */}
        <div
          data-testid="chat-messages-list"
          className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
        >
          {/* Business location banner if available */}
          {agent.address && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>{agent.address}</span>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                data-testid={isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-medium text-slate-400">
                    {isUser ? 'You' : agent.chatbotDisplayName}
                  </span>
                </div>

                <div
                  style={isUser ? { backgroundColor: brandColor } : undefined}
                  className={`max-w-[86%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed shadow-md ${
                    isUser
                      ? 'text-white rounded-br-xs'
                      : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {msg.content}

                  {!isUser && msg.groundedSources && msg.groundedSources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/70 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mr-1">
                        <BookOpen className="w-3 h-3 text-violet-400" /> Sources:
                      </span>
                      {msg.groundedSources.map((src, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] text-violet-300"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div
              data-testid="chat-loading-indicator"
              className="flex items-center gap-2 text-xs text-slate-400 px-2 py-1"
            >
              <div className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center animate-spin">
                <Sparkles className="w-3 h-3 text-violet-400" />
              </div>
              <span>{agent.chatbotDisplayName} is checking business knowledge...</span>
            </div>
          )}

          {chatError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{chatError}</span>
            </div>
          )}

          {/* Suggested Starter Questions */}
          {agent.suggestedQuestions && agent.suggestedQuestions.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-medium text-slate-400 mb-2 px-1">
                Suggested questions:
              </p>
              <div className="flex flex-wrap gap-2">
                {agent.suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={sending}
                    onClick={() => sendMessage(question)}
                    data-testid={`starter-question-${idx}`}
                    className="text-left text-xs px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-slate-200 transition disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Message Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3.5 bg-slate-950 border-t border-slate-800 shrink-0"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask ${agent.businessName} a question...`}
              maxLength={600}
              disabled={sending}
              data-testid="chat-input"
              className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-violet-500 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              data-testid="chat-send-btn"
              style={{ backgroundColor: brandColor }}
              className="px-4 py-3 rounded-2xl text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:opacity-95 disabled:opacity-40 transition shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
            <span>Press Enter to send</span>
            <Link href="/" className="hover:text-slate-300 transition">
              Powered by RMQR
            </Link>
          </div>
        </form>
      </div>

      {/* Optional Consented Lead Collection Modal */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            data-testid="lead-collection-modal"
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-400" />
                <h2 className="text-base font-bold text-white">
                  Connect with {agent.businessName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLeadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {leadSuccess ? (
              <div
                data-testid="lead-submit-success"
                className="py-6 text-center space-y-3"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-semibold text-white">
                  Contact Information Received
                </h3>
                <p className="text-xs text-slate-400">
                  Thank you! {agent.businessName} has received your inquiry and will follow up with you.
                </p>
                <button
                  type="button"
                  onClick={() => setLeadModalOpen(false)}
                  className="mt-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
                >
                  Return to Chat
                </button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <p className="text-xs text-slate-400">
                  Share your details if you would like a team member from{' '}
                  <strong className="text-slate-200">{agent.businessName}</strong> to reach out.
                </p>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Alex Rivera"
                    data-testid="lead-name-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="alex@example.com"
                      data-testid="lead-email-input"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+1 555-0199"
                      data-testid="lead-phone-input"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    How can they help you?
                  </label>
                  <textarea
                    rows={2}
                    value={leadNote}
                    onChange={(e) => setLeadNote(e.target.value)}
                    placeholder="Optional note or question..."
                    data-testid="lead-note-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white"
                  />
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leadConsent}
                    onChange={(e) => setLeadConsent(e.target.checked)}
                    data-testid="lead-consent-checkbox"
                    className="mt-0.5 rounded border-slate-700"
                  />
                  <span className="text-xs text-slate-300 leading-relaxed">
                    I explicitly consent to share my contact details with{' '}
                    <strong>{agent.businessName}</strong> so they can follow up regarding my inquiry.
                  </span>
                </label>

                {leadError && (
                  <p className="text-xs text-rose-400">{leadError}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setLeadModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    data-testid="lead-submit-btn"
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {leadSubmitting ? 'Submitting...' : 'Submit Details'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
