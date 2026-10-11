'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MenuCategory, MenuItem, RestaurantMenu } from '@/lib/types';
import { ExtractedMenuCandidate } from '@/lib/ai/services';
import {
  CheckCircle2,
  ExternalLink,
  FileScan,
  Flame,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Utensils,
} from 'lucide-react';

interface MenuWithDetails extends RestaurantMenu {
  categories: MenuCategory[];
  items: MenuItem[];
}

export default function RestaurantMenusManagerPage() {
  const [menus, setMenus] = useState<MenuWithDetails[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuWithDetails | null>(null);

  // Create New Menu Modal State
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newRestName, setNewRestName] = useState('');
  const [newRestSlug, setNewRestSlug] = useState('');
  const [newRestDesc, setNewRestDesc] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('₹');

  // Category & Item Creation State
  const [newCatName, setNewCatName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('295');
  const [newItemCatId, setNewItemCatId] = useState('');
  const [newItemVeg, setNewItemVeg] = useState(true);
  const [newItemBestseller, setNewItemBestseller] = useState(false);
  const [newItemHighMargin, setNewItemHighMargin] = useState(false);
  const [newItemSpecial, setNewItemSpecial] = useState(false);

  // Inline Price Editing Map
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // AI / OCR Menu Import State
  const [showAiImport, setShowAiImport] = useState(false);
  const [ocrText, setOcrText] = useState(
    `STARTERS\nCrispy Corn Pepper Salt - Wok-tossed sweet corn with crushed black pepper - ₹285\nTandoori Chicken Wings - Smoky chargrilled wings with mint chutney - ₹395\n\nSIGNATURE MAINS\nPaneer Butter Masala - Rich tomato and cashew gravy - ₹425`
  );
  const [ocrFileName, setOcrFileName] = useState('');
  const [extractedCandidates, setExtractedCandidates] = useState<ExtractedMenuCandidate[]>([]);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);

  const loadMenus = async (preserveMenuId?: string) => {
    const res = await fetch('/api/menus');
    if (res.ok) {
      const data = await res.json();
      const list: MenuWithDetails[] = data.menus || [];
      setMenus(list);
      const target =
        list.find((m) => m.id === (preserveMenuId || selectedMenu?.id)) || list[0] || null;
      setSelectedMenu(target);
      if (target && target.categories.length > 0 && !newItemCatId) {
        setNewItemCatId(target.categories[0].id);
      }
      const priceMap: Record<string, string> = {};
      if (target) {
        for (const item of target.items) {
          priceMap[item.id] = String(item.price);
        }
      }
      setEditingPrices(priceMap);
    }
  };

  useEffect(() => {
    loadMenus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRestName.trim()) return;
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: newRestName,
        slug: newRestSlug || undefined,
        description: newRestDesc,
        currencySymbol: newCurrencySymbol,
        status: 'published',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewRestName('');
      setNewRestSlug('');
      setNewRestDesc('');
      setShowCreateMenu(false);
      await loadMenus(data.menu?.id);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !newCatName.trim()) return;
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_category',
        menuId: selectedMenu.id,
        name: newCatName,
      }),
    });
    if (res.ok) {
      setNewCatName('');
      await loadMenus(selectedMenu.id);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !newItemName.trim()) return;
    const catId = newItemCatId || selectedMenu.categories[0]?.id;
    if (!catId) return;

    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_item',
        menuId: selectedMenu.id,
        categoryId: catId,
        name: newItemName,
        description: newItemDesc,
        price: Number(newItemPrice) || 0,
        isVeg: newItemVeg,
        isBestseller: newItemBestseller,
        isHighMargin: newItemHighMargin,
        isTodaysSpecial: newItemSpecial,
      }),
    });
    if (res.ok) {
      setNewItemName('');
      setNewItemDesc('');
      setSavedNotice('Dish added and published to live QR menu!');
      await loadMenus(selectedMenu.id);
    }
  };

  const handleUpdateItemPrice = async (item: MenuItem) => {
    const nextPrice = Number(editingPrices[item.id]);
    if (Number.isNaN(nextPrice) || nextPrice < 0) return;

    const res = await fetch('/api/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_item',
        itemId: item.id,
        price: nextPrice,
      }),
    });
    if (res.ok) {
      setSavedNotice(`Updated price for "${item.name}" to ${selectedMenu?.currencySymbol}${nextPrice} — live immediately!`);
      await loadMenus(selectedMenu?.id);
    }
  };

  const handleToggleItemFlag = async (
    item: MenuItem,
    field: 'isAvailable' | 'isTodaysSpecial' | 'isBestseller' | 'isHighMargin'
  ) => {
    await fetch('/api/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_item',
        itemId: item.id,
        [field]: !item[field],
      }),
    });
    await loadMenus(selectedMenu?.id);
  };

  const handleDeleteItem = async (itemId: string) => {
    await fetch(`/api/menus?itemId=${itemId}`, { method: 'DELETE' });
    await loadMenus(selectedMenu?.id);
  };

  const handleToggleMenuStatus = async () => {
    if (!selectedMenu) return;
    const nextStatus = selectedMenu.status === 'published' ? 'draft' : 'published';
    await fetch('/api/menus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menuId: selectedMenu.id,
        status: nextStatus,
      }),
    });
    setSavedNotice(`Menu status set to ${nextStatus.toUpperCase()}.`);
    await loadMenus(selectedMenu.id);
  };

  // AI / OCR Extraction & Human Review Handlers
  const handleRunExtraction = async () => {
    setExtracting(true);
    try {
      const res = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_ai_candidates',
          rawMenuText: ocrText,
          fileName: ocrFileName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExtractedCandidates(data.candidates || []);
        setOcrWarnings(data.warnings || []);
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleApproveImport = async () => {
    if (!selectedMenu || extractedCandidates.length === 0) return;
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import_approved_items',
        menuId: selectedMenu.id,
        items: extractedCandidates,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setExtractedCandidates([]);
      setShowAiImport(false);
      setSavedNotice(`Approved and imported ${data.importedCount} items into ${selectedMenu.restaurantName}!`);
      await loadMenus(selectedMenu.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Digital Restaurant Menus &amp; AI Import
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time menu management with Veg/Non-Veg labels, Today&apos;s Specials, High-Margin badges, and AI OCR import
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAiImport(!showAiImport)}
            data-testid="toggle-ai-menu-import-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400"
          >
            <FileScan className="h-4 w-4" />
            AI / OCR Menu Import
          </button>
          <button
            type="button"
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            data-testid="new-menu-btn"
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/25"
          >
            <Plus className="h-4 w-4" />
            New Restaurant Menu
          </button>
        </div>
      </div>

      {savedNotice && (
        <div
          role="status"
          data-testid="menu-saved-notice"
          className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-600 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Create Restaurant Menu Modal */}
      {showCreateMenu && (
        <form
          onSubmit={handleCreateMenu}
          className="rounded-3xl border border-violet-500/40 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-base font-bold">Create New Digital Restaurant Menu</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Restaurant Name (e.g., Spice Harbor)"
              value={newRestName}
              onChange={(e) => setNewRestName(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="text"
              placeholder="Custom Slug (optional)"
              value={newRestSlug}
              onChange={(e) => setNewRestSlug(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <select
              value={newCurrencySymbol}
              onChange={(e) => setNewCurrencySymbol(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            >
              <option value="₹">INR (₹)</option>
              <option value="$">USD ($)</option>
              <option value="€">EUR (€)</option>
              <option value="£">GBP (£)</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Tagline or cuisine description"
            value={newRestDesc}
            onChange={(e) => setNewRestDesc(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateMenu(false)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white"
            >
              Create Menu &amp; QR
            </button>
          </div>
        </form>
      )}

      {/* AI / OCR MENU IMPORT WORKFLOW WITH HUMAN REVIEW */}
      {showAiImport && (
        <div className="rounded-3xl border border-emerald-500/40 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-lg">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-500">
              <Sparkles className="h-3.5 w-3.5" /> AI / OCR Menu Extraction Pipeline
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Upload Menu Image/PDF or Paste Menu Text for Human Review
            </h2>
            <p className="text-xs text-slate-500">
              Candidate categories, dish names, and prices are extracted into a review staging table. Nothing is published until you review and approve.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Upload Menu Photo or PDF (Optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setOcrFileName(f.name);
                }}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Or Paste Raw Menu Text / OCR Transcript
              </label>
              <textarea
                rows={4}
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunExtraction}
            disabled={extracting}
            data-testid="run-ai-extract-btn"
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white"
          >
            {extracting ? 'Extracting Candidates...' : '1. Extract Candidate Dishes for Review'}
          </button>

          {ocrWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              {ocrWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          {extractedCandidates.length > 0 && (
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Human Review &amp; Correction Table ({extractedCandidates.length} candidates)
              </h3>
              <div className="space-y-2">
                {extractedCandidates.map((cand, idx) => (
                  <div
                    key={cand.tempId}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 text-xs"
                  >
                    <input
                      type="text"
                      value={cand.categoryName}
                      onChange={(e) => {
                        const copy = [...extractedCandidates];
                        copy[idx].categoryName = e.target.value;
                        setExtractedCandidates(copy);
                      }}
                      className="sm:col-span-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={cand.name}
                      onChange={(e) => {
                        const copy = [...extractedCandidates];
                        copy[idx].name = e.target.value;
                        setExtractedCandidates(copy);
                      }}
                      className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-bold"
                    />
                    <input
                      type="number"
                      value={cand.price}
                      onChange={(e) => {
                        const copy = [...extractedCandidates];
                        copy[idx].price = Number(e.target.value);
                        setExtractedCandidates(copy);
                      }}
                      className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    />
                    <label className="sm:col-span-2 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={cand.isVeg}
                        onChange={(e) => {
                          const copy = [...extractedCandidates];
                          copy[idx].isVeg = e.target.checked;
                          setExtractedCandidates(copy);
                        }}
                      />
                      <span>Veg</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExtractedCandidates(
                          extractedCandidates.filter((c) => c.tempId !== cand.tempId)
                        )
                      }
                      className="sm:col-span-1 text-red-500 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleApproveImport}
                data-testid="approve-ai-import-btn"
                className="rounded-xl bg-violet-600 hover:bg-violet-500 px-6 py-2.5 text-xs font-bold text-white"
              >
                3. Approve &amp; Save Verified Items to Menu
              </button>
            </div>
          )}
        </div>
      )}

      {/* Menu Selector Tabs */}
      {menus.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {menus.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedMenu(m);
                const priceMap: Record<string, string> = {};
                for (const item of m.items) priceMap[item.id] = String(item.price);
                setEditingPrices(priceMap);
              }}
              className={`rounded-xl px-4 py-2 text-xs font-bold ${
                selectedMenu?.id === m.id
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              {m.restaurantName}
            </button>
          ))}
        </div>
      )}

      {/* Selected Menu Workspace */}
      {selectedMenu && (
        <div className="space-y-6">
          {/* Restaurant Header Bar */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {selectedMenu.restaurantName}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                    selectedMenu.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {selectedMenu.status === 'published' ? 'Live Published' : 'Unpublished Draft'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{selectedMenu.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleToggleMenuStatus}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold"
              >
                {selectedMenu.status === 'published' ? 'Switch to Draft' : 'Publish Menu Live'}
              </button>
              <Link
                href={`/m/${selectedMenu.slug}`}
                target="_blank"
                data-testid="open-public-menu-link"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white"
              >
                Preview Public QR Menu (/m/{selectedMenu.slug}){' '}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Add Category & Add Dish Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddCategory}
              className="lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Menu Category
              </h3>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Wood-Fired Pizzas"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-bold text-white"
              >
                + Add Category
              </button>
            </form>

            <form
              onSubmit={handleAddItem}
              className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-3"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Utensils className="h-4 w-4 text-violet-500" /> Add New Dish / Menu Item
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Dish Name *"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  placeholder="Price *"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
                <select
                  value={newItemCatId || selectedMenu.categories[0]?.id || ''}
                  onChange={(e) => setNewItemCatId(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  {selectedMenu.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Description & ingredients"
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemVeg}
                      onChange={(e) => setNewItemVeg(e.target.checked)}
                    />
                    <span className="font-semibold text-emerald-500">Vegetarian</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemBestseller}
                      onChange={(e) => setNewItemBestseller(e.target.checked)}
                    />
                    <span>Best Seller</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemSpecial}
                      onChange={(e) => setNewItemSpecial(e.target.checked)}
                    />
                    <span>Today&apos;s Special</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newItemHighMargin}
                      onChange={(e) => setNewItemHighMargin(e.target.checked)}
                    />
                    <span className="text-violet-400">High-Margin (Internal)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  data-testid="add-menu-item-btn"
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2 text-xs font-bold text-white"
                >
                  + Add Dish to Menu
                </button>
              </div>
            </form>
          </div>

          {/* Categories & Dishes Editor */}
          <div className="space-y-6">
            {selectedMenu.categories.map((cat) => {
              const catItems = selectedMenu.items.filter((i) => i.categoryId === cat.id);
              return (
                <div
                  key={cat.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-slate-500">{catItems.length} dishes</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        data-testid={`menu-item-row-${item.id}`}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-block h-3 w-3 rounded-sm border ${
                                item.isVeg
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-red-500 bg-red-500'
                              }`}
                              title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                            />
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                            {item.isBestseller && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                <Flame className="h-3 w-3" /> Best Seller
                              </span>
                            )}
                            {item.isTodaysSpecial && (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                                Today&apos;s Special
                              </span>
                            )}
                            {item.isHighMargin && (
                              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> High Margin
                              </span>
                            )}
                            {!item.isAvailable && (
                              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-500">
                                Sold Out
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{item.description}</p>
                        </div>

                        {/* Inline Price Update & Badge Toggles */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div className="flex items-center">
                            <span className="rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold">
                              {selectedMenu.currencySymbol}
                            </span>
                            <input
                              type="number"
                              aria-label={`Price for ${item.name}`}
                              data-testid={`price-input-${item.id}`}
                              value={editingPrices[item.id] ?? String(item.price)}
                              onChange={(e) =>
                                setEditingPrices({
                                  ...editingPrices,
                                  [item.id]: e.target.value,
                                })
                              }
                              className="w-20 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateItemPrice(item)}
                              data-testid={`save-price-btn-${item.id}`}
                              className="rounded-r-xl bg-violet-600 hover:bg-violet-500 px-2.5 py-1.5 text-xs font-bold text-white inline-flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" /> Save
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleItemFlag(item, 'isTodaysSpecial')}
                            className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${
                              item.isTodaysSpecial
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500'
                            }`}
                          >
                            Special
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleItemFlag(item, 'isAvailable')}
                            className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${
                              item.isAvailable
                                ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                : 'border-red-500/50 bg-red-500/10 text-red-500'
                            }`}
                          >
                            {item.isAvailable ? 'In Stock' : 'Sold Out'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
