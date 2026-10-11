'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ReviewCampaign,
  ReviewReplyLanguage,
  ReviewReplyTone,
  ReviewResponseLogItem,
  ReviewSentiment,
} from '@/lib/types';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe2,
  Info,
  MessageSquareReply,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';

interface GbpIntegrationStatus {
  configured: boolean;
  hasClientCredentials: boolean;
  mode: 'connected' | 'manual_entry';
  statusMessage: string;
}

interface AIProviderStatusInfo {
  configured: boolean;
  provider: 'gemini' | 'openai' | 'unconfigured';
  model: string;
  setupMessage: string;
}

interface DeploymentOriginStatus {
  isPublicHttps: boolean;
  deploymentStatus: 'live' | 'deployment_required';
  deploymentLabel: 'Live Public HTTPS' | 'Deployment Required';
  configuredOrigin: string;
  publicAgentUrl: string | null;
  localTestUrl: string;
  reason: string;
}

interface QRVerificationResponse {
  modeB: {
    label: string;
    expectedUrl: string;
    pngDecodedUrl: string | null;
    svgDecodedUrl: string | null;
    pdfNote: string;
    verified: boolean;
    mobileDataReady: boolean;
  };
  modeA: {
    label: string;
    deploymentStatus: 'live' | 'deployment_required';
    deploymentLabel: string;
    isPublicHttps: boolean;
    expectedPublicUrl: string | null;
    localTestUrl: string;
    pngDecodedUrl: string | null;
    svgDecodedUrl: string | null;
    verified: boolean;
    reason: string;
  };
}

const SAMPLE_REVIEWS: Array<{
  label: string;
  reviewerName: string;
  rating: number;
  sentiment: ReviewSentiment;
  language: ReviewReplyLanguage;
  tone: ReviewReplyTone;
  text: string;
}> = [
  {
    label: 'Positive (English)',
    reviewerName: 'Rahul Patil',
    rating: 5,
    sentiment: 'positive',
    language: 'en',
    tone: 'warm',
    text: 'Very fast and polite guidance at RM Solution. My online documentation work was completed smoothly on the first visit.',
  },
  {
    label: 'Positive (Marathi / मराठी)',
    reviewerName: 'स्नेहा देशमुख',
    rating: 5,
    sentiment: 'positive',
    language: 'mr',
    tone: 'warm',
    text: 'आरएम सोल्युशनमध्ये खूप छान आणि तत्पर सेवा मिळाली. सर्व कागदपत्रांची माहिती नीट समजावून सांगितली.',
  },
  {
    label: 'Positive (Hindi / हिंदी)',
    reviewerName: 'अमित शर्मा',
    rating: 5,
    sentiment: 'positive',
    language: 'hi',
    tone: 'warm',
    text: 'बहुत अच्छी और तेज़ सर्विस मिली। स्टाफ का व्यवहार बहुत सहयोगी और विनम्र था।',
  },
  {
    label: 'Neutral (3 Stars)',
    reviewerName: 'Vikram Joshi',
    rating: 3,
    sentiment: 'neutral',
    language: 'en',
    tone: 'professional',
    text: 'The work was completed properly, but the waiting time in the evening was longer than expected.',
  },
  {
    label: 'Negative (Needs Support)',
    reviewerName: 'Neha Kulkarni',
    rating: 2,
    sentiment: 'negative',
    language: 'en',
    tone: 'apologetic',
    text: 'Had an issue with my form status and could not get an update on time. Please help resolve this.',
  },
];

