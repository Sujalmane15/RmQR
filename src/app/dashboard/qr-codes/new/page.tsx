'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Campaign,
  DEFAULT_QR_STYLE,
  QRContentType,
  QREyeStyle,
  QRFolder,
  QRFrameStyle,
  QRPatternType,
  QRType,
} from '@/lib/types';
import { formatQRContentPayload } from '@/lib/qr/renderer';
import { QRPreviewCard } from '@/components/QRPreviewCard';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Info,
  Lock,
  Sparkles,
} from 'lucide-react';

const CONTENT_TYPES: Array<{ id: QRContentType; label: string; supportsDynamic: boolean }> = [
  { id: 'url', label: 'Website URL', supportsDynamic: true },
  { id: 'ai_agent', label: 'AI Agent QR', supportsDynamic: true },
  { id: 'google_review', label: 'Google Review Link', supportsDynamic: true },
  { id: 'menu', label: 'Restaurant Menu', supportsDynamic: true },
  { id: 'landing_page', label: 'Custom Landing Page', supportsDynamic: true },
  { id: 'whatsapp', label: 'WhatsApp Chat', supportsDynamic: true },
  { id: 'social', label: 'Social Media Link', supportsDynamic: true },
  { id: 'file', label: 'File / Document Link', supportsDynamic: true },
  { id: 'location', label: 'Map Location', supportsDynamic: true },
  { id: 'text', label: 'Plain Text', supportsDynamic: false },
  { id: 'wifi', label: 'Wi-Fi Network', supportsDynamic: false },
  { id: 'vcard', label: 'vCard Contact', supportsDynamic: false },
  { id: 'email', label: 'Email Message', supportsDynamic: false },
  { id: 'phone', label: 'Phone Call', supportsDynamic: false },
  { id: 'sms', label: 'SMS Message', supportsDynamic: false },
];

