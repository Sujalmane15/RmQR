import React from 'react';
import Link from 'next/link';
import { mutateDb, readDb } from '@/lib/db/store';
import { LandingPageClientButtons } from '@/components/LandingPageClientButtons';
import { Globe, MapPin, Phone, Clock, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = readDb();
  const page = db.landingPages.find(
    (p) => p.slug.toLowerCase() === slug.toLowerCase()
  );

  if (!page || page.status !== 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4">
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400">
            Page Unavailable
          </span>
          <h1 className="text-2xl font-extrabold">Landing Page Not Published</h1>
          <p className="text-sm text-slate-400">
            This landing page is either in draft mode or does not exist.
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

  // Record view count
  mutateDb((state) => {
    const target = state.landingPages.find((p) => p.id === page.id);
    if (target) {
      target.viewCount = (target.viewCount || 0) + 1;
    }
  });

  const blocks = db.landingPageBlocks
    .filter((b) => b.landingPageId === page.id && b.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const primaryColor = page.themeConfig?.primaryColor || '#7C3AED';
  const bgColor = page.themeConfig?.bgColor || '#0B0F19';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-12 px-4"
      style={{ backgroundColor: bgColor, color: '#FFFFFF' }}
    >
      <main className="w-full max-w-md space-y-6 text-center">
        <div
          className="h-20 w-20 rounded-3xl mx-auto flex items-center justify-center text-3xl font-extrabold shadow-xl"
          style={{ backgroundColor: primaryColor }}
        >
          {page.title.slice(0, 1).toUpperCase()}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="public-lp-title">
            {page.title}
          </h1>
          {page.description && (
            <p className="text-sm text-slate-300 leading-relaxed" data-testid="public-lp-desc">
              {page.description}
            </p>
          )}
        </div>

        {/* Contact Chips */}
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {page.contactInfo?.phone && (
            <a
              href={`tel:${page.contactInfo.phone}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 hover:bg-white/20"
            >
              <Phone className="h-3.5 w-3.5" /> {page.contactInfo.phone}
            </a>
          )}
          {page.contactInfo?.address && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
              <MapPin className="h-3.5 w-3.5" /> {page.contactInfo.address}
            </span>
          )}
          {page.contactInfo?.openingHours && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5">
              <Clock className="h-3.5 w-3.5" /> {page.contactInfo.openingHours}
            </span>
          )}
          {page.contactInfo?.website && (
            <a
              href={page.contactInfo.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 hover:bg-white/20"
            >
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </div>

        {/* Interactive Tracked Action Buttons */}
        <LandingPageClientButtons
          landingPageId={page.id}
          blocks={blocks}
          primaryColor={primaryColor}
        />
      </main>

      <footer className="pt-10 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          Verified RMQR Page
        </Link>
      </footer>
    </div>
  );
}