export default function GoogleReviewsDashboardPage() {
  const [campaigns, setCampaigns] = useState<ReviewCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<ReviewCampaign | null>(null);
  const [reviewLogs, setReviewLogs] = useState<ReviewResponseLogItem[]>([]);
  const [gbpStatus, setGbpStatus] = useState<GbpIntegrationStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AIProviderStatusInfo | null>(null);
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentOriginStatus | null>(null);
  const [qrVerification, setQrVerification] = useState<QRVerificationResponse | null>(null);
  const [verifyingQr, setVerifyingQr] = useState(false);
  const [reviewSessionsCount, setReviewSessionsCount] = useState(0);

  // Dedicated RM Solution Settings State
  const [rmBusinessName, setRmBusinessName] = useState('RM Solution');
  const [rmGoogleReviewUrl, setRmGoogleReviewUrl] = useState(
    'https://g.page/r/CdT-R2IpVtpnEBM/review'
  );
  const [rmContactPhone, setRmContactPhone] = useState('7400342769');
  const [rmDefaultLanguage, setRmDefaultLanguage] = useState<ReviewReplyLanguage>('en');
  const [rmAgentEnabled, setRmAgentEnabled] = useState<boolean>(true);
  const [savingRmSettings, setSavingRmSettings] = useState(false);

  // Create Campaign Form State
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState(
    'https://g.page/r/CdT-R2IpVtpnEBM/review'
  );
  const [headline, setHeadline] = useState('How was your experience with us?');
  const [ctaText, setCtaText] = useState('Continue to Google Reviews');

  // AI Owner Reply Assistant State
  const [reviewerName, setReviewerName] = useState('Rahul Patil');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState(
    'Very fast and polite guidance at RM Solution. My online documentation work was completed smoothly on the first visit.'
  );
  const [replyLanguage, setReplyLanguage] = useState<ReviewReplyLanguage>('en');
  const [sentimentChoice, setSentimentChoice] = useState<ReviewSentiment | 'auto'>('auto');
  const [replyTone, setReplyTone] = useState<ReviewReplyTone>('warm');
  const [includePhoneMode, setIncludePhoneMode] = useState<'auto' | 'always' | 'never'>('auto');

  // Generated Output State
  const [replyOptions, setReplyOptions] = useState<string[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [draftReply, setDraftReply] = useState('');
  const [detectedSentiment, setDetectedSentiment] = useState<ReviewSentiment>('positive');
  const [contactPhoneIncluded, setContactPhoneIncluded] = useState(false);
  const [humanApproved, setHumanApproved] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [savingLog, setSavingLog] = useState(false);

  // Notices & Filters
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | ReviewSentiment>('all');

  const handleVerifyQrDestinations = async () => {
    setVerifyingQr(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_qr_destinations' }),
      });
      if (res.ok) {
        const data = await res.json();
        setQrVerification(data);
      }
    } finally {
      setVerifyingQr(false);
    }
  };

  const loadReviewsData = async () => {
    const res = await fetch('/api/reviews');
    if (res.ok) {
      const data = await res.json();
      const list: ReviewCampaign[] = data.reviewCampaigns || [];
      setCampaigns(list);
      setReviewLogs(data.reviewResponseLogs || []);
      if (typeof data.reviewSessionsCount === 'number') {
        setReviewSessionsCount(data.reviewSessionsCount);
      }
      if (data.gbpIntegration) {
        setGbpStatus(data.gbpIntegration);
      }
      if (data.aiProviderStatus) {
        setAiStatus(data.aiProviderStatus);
      }
      if (data.deploymentInfo) {
        setDeploymentInfo(data.deploymentInfo);
      }

      const rmCamp = list.find(
        (c) =>
          c.slug === 'rm-solution-reviews' ||
          c.slug === 'rm-solution' ||
          c.businessName.toLowerCase() === 'rm solution'
      );
      if (rmCamp) {
        setRmBusinessName(rmCamp.businessName || 'RM Solution');
        setRmGoogleReviewUrl(
          rmCamp.googleReviewUrl || 'https://g.page/r/CdT-R2IpVtpnEBM/review'
        );
        setRmContactPhone(rmCamp.contactPhone || '7400342769');
        setRmDefaultLanguage(rmCamp.defaultLanguage || 'en');
        setRmAgentEnabled(rmCamp.reviewAgentEnabled !== false);
      }

      if (list.length > 0 && !selectedCampaign) {
        setSelectedCampaign(rmCamp || list[0]);
      } else if (selectedCampaign) {
        const refreshed = list.find((c) => c.id === selectedCampaign.id);
        if (refreshed) setSelectedCampaign(refreshed);
      }
    }
  };

  useEffect(() => {
    loadReviewsData();
    handleVerifyQrDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveRmSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRmSettings(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_rm_solution_settings',
          businessName: rmBusinessName,
          googleReviewUrl: rmGoogleReviewUrl,
          contactPhone: rmContactPhone,
          defaultLanguage: rmDefaultLanguage,
          reviewAgentEnabled: rmAgentEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok && data.reviewCampaign) {
        setSelectedCampaign(data.reviewCampaign);
        await loadReviewsData();
        await handleVerifyQrDestinations();
        setStatusBanner({
          type: 'success',
          message: `Saved RM Solution Google Review URL (${data.reviewCampaign.googleReviewUrl}), support number (${data.reviewCampaign.contactPhone}), default language (${data.reviewCampaign.defaultLanguage || 'en'}), and AI Review Agent status.`,
        });
      } else {
        setStatusBanner({
          type: 'error',
          message: data.error || 'Failed to save RM Solution settings.',
        });
      }
    } finally {
      setSavingRmSettings(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !googleReviewUrl.trim()) return;

    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        businessName: businessName || name,
        googleReviewUrl,
        contactPhone: rmContactPhone,
        headline,
        ctaText,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setName('');
      setBusinessName('');
      setShowCreate(false);
      await loadReviewsData();
      if (data.reviewCampaign) {
        setSelectedCampaign(data.reviewCampaign);
      }
    }
  };

  const handleGenerateOwnerReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    setGeneratingReply(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_owner_reply',
          businessName: selectedCampaign?.businessName || rmBusinessName || 'RM Solution',
          reviewerName,
          rating: reviewRating,
          reviewText,
          tone: replyTone,
          language: replyLanguage,
          sentiment: sentimentChoice,
          contactPhone: rmContactPhone || '7400342769',
          includeContactPhone: includePhoneMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const opts: string[] = Array.isArray(data.replyOptions)
          ? data.replyOptions
          : [data.draftReply || ''];
        setReplyOptions(opts);
        setSelectedOptionIndex(0);
        setDraftReply(opts[0] || data.draftReply || '');
        if (data.sentiment) setDetectedSentiment(data.sentiment);
        setContactPhoneIncluded(Boolean(data.contactPhoneIncluded));
        setHumanApproved(false);
      }
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSaveToReviewDashboard = async (approvalStatus: 'draft' | 'approved') => {
    if (!reviewText.trim() || !draftReply.trim()) return;
    if (approvalStatus === 'approved' && !humanApproved) {
      setStatusBanner({
        type: 'warning',
        message:
          'Please check the Owner Approval confirmation box before saving a reply as Approved.',
      });
      return;
    }

    setSavingLog(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_review_response',
          campaignId: selectedCampaign?.id || null,
          businessName: selectedCampaign?.businessName || rmBusinessName || 'RM Solution',
          reviewerName: reviewerName || 'Valued Customer',
          rating: reviewRating,
          reviewText,
          sentiment: detectedSentiment,
          language: replyLanguage,
          tone: replyTone,
          replyOptions: replyOptions.length > 0 ? replyOptions : [draftReply],
          selectedReply: draftReply,
          includeContactPhone: contactPhoneIncluded,
          contactPhoneUsed: rmContactPhone || '7400342769',
          approvalStatus,
          humanApproved,
        }),
      });
      const data = await res.json();
      if (res.ok && data.reviewResponse) {
        await loadReviewsData();
        setStatusBanner({
          type: 'success',
          message:
            approvalStatus === 'approved'
              ? 'Reply approved and saved to the Review Management Dashboard. Use Copy Reply to post on your Google Business Profile.'
              : 'Reply saved as a Draft in the Review Management Dashboard.',
        });
      } else {
        setStatusBanner({
          type: 'error',
          message: data.error || 'Could not save review response.',
        });
      }
    } finally {
      setSavingLog(false);
    }
  };

  const handleCheckLiveGbpSync = async () => {
    setStatusBanner(null);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch_google_reviews' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusBanner({
        type: 'warning',
        message:
          data.error ||
          'Google Business Profile API OAuth is not configured. Please paste customer reviews manually below.',
      });
    }
  };

  const handleApproveExistingLog = async (item: ReviewResponseLogItem) => {
    const res = await fetch('/api/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_review_response',
        responseId: item.id,
        approvalStatus: 'approved',
        humanApproved: true,
      }),
    });
    if (res.ok) {
      await loadReviewsData();
      setStatusBanner({
        type: 'success',
        message: `Approved response for ${item.reviewerName}.`,
      });
    }
  };

  const handleDeleteLog = async (responseId: string) => {
    const res = await fetch(`/api/reviews?responseId=${encodeURIComponent(responseId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadReviewsData();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(null), 3000);
  };

  const activeBizName = selectedCampaign?.businessName || rmBusinessName || 'RM Solution';
  const activeGoogleUrl =
    !selectedCampaign ||
    selectedCampaign.slug === 'rm-solution-reviews' ||
    selectedCampaign.slug === 'rm-solution'
      ? rmGoogleReviewUrl.trim() ||
        selectedCampaign?.googleReviewUrl ||
        'https://g.page/r/CdT-R2IpVtpnEBM/review'
      : selectedCampaign.googleReviewUrl || 'https://g.page/r/CdT-R2IpVtpnEBM/review';

  const activePublicAgentUrl = deploymentInfo?.isPublicHttps
    ? deploymentInfo.publicAgentUrl
    : null;
  const localTestAgentPath =
    !selectedCampaign ||
    selectedCampaign.slug === 'rm-solution-reviews' ||
    selectedCampaign.slug === 'rm-solution'
      ? '/review/rm-solution'
      : `/review/${selectedCampaign.slug}`;

  const outreachTemplates = [
    {
      channel: 'Mode B — WhatsApp / SMS Direct Google Review Link (Works Immediately)',
      text: `Thank you for choosing ${activeBizName}! We would truly value your honest feedback on Google: ${activeGoogleUrl}`,
    },
    {
      channel: activePublicAgentUrl
        ? 'Mode A — Public AI Review Agent Link (Live HTTPS)'
        : 'Mode A — AI Review Agent Link (Deployment Required Before Sharing Externally)',
      text: activePublicAgentUrl
        ? `Hi! Thank you for visiting ${activeBizName}. Share your feedback with our AI Review Assistant in English, हिंदी, or मराठी: ${activePublicAgentUrl}`
        : `[Deployment Required: Deploy RMQR to a public HTTPS domain and set NEXT_PUBLIC_APP_URL first. For local PC testing only: http://localhost:3000${localTestAgentPath}]`,
    },
  ];

  const filteredLogs =
    sentimentFilter === 'all'
      ? reviewLogs
      : reviewLogs.filter((item) => item.sentiment === sentimentFilter);

  const languageLabel = (lang: ReviewReplyLanguage) => {
    if (lang === 'hi') return 'Hindi (हिंदी)';
    if (lang === 'mr') return 'Marathi (मराठी)';
    return 'English';
  };

  const sentimentBadgeStyle = (sentiment: ReviewSentiment) => {
    if (sentiment === 'positive') {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (sentiment === 'neutral') {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-500 mb-2">
            <Sparkles className="h-3.5 w-3.5" /> RM Solution — AI Review Agent &amp; Google Review Assistant
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            AI Review Agent &amp; Google Review Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage your customer-facing AI Review Agent (/review/rm-solution), Dual-Mode QR Standees, and Multilingual Owner Replies
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaigns.length > 1 && (
            <select
              aria-label="Select Review Campaign"
              value={selectedCampaign?.id || ''}
              onChange={(e) => {
                const found = campaigns.find((c) => c.id === e.target.value);
                if (found) setSelectedCampaign(found);
              }}
              data-testid="select-review-campaign"
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} ({c.slug})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            data-testid="new-review-campaign-btn"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/25"
          >
            <Plus className="h-4 w-4" />
            New Review QR Campaign
          </button>
        </div>
      </div>

      {copiedNotice && (
        <div
          role="status"
          data-testid="copied-notice-banner"
          className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Copied {copiedNotice} to clipboard!</span>
        </div>
      )}

      {statusBanner && (
        <div
          role="alert"
          data-testid="review-status-banner"
          className={`flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-semibold ${
            statusBanner.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : statusBanner.type === 'warning'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{statusBanner.message}</span>
        </div>
      )}

      {/* Honest Google Business Profile API & Integrity Notice */}
      <div
        data-testid="gbp-api-status-card"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 text-xs text-slate-600 dark:text-slate-300"
      >
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <strong className="text-slate-900 dark:text-white">
                Google Business Profile API &amp; Review Integrity Status:
              </strong>
              <span
                data-testid="gbp-connection-mode-badge"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30"
              >
                {gbpStatus?.configured
                  ? 'Google OAuth Connected'
                  : 'Manual Entry Mode (OAuth Not Connected)'}
              </span>
            </div>
            <p className="leading-relaxed">
              {gbpStatus?.statusMessage ||
                'RMQR never fabricates reviews or claims a reply was published to Google when OAuth is not connected. Paste any customer review below, generate English, Hindi, or Marathi reply options, approve your chosen response, and copy it to post on Google.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCheckLiveGbpSync}
          data-testid="check-gbp-sync-btn"
          className="inline-flex items-center gap-1.5 shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Check Live GBP API Status
        </button>
      </div>

      {/* Dedicated RM Solution Google Review & AI Agent Settings Card */}
      <form
        onSubmit={handleSaveRmSettings}
        data-testid="rm-solution-settings-card"
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-500">
              Dedicated Business Review &amp; AI Agent Configuration
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              RM Solution — Saved Google Review Link, Support Phone &amp; AI Agent Settings
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/review/rm-solution"
              target="_blank"
              data-testid="test-local-review-agent-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 px-3.5 py-2 text-xs font-bold text-violet-600 dark:text-violet-300"
            >
              Test AI Review Agent (/review/rm-solution) <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <a
              href={rmGoogleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="rm-direct-google-review-link"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3.5 py-2 text-xs font-bold text-amber-600 dark:text-amber-400"
            >
              Open RM Solution Google Review Page <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Business Name</label>
            <input
              type="text"
              value={rmBusinessName}
              onChange={(e) => setRmBusinessName(e.target.value)}
              data-testid="rm-solution-business-name-input"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-medium"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold mb-1">
              Official Google Review URL (RM Solution)
            </label>
            <input
              type="url"
              required
              value={rmGoogleReviewUrl}
              onChange={(e) => setRmGoogleReviewUrl(e.target.value)}
              data-testid="rm-solution-review-url-input"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Support Number (7400342769)
            </label>
            <div className="relative">
              <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rmContactPhone}
                onChange={(e) => setRmContactPhone(e.target.value)}
                data-testid="rm-solution-phone-input"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3.5 py-2 text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Default Agent Language
            </label>
            <select
              value={rmDefaultLanguage}
              onChange={(e) => setRmDefaultLanguage(e.target.value as ReviewReplyLanguage)}
              data-testid="rm-default-language-select"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="mr">Marathi (मराठी)</option>
            </select>
          </div>
        </div>

        {/* Status Bar inside RM Solution Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                AI Review Agent Status
              </span>
              <span
                data-testid="review-agent-status-badge"
                className={`text-xs font-extrabold ${
                  rmAgentEnabled ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {rmAgentEnabled ? 'Enabled (/review/rm-solution)' : 'Paused'}
              </span>
            </div>
            <input
              type="checkbox"
              aria-label="Enable AI Review Agent"
              checked={rmAgentEnabled}
              onChange={(e) => setRmAgentEnabled(e.target.checked)}
              data-testid="review-agent-enabled-toggle"
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AI Integration Status
            </span>
            <span
              data-testid="ai-integration-status-badge"
              className={`text-xs font-extrabold ${
                aiStatus?.configured ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              {aiStatus?.configured
                ? `Live AI (${aiStatus.provider.toUpperCase()})`
                : 'Grounded Template Mode (API Key Not Set)'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Public Deployment Status
            </span>
            <span
              data-testid="deployment-status-badge"
              className={`text-xs font-extrabold ${
                deploymentInfo?.isPublicHttps ? 'text-emerald-500' : 'text-amber-500'
              }`}
            >
              {deploymentInfo?.isPublicHttps ? 'Live Public HTTPS' : 'Deployment Required'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              QR Destination Verification
            </span>
            <span
              data-testid="qr-verification-status-badge"
              className={`text-xs font-extrabold ${
                qrVerification?.modeB?.verified ? 'text-emerald-500' : 'text-slate-400'
              }`}
            >
              {qrVerification?.modeB?.verified
                ? 'Mode B Verified (jsQR Pass)'
                : 'Verifying QR...'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-slate-500">
            Phone number <code className="font-mono font-bold">{rmContactPhone}</code> is included
            automatically only in neutral/negative replies or when a customer asks for support.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyQrDestinations}
              disabled={verifyingQr}
              data-testid="verify-qr-destinations-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${verifyingQr ? 'animate-spin' : ''}`} />
              {verifyingQr ? 'Verifying QR...' : 'Verify QR Destinations (jsQR)'}
            </button>
            <button
              type="button"
              onClick={() =>
                copyToClipboard(rmGoogleReviewUrl, 'RM Solution Google Review URL')
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Google Review Link
            </button>
            <button
              type="submit"
              disabled={savingRmSettings}
              data-testid="save-rm-settings-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white"
            >
              <Save className="h-3.5 w-3.5" />
              {savingRmSettings ? 'Saving...' : 'Save RM Solution Settings'}
            </button>
          </div>
        </div>
      </form>

      {showCreate && (
        <form
          onSubmit={handleCreateCampaign}
          className="rounded-3xl border border-violet-500/40 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-lg"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Connect Google Review Link &amp; Create Review QR
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Campaign Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Checkout Counter Review Standee"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Business Display Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="RM Solution"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              Legitimate Google Review Destination URL *
            </label>
            <input
              type="url"
              required
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/CdT-R2IpVtpnEBM/review"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Landing Page Headline</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Google Button CTA</label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="create-review-submit-btn"
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white"
            >
              Create Review QR Flow
            </button>
          </div>
        </form>
      )}

      {/* Main Grid: Left = AI Review Reply Assistant; Right = Active Campaign & Printable QR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Google Review AI Reply Assistant (English, Hindi, Marathi) */}
          <div
            data-testid="review-ai-assistant-panel"
            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-5 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                  <MessageSquareReply className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Google Review AI Reply Assistant (English, हिंदी &amp; मराठी)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Paste a customer review to generate 3 tailored, non-hallucinating reply options
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" /> Zero-Hallucination Guard
              </span>
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                Quick Test Samples (Click to load a sample review):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_REVIEWS.map((sample, idx) => (
                  <button
                    key={sample.label}
                    type="button"
                    data-testid={`sample-review-btn-${idx}`}
                    onClick={() => {
                      setReviewerName(sample.reviewerName);
                      setReviewRating(sample.rating);
                      setSentimentChoice(sample.sentiment);
                      setReplyLanguage(sample.language);
                      setReplyTone(sample.tone);
                      setReviewText(sample.text);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-violet-500/50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleGenerateOwnerReply} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="e.g. Rahul Patil"
                    data-testid="reviewer-name-input"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Star Rating</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    data-testid="review-rating-select"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value={5}>5 Stars (Excellent)</option>
                    <option value={4}>4 Stars (Good)</option>
                    <option value={3}>3 Stars (Neutral)</option>
                    <option value={2}>2 Stars (Needs Attention)</option>
                    <option value={1}>1 Star (Critical Feedback)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Sentiment Category</label>
                  <select
                    value={sentimentChoice}
                    onChange={(e) =>
                      setSentimentChoice(e.target.value as ReviewSentiment | 'auto')
                    }
                    data-testid="review-sentiment-select"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="auto">Auto-Detect Sentiment</option>
                    <option value="positive">Positive Review</option>
                    <option value="neutral">Neutral Review</option>
                    <option value="negative">Negative Review</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    <Globe2 className="inline h-3.5 w-3.5 mr-1 text-violet-500" />
                    Reply Language
                  </label>
                  <select
                    value={replyLanguage}
                    onChange={(e) => setReplyLanguage(e.target.value as ReviewReplyLanguage)}
                    data-testid="reply-language-select"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="mr">Marathi (मराठी)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Response Tone</label>
                  <select
                    value={replyTone}
                    onChange={(e) => setReplyTone(e.target.value as ReviewReplyTone)}
                    data-testid="reply-tone-select"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="warm">Warm &amp; Personal</option>
                    <option value="professional">Polished &amp; Professional</option>
                    <option value="apologetic">Empathetic &amp; Resolution-Focused</option>
                    <option value="concise">Short &amp; Concise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Include Phone ({rmContactPhone})
                  </label>
                  <select
                    value={includePhoneMode}
                    onChange={(e) =>
                      setIncludePhoneMode(e.target.value as 'auto' | 'always' | 'never')
                    }
                    data-testid="reply-phone-mode-select"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="auto">Auto (Only When Relevant)</option>
                    <option value="always">Always Include {rmContactPhone}</option>
                    <option value="never">Do Not Include Phone</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Paste Customer Review Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Paste the customer's review from Google here..."
                  data-testid="review-text-input"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={generatingReply}
                data-testid="generate-reply-draft-btn"
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/20"
              >
                <Sparkles className="h-4 w-4" />
                {generatingReply
                  ? 'Generating Reply Options...'
                  : 'Generate 3 Personalized Reply Options'}
              </button>
            </form>

            {draftReply && (
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Generated Reply Options ({replyOptions.length || 1}):
                    </span>
                    <span
                      data-testid="detected-sentiment-badge"
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${sentimentBadgeStyle(
                        detectedSentiment
                      )}`}
                    >
                      {detectedSentiment}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-500">
                      {languageLabel(replyLanguage)}
                    </span>
                    <span
                      data-testid="phone-relevance-indicator"
                      className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                    >
                      {contactPhoneIncluded
                        ? `Phone ${rmContactPhone} included (relevant)`
                        : 'Phone omitted (not needed for positive thank-you)'}
                    </span>
                  </div>
                </div>

                {/* Multiple Reply Options Selector */}
                {replyOptions.length > 1 && (
                  <div className="grid grid-cols-1 gap-2.5" data-testid="reply-options-list">
                    {replyOptions.map((optionText, idx) => {
                      const isSelected = selectedOptionIndex === idx;
                      const optionLabel =
                        idx === 0
                          ? 'Option 1 — Recommended Match'
                          : idx === 1
                          ? 'Option 2 — Alternative Phrasing'
                          : 'Option 3 — Concise Version';
                      return (
                        <button
                          key={idx}
                          type="button"
                          data-testid={`reply-option-${idx}`}
                          onClick={() => {
                            setSelectedOptionIndex(idx);
                            setDraftReply(optionText);
                          }}
                          className={`text-left rounded-2xl border p-3.5 transition-all ${
                            isSelected
                              ? 'border-violet-500 bg-violet-500/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-violet-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-violet-500">
                              {optionLabel}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {isSelected ? 'Selected for Editing' : 'Click to Select'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                            {optionText}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Editable Selected Reply Box */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-emerald-500">
                    Review &amp; Edit Selected Reply Before Copying or Approving:
                  </label>
                  <textarea
                    rows={3}
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    data-testid="owner-reply-textarea"
                    className="w-full rounded-xl border border-emerald-500/40 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed"
                  />
                </div>

                {/* Mandatory Owner Approval Gate */}
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={humanApproved}
                    onChange={(e) => setHumanApproved(e.target.checked)}
                    data-testid="approve-reply-checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong>Owner Approval Required:</strong> I have reviewed this reply and confirm
                    it is accurate and ready to share. (Replies are never published without your
                    approval.)
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="copy-selected-reply-btn"
                    onClick={() => copyToClipboard(draftReply, 'Selected Review Reply')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy Selected Reply
                  </button>

                  <button
                    type="button"
                    disabled={savingLog}
                    data-testid="save-approved-reply-btn"
                    onClick={() => handleSaveToReviewDashboard('approved')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Save to Dashboard
                  </button>

                  <button
                    type="button"
                    disabled={savingLog}
                    data-testid="save-draft-reply-btn"
                    onClick={() => handleSaveToReviewDashboard('draft')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
                  >
                    Save as Draft
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Copyable Review Request Messages */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Copyable Review-Request Messages for Customers
            </h3>
            <div className="space-y-3">
              {outreachTemplates.map((tpl) => (
                <div
                  key={tpl.channel}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-500">{tpl.channel}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(tpl.text, tpl.channel)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold"
                    >
                      <Copy className="h-3 w-3" /> Copy Message
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-all">
                    {tpl.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Active Campaign Stats & Dual-Mode QR Standees (Mode A & Mode B) */}
        {selectedCampaign && (
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
                    Active Review Campaign
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {selectedCampaign.name}
                  </h2>
                </div>
                <Link
                  href={localTestAgentPath}
                  target="_blank"
                  data-testid="open-public-review-flow-link"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 shrink-0"
                >
                  Open AI Review Flow <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
                  <span className="text-[11px] text-slate-500 block">Page Views / Scans</span>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {selectedCampaign.scanCount || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
                  <span className="text-[11px] text-slate-500 block">AI Sessions</span>
                  <div
                    className="text-xl font-extrabold text-violet-500 mt-1"
                    data-testid="review-agent-sessions-count"
                  >
                    {reviewSessionsCount}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
                  <span className="text-[11px] text-slate-500 block">Google Clicks</span>
                  <div
                    className="text-xl font-extrabold text-amber-500 mt-1"
                    data-testid="review-google-clicks"
                  >
                    {selectedCampaign.googleClickCount || 0}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <div>
                  <strong>Connected Google Review Destination:</strong>{' '}
                  <a
                    href={selectedCampaign.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-500 hover:underline break-all"
                  >
                    {selectedCampaign.googleReviewUrl}
                  </a>
                </div>
                {selectedCampaign.contactPhone && (
                  <div>
                    <strong>Support Phone for Follow-Up Replies:</strong>{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedCampaign.contactPhone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* MODE B — Direct Google Review QR (Works Immediately on Any Phone) */}
            <div
              data-testid="review-qr-standee-card"
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 block">
                      Mode B — Direct Google Review QR
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Print-Ready Google Review Standee ({selectedCampaign.businessName})
                    </h2>
                  </div>
                </div>
                <span
                  data-testid="qr-mobile-ready-badge"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500 shrink-0"
                >
                  <CheckCircle2 className="h-3 w-3" /> Mobile Data Ready
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Encodes your official Google Review URL directly. Works immediately on any customer&apos;s phone over mobile data without requiring RMQR hosting.
              </p>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Exact URL Encoded in Mode B QR Code:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeGoogleUrl, 'Google Review URL')}
                      data-testid="copy-google-review-url-btn"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-violet-500"
                    >
                      <Copy className="h-3 w-3" /> Copy URL
                    </button>
                    <a
                      href={activeGoogleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="open-qr-destination-btn"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-500 hover:underline"
                    >
                      Test Encoded Link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div
                  data-testid="qr-encoded-destination-url"
                  className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all"
                >
                  {activeGoogleUrl}
                </div>
              </div>

              {qrVerification && (
                <div
                  data-testid="qr-verification-result-box"
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-300 space-y-1"
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    jsQR Decoded Payload Verification:
                  </div>
                  <div>
                    PNG Decoded: <code className="font-mono">{qrVerification.modeB.pngDecodedUrl}</code>
                  </div>
                  <div>
                    SVG Decoded: <code className="font-mono">{qrVerification.modeB.svgDecodedUrl}</code>
                  </div>
                </div>
              )}

              <QRPreviewCard
                content={activeGoogleUrl}
                name={`${selectedCampaign.businessName}-google-reviews`}
                size={230}
                styleConfig={{
                  fgColor: '#0B0F19',
                  bgColor: '#FFFFFF',
                  eyeColor: '#7C3AED',
                  pattern: 'rounded',
                  eyeStyle: 'rounded',
                  frameStyle: 'banner_bottom',
                  frameText: 'REVIEW US ON GOOGLE',
                  frameColor: '#7C3AED',
                  errorCorrectionLevel: 'M',
                  margin: 4,
                }}
              />
            </div>

            {/* MODE A — AI Agent Website QR (/review/rm-solution) */}
            <div
              data-testid="mode-a-ai-agent-qr-card"
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 block">
                      Mode A — AI Review Agent Website QR
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Conversational AI Review Assistant ({localTestAgentPath})
                    </h2>
                  </div>
                </div>
                <span
                  data-testid="mode-a-deployment-badge"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                    activePublicAgentUrl
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {activePublicAgentUrl ? 'Live Public HTTPS' : 'Deployment Required'}
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Opens the multilingual AI Review Agent website in English, हिंदी, and मराठी where customers answer 4 quick questions, get a tailored review draft, copy it, and open Google Reviews.
              </p>

              {activePublicAgentUrl ? (
                <>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Public AI Review Agent URL Encoded in Mode A QR:
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activePublicAgentUrl, 'Public AI Agent URL')}
                        data-testid="copy-public-agent-url-btn"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-500 hover:underline"
                      >
                        <Copy className="h-3 w-3" /> Copy Public URL
                      </button>
                    </div>
                    <div
                      data-testid="public-ai-agent-url-status"
                      className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all"
                    >
                      {activePublicAgentUrl}
                    </div>
                  </div>

                  <QRPreviewCard
                    content={activePublicAgentUrl}
                    name={`${selectedCampaign.businessName}-ai-review-agent`}
                    size={230}
                    styleConfig={{
                      fgColor: '#0B0F19',
                      bgColor: '#FFFFFF',
                      eyeColor: '#4F46E5',
                      pattern: 'rounded',
                      eyeStyle: 'rounded',
                      frameStyle: 'banner_bottom',
                      frameText: 'SCAN FOR AI REVIEW HELPER',
                      frameColor: '#4F46E5',
                      errorCorrectionLevel: 'M',
                      margin: 4,
                    }}
                  />
                </>
              ) : (
                <div
                  data-testid="mode-a-localhost-warning-box"
                  className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs space-y-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-slate-700 dark:text-slate-200">
                      <div className="font-bold text-amber-600 dark:text-amber-400">
                        Public HTTPS Deployment Required for Customer Phone Scanning (Mode A)
                      </div>
                      <p className="leading-relaxed">
                        RMQR is currently running on <code className="font-mono">http://localhost:3000</code>. Because <code className="font-mono">localhost</code> only points to this computer, RMQR refuses to encode <code className="font-mono">localhost</code> into a printable customer QR code.
                      </p>
                      <p
                        data-testid="public-ai-agent-url-status"
                        className="text-[11px] text-slate-600 dark:text-slate-300 font-medium"
                      >
                        Public AI Review Agent URL Status: Not Deployed Yet — deploy this app to Vercel / Cloudflare / Railway and set <code className="font-mono">NEXT_PUBLIC_APP_URL=https://your-domain.com</code> to unlock the Mode A printable QR code. Until then, print and use <strong>Mode B — Direct Google Review QR</strong> above!
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={localTestAgentPath}
                      target="_blank"
                      data-testid="open-local-agent-test-link"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-bold text-white"
                    >
                      Test AI Agent on This PC ({localTestAgentPath}) <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `http://localhost:3000${localTestAgentPath}`,
                          'Local Test URL (This PC Only)'
                        )
                      }
                      data-testid="copy-local-agent-url-btn"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Local Test URL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Review Management Dashboard Table / Log */}
      <div
        data-testid="review-management-dashboard"
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Review Management Dashboard ({filteredLogs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Track customer reviews, sentiment categories, approved multilingual responses, and copy replies to post on Google
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'positive', 'neutral', 'negative'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                data-testid={`filter-sentiment-${filter}`}
                onClick={() => setSentimentFilter(filter)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  sentimentFilter === filter
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {filter === 'all' ? 'All Reviews' : filter}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div
            data-testid="empty-review-logs-state"
            className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center space-y-2"
          >
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No saved review responses yet
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              Paste a customer review in the AI Reply Assistant above, generate English, Hindi, or
              Marathi reply options, and click &ldquo;Approve &amp; Save to Dashboard&rdquo; to track
              it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="review-logs-list">
            {filteredLogs.map((item) => (
              <div
                key={item.id}
                data-testid={`review-log-item-${item.id}`}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {item.reviewerName}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-500">
                      {'★'.repeat(item.rating)} ({item.rating}/5)
                    </span>
                    <span
                      data-testid={`log-sentiment-${item.id}`}
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${sentimentBadgeStyle(
                        item.sentiment
                      )}`}
                    >
                      {item.sentiment}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold text-violet-500">
                      {languageLabel(item.language)}
                    </span>
                    <span
                      data-testid={`log-approval-${item.id}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        item.approvalStatus === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.approvalStatus === 'approved'
                        ? 'Approved by Owner'
                        : 'Draft — Needs Approval'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.approvalStatus === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleApproveExistingLog(item)}
                        data-testid={`approve-log-btn-${item.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-[11px] font-bold text-white"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="copy-saved-reply-btn"
                      onClick={() =>
                        copyToClipboard(item.selectedReply, `Reply for ${item.reviewerName}`)
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white"
                    >
                      <Copy className="h-3 w-3" /> Copy Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLog(item.id)}
                      aria-label="Delete saved review response"
                      className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Customer Review
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {item.reviewText}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">
                      Generated &amp; Selected Response ({item.businessName})
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                      {item.selectedReply}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
