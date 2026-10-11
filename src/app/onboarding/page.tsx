'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import { CheckCircle2, ArrowRight, Sparkles, ExternalLink } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(2); // Step 1 (Account Created) is already complete
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('Restaurant & Hospitality');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7C3AED');
  const [secondaryColor, setSecondaryColor] = useState('#0B0F19');
  const [firstQrName, setFirstQrName] = useState('Main Business Website QR');
  const [firstQrUrl, setFirstQrUrl] = useState('https://example.com');
  const [createdQr, setCreatedQr] = useState<{
    id: string;
    slug: string;
    encodedContent: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.activeOrg) {
          setBusinessName(data.activeOrg.name || '');
          setIndustry(data.activeOrg.industry || 'Restaurant & Hospitality');
          setPrimaryColor(data.activeOrg.brandPrimaryColor || '#7C3AED');
          setSecondaryColor(data.activeOrg.brandSecondaryColor || '#0B0F19');
        }
      })
      .catch(() => {});
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveStepProgress = async (nextStep: number, completed = false) => {
    setLoading(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          industry,
          logoUrl: logoDataUrl || undefined,
          brandPrimaryColor: primaryColor,
          brandSecondaryColor: secondaryColor,
          onboardingStep: nextStep,
          onboardingCompleted: completed,
        }),
      });
      setStep(nextStep);
      if (completed) {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFirstQr = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: firstQrName,
          qrType: 'dynamic',
          contentType: 'url',
          destinationUrl: firstQrUrl,
          styleConfig: {
            fgColor: secondaryColor,
            bgColor: '#FFFFFF',
            eyeColor: primaryColor,
            pattern: 'rounded',
            eyeStyle: 'rounded',
            frameStyle: 'banner_bottom',
            frameText: 'SCAN ME',
            frameColor: primaryColor,
            logoDataUrl: logoDataUrl || undefined,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.qrCode) {
        setCreatedQr(data.qrCode);
        await saveStepProgress(6, false);
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Account' },
    { num: 2, label: 'Business' },
    { num: 3, label: 'Logo' },
    { num: 4, label: 'Theme' },
    { num: 5, label: 'First QR' },
    { num: 6, label: 'Publish & Test' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19] px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <BrandLogo size="md" showTagline />
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Skip to Dashboard &rarr;
          </Link>
        </div>

        {/* 6-Step Progress Bar */}
        <div className="grid grid-cols-6 gap-2">
          {steps.map((s) => {
            const done = step > s.num;
            const current = step === s.num;
            return (
              <div
                key={s.num}
                className={`rounded-xl border p-2.5 text-center transition-colors ${
                  done
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : current
                    ? 'border-violet-500 bg-violet-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                }`}
              >
                <div className="text-[11px] font-bold">Step {s.num}</div>
                <div className="text-xs font-semibold truncate">{s.label}</div>
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-xl">
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Step 2 of 6
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Confirm Your Business &amp; Industry
                </h1>
                <p className="text-sm text-slate-500">
                  We tailor templates for your restaurant menus, review standees, and landing pages.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Saffron & Slate Bistro"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm"
                  >
                    <option value="Restaurant & Hospitality">Restaurant &amp; Hospitality</option>
                    <option value="Clinic & Healthcare">Clinic &amp; Healthcare</option>
                    <option value="Retail & E-Commerce">Retail &amp; E-Commerce</option>
                    <option value="Salon & Wellness">Salon &amp; Wellness</option>
                    <option value="Marketing Agency">Marketing Agency</option>
                    <option value="General Business">General Business</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => saveStepProgress(3)}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-bold text-white"
                >
                  Continue to Brand Logo <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Step 3 of 6 (Optional)
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Upload Your Brand Logo
                </h1>
                <p className="text-sm text-slate-500">
                  Your logo can be embedded in the center of your QR codes and at the top of your digital menus.
                </p>
              </div>
              <div className="space-y-4">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white"
                />
                {logoDataUrl && (
                  <div className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDataUrl} alt="Uploaded logo" className="h-14 w-14 object-contain rounded-lg" />
                    <span className="text-xs font-semibold text-emerald-500">Logo ready for QR overlay</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => saveStepProgress(4)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-bold text-white"
                  >
                    {logoDataUrl ? 'Save Logo & Continue' : 'Skip & Continue'}{' '}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Step 4 of 6
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Choose Your Brand Theme
                </h1>
                <p className="text-sm text-slate-500">
                  Select your primary accent and dark foreground colors.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Primary Accent Color</label>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-12 w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">QR Matrix Foreground</label>
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-12 w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => saveStepProgress(5)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-bold text-white"
              >
                Continue to First QR Code <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">
                  Step 5 of 6
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Create Your First Dynamic QR Code
                </h1>
                <p className="text-sm text-slate-500">
                  You can update this destination link anytime after printing.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">QR Code Name</label>
                    <input
                      type="text"
                      value={firstQrName}
                      onChange={(e) => setFirstQrName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Destination URL</label>
                    <input
                      type="url"
                      value={firstQrUrl}
                      onChange={(e) => setFirstQrUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateFirstQr}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-sm font-bold text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'Generating...' : 'Publish First Dynamic QR'}
                  </button>
                </div>
                <QRPreviewCard
                  content={firstQrUrl}
                  name={firstQrName}
                  size={180}
                  showExportButtons={false}
                  styleConfig={{
                    fgColor: secondaryColor,
                    bgColor: '#FFFFFF',
                    eyeColor: primaryColor,
                    frameColor: primaryColor,
                    pattern: 'rounded',
                    eyeStyle: 'rounded',
                    frameStyle: 'banner_bottom',
                    frameText: 'SCAN ME',
                    logoDataUrl: logoDataUrl || undefined,
                  }}
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 text-center py-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  Step 6 of 6 — Published &amp; Live
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Your First Dynamic QR Code Is Ready!
                </h1>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Scan the code below with your phone camera or click the test redirect link to verify that it records a live scan event.
                </p>
              </div>

              {createdQr && (
                <div className="max-w-xs mx-auto space-y-3">
                  <QRPreviewCard
                    content={createdQr.encodedContent}
                    name={firstQrName}
                    size={200}
                  />
                  <a
                    href={`/r/${createdQr.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Test Redirect Link (/r/{createdQr.slug}) <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => saveStepProgress(6, true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25"
                >
                  Enter RMQR Dashboard <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