export default function NewQRCodeStudioPage() {
  const router = useRouter();

  const [qrType, setQrType] = useState<QRType>('dynamic');
  const [contentType, setContentType] = useState<QRContentType>('url');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [folderId, setFolderId] = useState('');
  const [campaignId, setCampaignId] = useState('');

  // Content Type Specific Fields
  const [url, setUrl] = useState('https://example.com');
  const [text, setText] = useState('Welcome to RMQR!');
  const [email, setEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [phone, setPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Hi! I scanned your QR code.');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [vcardFirstName, setVcardFirstName] = useState('');
  const [vcardLastName, setVcardLastName] = useState('');
  const [vcardOrg, setVcardOrg] = useState('');
  const [vcardPhone, setVcardPhone] = useState('');
  const [vcardEmail, setVcardEmail] = useState('');
  const [vcardWebsite, setVcardWebsite] = useState('');
  const [locationQuery, setLocationQuery] = useState('');

  // Dynamic Advanced Settings
  const [expiresAt, setExpiresAt] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [password, setPassword] = useState('');

  // Visual Design Controls
  const [fgColor, setFgColor] = useState(DEFAULT_QR_STYLE.fgColor);
  const [bgColor, setBgColor] = useState(DEFAULT_QR_STYLE.bgColor);
  const [eyeColor, setEyeColor] = useState(DEFAULT_QR_STYLE.eyeColor || '#7C3AED');
  const [pattern, setPattern] = useState<QRPatternType>('rounded');
  const [eyeStyle, setEyeStyle] = useState<QREyeStyle>('rounded');
  const [frameStyle, setFrameStyle] = useState<QRFrameStyle>('banner_bottom');
  const [frameText, setFrameText] = useState('SCAN ME');
  const [margin, setMargin] = useState(4);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [logoSizeRatio, setLogoSizeRatio] = useState(0.2);

  const [folders, setFolders] = useState<QRFolder[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/qr-codes')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setFolders(data.folders || []);
          setCampaigns(data.campaigns || []);
        }
      })
      .catch(() => {});
  }, []);

  const currentTypeMeta = CONTENT_TYPES.find((c) => c.id === contentType);

  const handleContentTypeChange = (nextType: QRContentType) => {
    setContentType(nextType);
    const meta = CONTENT_TYPES.find((c) => c.id === nextType);
    if (meta && !meta.supportsDynamic) {
      setQrType('static');
    } else if (nextType === 'google_review') {
      setQrType('static');
      setFrameText('REVIEW US ON GOOGLE');
      if (!url || url === 'https://example.com') {
        setUrl('https://g.page/r/CdT-R2IpVtpnEBM/review');
      }
    }
  };

  const formattedPayload = useMemo(
    () =>
      formatQRContentPayload({
        contentType,
        url,
        text,
        email,
        emailSubject,
        emailBody,
        phone,
        smsMessage,
        whatsappNumber,
        whatsappMessage,
        wifiSsid,
        wifiPassword,
        wifiEncryption,
        vcardFirstName,
        vcardLastName,
        vcardOrg,
        vcardPhone,
        vcardEmail,
        vcardWebsite,
        locationQuery,
        googleReviewUrl: url,
        menuUrl: url,
        socialUrl: url,
        fileUrl: url,
        landingPageUrl: url,
      }),
    [
      contentType,
      url,
      text,
      email,
      emailSubject,
      emailBody,
      phone,
      smsMessage,
      whatsappNumber,
      whatsappMessage,
      wifiSsid,
      wifiPassword,
      wifiEncryption,
      vcardFirstName,
      vcardLastName,
      vcardOrg,
      vcardPhone,
      vcardEmail,
      vcardWebsite,
      locationQuery,
    ]
  );

  const previewEncodedString = useMemo(() => {
    if (qrType === 'dynamic') {
      const previewSlug = slug.trim() || 'your-short-slug';
      return `http://localhost:3000/r/${previewSlug}`;
    }
    return formattedPayload;
  }, [qrType, slug, formattedPayload]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Center logo image must be smaller than 2 MB.');
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

  const handleSaveQR = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || `${contentType.toUpperCase()} QR Code`,
          slug: slug.trim() || undefined,
          description,
          qrType,
          contentType,
          encodedContent: formattedPayload,
          destinationUrl: qrType === 'dynamic' ? formattedPayload : undefined,
          folderId: folderId || null,
          campaignId: campaignId || null,
          tags: tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          expiresAt: expiresAt || null,
          fallbackUrl: fallbackUrl.trim() || undefined,
          password: password || undefined,
          styleConfig: {
            fgColor,
            bgColor,
            eyeColor,
            pattern,
            eyeStyle,
            frameStyle,
            frameText,
            frameColor: eyeColor,
            margin,
            logoDataUrl,
            logoSizeRatio,
            errorCorrectionLevel: logoDataUrl ? 'H' : 'M',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save QR code.');
      } else {
        router.push(`/dashboard/qr-codes/${data.qrCode.id}`);
      }
    } catch {
      setError('Network error while creating QR code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          RMQR Studio
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Create &amp; Customize QR Code
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Choose between Static (direct encoding) or Dynamic (editable redirect link + scan analytics)
        </p>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="studio-error"
          className="flex items-center gap-2 rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSaveQR} className="lg:col-span-7 space-y-6">
          {/* Step 1: Static vs Dynamic QR Type */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              1. Select QR Mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="select-dynamic-qr"
                disabled={currentTypeMeta && !currentTypeMeta.supportsDynamic}
                onClick={() => setQrType('dynamic')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  qrType === 'dynamic'
                    ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-80'
                } disabled:opacity-40`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-violet-500" /> Dynamic QR
                  </span>
                  <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    Editable + Tracked
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Encodes a short RMQR redirect URL (/r/[slug]). Change the destination anytime without reprinting and track real-time scans.
                </p>
              </button>

              <button
                type="button"
                data-testid="select-static-qr"
                onClick={() => setQrType('static')}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  qrType === 'static'
                    ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-slate-500" /> Static QR
                  </span>
                  <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    Permanent Payload
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Encodes the destination or text directly into the QR image. Cannot be edited after printing and does not track scan events.
                </p>
              </button>
            </div>

            {qrType === 'static' && (
              <div className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-400">
                <Info className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Static QR Notice:</strong> Because static QR codes encode data directly without passing through an RMQR redirect server, their destination cannot be changed after printing and scan analytics are not collected.
                </span>
              </div>
            )}
          </div>

          {/* Step 2: Content Type & Payload */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              2. Content Type &amp; Destination
            </h2>

            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  type="button"
                  onClick={() => handleContentTypeChange(ct.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    contentType === ct.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="qr-name-input" className="block text-xs font-semibold mb-1">
                  QR Code Name *
                </label>
                <input
                  id="qr-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer Patio Menu QR"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
              </div>

              {qrType === 'dynamic' && (
                <div>
                  <label htmlFor="qr-slug-input" className="block text-xs font-semibold mb-1">
                    Custom Short Slug (Optional)
                  </label>
                  <div className="flex items-center">
                    <span className="rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs text-slate-500">
                      /r/
                    </span>
                    <input
                      id="qr-slug-input"
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="auto-generated"
                      className="w-full rounded-r-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Content Fields based on contentType */}
            {['url', 'ai_agent', 'google_review', 'menu', 'landing_page', 'social', 'file'].includes(
              contentType
            ) && (
              <div className="space-y-2.5">
                {contentType === 'ai_agent' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3.5 text-xs">
                    <span className="text-slate-700 dark:text-slate-200">
                      <strong>Tip:</strong> Want to configure an AI Agent&apos;s knowledge base, personality, and branding? Use the dedicated AI Agent QR Studio.
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/ai-agents')}
                      className="shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Open AI Agent QR Wizard →
                    </button>
                  </div>
                )}
                <label htmlFor="qr-dest-url-input" className="block text-xs font-semibold mb-1">
                  Destination URL *
                </label>
                <input
                  id="qr-dest-url-input"
                  type="text"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    contentType === 'ai_agent'
                      ? '/agent/saffron-concierge'
                      : 'https://yourbusiness.com/offer'
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
            )}

            {contentType === 'text' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Plain Text Message *</label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
              </div>
            )}

            {contentType === 'whatsapp' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    WhatsApp Number (with country code)
                  </label>
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="919820012345"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Pre-filled Message</label>
                  <input
                    type="text"
                    value={whatsappMessage}
                    onChange={(e) => setWhatsappMessage(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {contentType === 'wifi' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Network Name (SSID)</label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Bistro_Guest_5G"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Wi-Fi Password</label>
                  <input
                    type="text"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Welcome2026"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Security</label>
                  <select
                    value={wifiEncryption}
                    onChange={(e) =>
                      setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')
                    }
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open (No Password)</option>
                  </select>
                </div>
              </div>
            )}

            {contentType === 'vcard' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={vcardFirstName}
                  onChange={(e) => setVcardFirstName(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={vcardLastName}
                  onChange={(e) => setVcardLastName(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Company / Organization"
                  value={vcardOrg}
                  onChange={(e) => setVcardOrg(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={vcardPhone}
                  onChange={(e) => setVcardPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={vcardEmail}
                  onChange={(e) => setVcardEmail(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="url"
                  placeholder="Website URL"
                  value={vcardWebsite}
                  onChange={(e) => setVcardWebsite(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {contentType === 'email' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Recipient Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Email Subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <textarea
                  rows={2}
                  placeholder="Email Body"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="sm:col-span-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            {(contentType === 'phone' || contentType === 'sms') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="tel"
                  placeholder="+91 98200 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                {contentType === 'sms' && (
                  <input
                    type="text"
                    placeholder="SMS Text Message"
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                )}
              </div>
            )}

            {contentType === 'location' && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Location Address or Coordinates
                </label>
                <input
                  type="text"
                  placeholder="Bandra West, Mumbai or 19.0596,72.8295"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {/* Step 3: Visual Design Customization */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              3. Design, Patterns, Logo &amp; Frame
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Foreground</label>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-10 w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Background</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Corner Eye Color</label>
                <input
                  type="color"
                  value={eyeColor}
                  onChange={(e) => setEyeColor(e.target.value)}
                  className="h-10 w-full rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Quiet Zone Margin</label>
                <select
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                >
                  <option value={4}>Standard (4 modules)</option>
                  <option value={6}>Wide (6 modules)</option>
                  <option value={2}>Compact (2 modules)</option>
                  <option value={1}>Minimal (1 module - Warning)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Module Pattern</label>
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value as QRPatternType)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="rounded">Rounded Modules</option>
                  <option value="dots">Circular Dots</option>
                  <option value="square">Classic Crisp Square</option>
                  <option value="classy">Classy Alternating</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Corner Eye Shape</label>
                <select
                  value={eyeStyle}
                  onChange={(e) => setEyeStyle(e.target.value as QREyeStyle)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="rounded">Rounded Frame</option>
                  <option value="circle">Circular Bullseye</option>
                  <option value="square">Sharp Square</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Call-to-Action Frame</label>
                <select
                  value={frameStyle}
                  onChange={(e) => setFrameStyle(e.target.value as QRFrameStyle)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="banner_bottom">Bottom CTA Banner</option>
                  <option value="banner_top">Top Header Banner</option>
                  <option value="none">No Frame</option>
                </select>
              </div>
            </div>

            {frameStyle !== 'none' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Frame Call-to-Action Text</label>
                <input
                  type="text"
                  value={frameText}
                  onChange={(e) => setFrameText(e.target.value)}
                  maxLength={28}
                  placeholder="SCAN FOR MENU"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Center Logo Upload (Optional)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
              </div>
              {logoDataUrl && (
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Logo Size ({Math.round(logoSizeRatio * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.14}
                    max={0.28}
                    step={0.02}
                    value={logoSizeRatio}
                    onChange={(e) => setLogoSizeRatio(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Organization, Folders, Campaigns & Advanced Rules */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              4. Organization, Campaign &amp; Safeguards
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Folder</label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="">No Folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Campaign</label>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="">No Campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="standee, menu, lobby"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
            </div>

            {qrType === 'dynamic' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Optional Expiration Date
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Expired Fallback URL
                  </label>
                  <input
                    type="url"
                    value={fallbackUrl}
                    onChange={(e) => setFallbackUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Optional Access Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank for public"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              data-testid="save-qr-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {saving ? 'Saving QR Code...' : `Save & Publish ${qrType === 'dynamic' ? 'Dynamic' : 'Static'} QR Code`}
            </button>
          </div>
        </form>

        {/* Sticky Live Preview & Print Exporter */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Live Scannable Preview
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Real Matrix
              </span>
            </div>

            <QRPreviewCard
              content={previewEncodedString}
              name={name || 'rmqr-studio'}
              size={240}
              styleConfig={{
                fgColor,
                bgColor,
                eyeColor,
                pattern,
                eyeStyle,
                frameStyle,
                frameText,
                frameColor: eyeColor,
                margin,
                logoDataUrl,
                logoSizeRatio,
                errorCorrectionLevel: logoDataUrl ? 'H' : 'M',
              }}
            />

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3 text-xs space-y-1 border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-slate-500">Encoded Payload Preview:</div>
              <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all">
                {previewEncodedString}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
