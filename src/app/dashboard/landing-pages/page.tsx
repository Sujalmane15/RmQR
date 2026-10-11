'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { LandingPage, LandingPageBlock, LandingPageType } from '@/lib/types';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  MousePointerClick,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';

interface LandingPageWithBlocks extends LandingPage {
  blocks: LandingPageBlock[];
}

const PAGE_TYPES: Array<{ id: LandingPageType; label: string }> = [
  { id: 'business_profile', label: 'Business Profile' },
  { id: 'link_in_bio', label: 'Link-in-Bio' },
  { id: 'product_service', label: 'Product / Service Showcase' },
  { id: 'contact_card', label: 'Digital Contact Card' },
  { id: 'event', label: 'Event & RSVP Page' },
  { id: 'restaurant_menu', label: 'Restaurant Hub' },
  { id: 'promotion', label: 'Promotion / Offer' },
  { id: 'google_review', label: 'Google Review Invitation' },
];

export default function LandingPagesManagerPage() {
  const [pages, setPages] = useState<LandingPageWithBlocks[]>([]);
  const [selectedPage, setSelectedPage] = useState<LandingPageWithBlocks | null>(null);

  // Create Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPageType, setNewPageType] = useState<LandingPageType>('business_profile');
  const [newDesc, setNewDesc] = useState('');

  // Editor State
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'published'>('published');
  const [primaryColor, setPrimaryColor] = useState('#7C3AED');
  const [bgColor, setBgColor] = useState('#0B0F19');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [address, setAddress] = useState('');
  const [blocks, setBlocks] = useState<LandingPageBlock[]>([]);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockUrl, setNewBlockUrl] = useState('https://example.com');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const loadPages = async () => {
    const res = await fetch('/api/landing-pages');
    if (res.ok) {
      const data = await res.json();
      const list: LandingPageWithBlocks[] = data.landingPages || [];
      setPages(list);
      if (list.length > 0 && !selectedPage) {
        selectPageForEdit(list[0]);
      }
    }
  };

  const selectPageForEdit = (lp: LandingPageWithBlocks) => {
    setSelectedPage(lp);
    setEditTitle(lp.title);
    setEditDesc(lp.description);
    setEditStatus(lp.status);
    setPrimaryColor(lp.themeConfig?.primaryColor || '#7C3AED');
    setBgColor(lp.themeConfig?.bgColor || '#0B0F19');
    setPhone(lp.contactInfo?.phone || '');
    setWhatsapp(lp.contactInfo?.whatsapp || '');
    setAddress(lp.contactInfo?.address || '');
    setBlocks(lp.blocks || []);
    setSavedNotice(null);
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = await fetch('/api/landing-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        slug: newSlug || undefined,
        pageType: newPageType,
        description: newDesc,
        status: 'published',
        blocks: [
          {
            blockType: 'button',
            title: 'Visit Official Website',
            subtitle: 'Learn more about our services',
            url: 'https://example.com',
          },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewTitle('');
      setNewSlug('');
      setNewDesc('');
      setShowCreate(false);
      await loadPages();
      if (data.landingPage) {
        selectPageForEdit(data.landingPage);
      }
    }
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;

    const res = await fetch('/api/landing-pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedPage.id,
        title: editTitle,
        description: editDesc,
        status: editStatus,
        themeConfig: {
          ...selectedPage.themeConfig,
          primaryColor,
          bgColor,
          textColor: '#FFFFFF',
        },
        contactInfo: {
          phone,
          whatsapp,
          address,
        },
        blocks,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setSelectedPage(data.landingPage);
      setSavedNotice('Landing page changes saved and published!');
      loadPages();
    }
  };

  const handleAddBlock = () => {
    if (!newBlockTitle.trim() || !selectedPage) return;
    const nextBlock: LandingPageBlock = {
      id: Math.random().toString(36).slice(2, 10),
      landingPageId: selectedPage.id,
      organizationId: selectedPage.organizationId,
      blockType: 'button',
      title: newBlockTitle.trim(),
      subtitle: '',
      url: newBlockUrl.trim() || 'https://example.com',
      icon: 'link',
      sortOrder: blocks.length + 1,
      clickCount: 0,
      isEnabled: true,
    };
    setBlocks([...blocks, nextBlock]);
    setNewBlockTitle('');
    setNewBlockUrl('https://example.com');
  };

  const handleDeletePage = async (id: string) => {
    await fetch(`/api/landing-pages?id=${id}`, { method: 'DELETE' });
    setSelectedPage(null);
    loadPages();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Branded Mobile Landing Pages
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Create mobile-first micro-pages that open immediately after scanning a QR code
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          data-testid="new-landing-page-btn"
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/25"
        >
          <Plus className="h-4 w-4" />
          New Landing Page
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreatePage}
          className="rounded-3xl border border-violet-500/40 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-lg"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Create New Landing Page + Linked Dynamic QR
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="lp-create-title" className="block text-xs font-semibold mb-1">
                Page Title *
              </label>
              <input
                id="lp-create-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Apex Dental Clinic Hub"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="lp-create-slug" className="block text-xs font-semibold mb-1">
                Custom Slug (Optional)
              </label>
              <input
                id="lp-create-slug"
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="apex-dental"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Template Type</label>
              <select
                value={newPageType}
                onChange={(e) => setNewPageType(e.target.value as LandingPageType)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              >
                {PAGE_TYPES.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="lp-create-desc" className="block text-xs font-semibold mb-1">
              Short Description
            </label>
            <input
              id="lp-create-desc"
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Book appointments, view clinic hours, or message us on WhatsApp."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
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
              data-testid="create-lp-submit-btn"
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white"
            >
              Create &amp; Open Editor
            </button>
          </div>
        </form>
      )}

      {/* List & Editor Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left List */}
        <div className="lg:col-span-4 space-y-3">
          {pages.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPageForEdit(p)}
              className={`cursor-pointer rounded-2xl border p-4 transition-all space-y-2 ${
                selectedPage?.id === p.id
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                  {p.pageType.replace(/_/g, ' ')}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    p.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">{p.title}</h3>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">/p/{p.slug}</span>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {p.viewCount || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MousePointerClick className="h-3 w-3" /> {p.clickCount || 0}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Editor & Live Mobile Preview */}
        {selectedPage && (
          <div className="lg:col-span-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <form
              onSubmit={handleSavePage}
              className="xl:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Page: {selectedPage.title}
                </h2>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/p/${selectedPage.slug}`}
                    target="_blank"
                    data-testid="view-public-lp-link"
                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Open Public URL <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeletePage(selectedPage.id)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {savedNotice && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-lp-title" className="block text-xs font-semibold mb-1">
                    Headline Title
                  </label>
                  <input
                    id="edit-lp-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lp-status" className="block text-xs font-semibold mb-1">
                    Publish State
                  </label>
                  <select
                    id="edit-lp-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'draft' | 'published')}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Unpublished)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-lp-desc" className="block text-xs font-semibold mb-1">
                  Description / Bio
                </label>
                <textarea
                  id="edit-lp-desc"
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Button Accent Color</label>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-full rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Page Background</label>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-9 w-full rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Phone (+91...)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="WhatsApp (9198...)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="City / Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>

              {/* Action Buttons & Links */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Interactive Action Buttons ({blocks.length})
                </div>
                {blocks.map((blk) => (
                  <div
                    key={blk.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-bold">{blk.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{blk.url}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBlocks(blocks.filter((b) => b.id !== blk.id))}
                      className="text-red-500 text-xs font-semibold shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Button Label (e.g., Book Appointment)"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newBlockUrl}
                    onChange={(e) => setNewBlockUrl(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddBlock}
                    className="rounded-xl border border-violet-500/50 px-3 py-2 text-xs font-bold text-violet-500 shrink-0"
                  >
                    + Add Button
                  </button>
                </div>
              </div>

              <button
                type="submit"
                data-testid="save-lp-btn"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3 text-xs font-bold text-white"
              >
                <Save className="h-4 w-4" /> Save &amp; Publish Changes
              </button>
            </form>

            {/* Mobile Phone Frame Preview */}
            <div className="xl:col-span-5 flex flex-col items-center">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Mobile Live Preview
              </div>
              <div
                className="w-full max-w-[300px] rounded-[36px] border-4 border-slate-800 p-5 shadow-2xl min-h-[480px] flex flex-col justify-between"
                style={{ backgroundColor: bgColor, color: '#FFFFFF' }}
              >
                <div className="space-y-4 text-center pt-4">
                  <div
                    className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center font-extrabold text-xl shadow-md"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {editTitle.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold">{editTitle}</h3>
                    <p className="text-xs opacity-80 leading-relaxed">{editDesc}</p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {blocks.map((b) => (
                      <div
                        key={b.id}
                        className="w-full rounded-xl py-2.5 px-4 text-xs font-bold shadow-sm"
                        style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
                      >
                        {b.title}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 text-center text-[10px] opacity-60">
                  Powered by RMQR
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
