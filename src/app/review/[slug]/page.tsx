import React from 'react';
import Link from 'next/link';
import { findReviewCampaignBySlug, mutateDb, readDb } from '@/lib/db/store';
import { getAIProviderStatus } from '@/lib/ai/agent-engine';
import { PublicReviewFlowClient } from '@/components/PublicReviewFlowClient';
import { ExternalLink, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PublicReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ session?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const db = readDb();

  const campaign = findReviewCampaignBySlug(db, slug);

  if (!campaign) {
    return (
      <div
        data-testid="invalid-review-route-card"
        className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6"
      >
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold">Review Session Unavailable</h1>
          <p className="text-sm text-slate-400">
            This review link does not exist or may have been moved.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white"
          >
            Powered by RMQR
          </Link>
        </div>
      </div>
    );
  }

  if (campaign.status !== 'active' || campaign.reviewAgentEnabled === false) {
    return (
      <div
        data-testid="paused-review-agent-card"
        className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6"
      >
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-5">
          <h1 className="text-2xl font-extrabold">
            {campaign.businessName} — Review Assistant Paused
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The interactive AI review assistant is currently paused, but you can still share your
            honest feedback directly on Google Reviews below.
          </p>
          <a
            href={campaign.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="google-review-destination-btn"
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 hover:bg-violet-500 py-3.5 px-6 text-sm font-extrabold text-white"
          >
            <span>Open {campaign.businessName} Google Reviews</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  // Check if an optional ?session=... query param was passed and whether it is valid
  let invalidSessionNotice = false;
  if (resolvedSearch.session) {
    const reqSessionId = String(resolvedSearch.session).trim();
    const foundSession = (db.customerReviewSessions || []).find(
      (s) => s.id === reqSessionId && s.campaignId === campaign.id
    );
    if (!foundSession) {
      invalidSessionNotice = true;
    }
  }

  mutateDb((state) => {
    const target = state.reviewCampaigns.find((r) => r.id === campaign.id);
    if (target) {
      target.scanCount = (target.scanCount || 0) + 1;
    }
  });

  const aiStatus = getAIProviderStatus();

  return (
    <PublicReviewFlowClient
      campaign={{
        id: campaign.id,
        slug: campaign.slug,
        businessName: campaign.businessName,
        googleReviewUrl: campaign.googleReviewUrl,
        contactPhone: campaign.contactPhone,
        headline: campaign.headline,
        subheadline: campaign.subheadline,
        ctaText: campaign.ctaText,
        brandColor: campaign.brandColor,
        suggestedHighlights: campaign.suggestedHighlights,
        aiDraftsEnabled: campaign.aiDraftsEnabled,
        defaultLanguage: campaign.defaultLanguage || 'en',
        supportedLanguages: campaign.supportedLanguages || ['en', 'hi', 'mr'],
      }}
      aiConfigured={aiStatus.configured}
      aiProvider={aiStatus.provider}
      invalidSessionNotice={invalidSessionNotice}
    />
  );
}

