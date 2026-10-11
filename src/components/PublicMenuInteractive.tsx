'use client';

import React, { useMemo, useState } from 'react';
import { MenuCategory, MenuItem, RestaurantMenu } from '@/lib/types';
import { Flame, Search, Sparkles, Utensils } from 'lucide-react';

interface PublicMenuInteractiveProps {
  menu: RestaurantMenu;
  categories: MenuCategory[];
  items: MenuItem[];
}

export function PublicMenuInteractive({
  menu,
  categories,
  items,
}: PublicMenuInteractiveProps) {
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [vegOnly, setVegOnly] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (vegOnly && !item.isVeg) return false;
      if (activeCategoryId !== 'all' && item.categoryId !== activeCategoryId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.dietaryTags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, vegOnly, activeCategoryId, search]);

  const todaysSpecials = useMemo(
    () => items.filter((i) => i.isTodaysSpecial && i.isAvailable && (!vegOnly || i.isVeg)),
    [items, vegOnly]
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white pb-16">
      {/* Restaurant Hero Banner */}
      <header className="border-b border-slate-800 bg-gradient-to-b from-violet-950/50 to-[#0B0F19] px-4 pt-10 pb-6">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30 mx-auto">
            <Utensils className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="public-menu-title">
            {menu.restaurantName}
          </h1>
          {menu.description && (
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
              {menu.description}
            </p>
          )}
        </div>

        {/* Search & Veg Filter Bar */}
        <div className="mx-auto max-w-2xl mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients, or dietary tags..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setVegOnly(!vegOnly)}
            data-testid="veg-only-filter-btn"
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-bold transition-colors ${
              vegOnly
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}
          >
            <span className="h-3 w-3 rounded-sm bg-emerald-500 inline-block" />
            Pure Veg Only
          </button>
        </div>

        {/* Category Pills */}
        <div className="mx-auto max-w-2xl mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategoryId('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap ${
              activeCategoryId === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap ${
                activeCategoryId === cat.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-6 space-y-8">
        {/* Featured / Today's Specials Section */}
        {activeCategoryId === 'all' && !search && todaysSpecials.length > 0 && (
          <section className="space-y-3" aria-label="Today's Specials">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
              <Sparkles className="h-4 w-4" /> Today&apos;s Chef Specials &amp; Featured
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {todaysSpecials.map((sp) => (
                <div
                  key={`special-${sp.id}`}
                  className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-4 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white">{sp.name}</span>
                      <span className="font-extrabold text-sm text-amber-400">
                        {menu.currencySymbol}
                        {sp.price}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{sp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories & Dish Cards */}
        {categories
          .filter((c) => activeCategoryId === 'all' || c.id === activeCategoryId)
          .map((cat) => {
            const catItems = filteredItems.filter((i) => i.categoryId === cat.id);
            if (catItems.length === 0) return null;

            return (
              <section key={cat.id} className="space-y-3">
                <div className="border-b border-slate-800 pb-2">
                  <h2 className="text-lg font-extrabold text-white">{cat.name}</h2>
                  {cat.description && (
                    <p className="text-xs text-slate-400">{cat.description}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`public-menu-item-${item.id}`}
                      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex items-start justify-between gap-4 ${
                        !item.isAvailable ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-block h-3 w-3 rounded-sm ${
                              item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                          />
                          <h3 className="font-bold text-sm sm:text-base text-white">
                            {item.name}
                          </h3>
                          {item.isBestseller && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                              <Flame className="h-3 w-3" /> Best Seller
                            </span>
                          )}
                          {item.isRecommended && (
                            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                              Chef Recommended
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        {item.dietaryTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {item.dietaryTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className="text-base font-extrabold text-white"
                          data-testid={`public-item-price-${item.id}`}
                        >
                          {menu.currencySymbol}
                          {item.price}
                        </div>
                        {!item.isAvailable && (
                          <span className="text-[10px] font-bold uppercase text-red-400">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
      </main>
    </div>
  );
}
