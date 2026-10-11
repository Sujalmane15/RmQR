import React from 'react';
import Link from 'next/link';
import { readDb } from '@/lib/db/store';
import { PublicMenuInteractive } from '@/components/PublicMenuInteractive';

// Prevent stale caching so menu price & availability changes appear immediately
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = readDb();

  const menu = db.menus.find((m) => m.slug.toLowerCase() === slug.toLowerCase());

  if (!menu || menu.status !== 'published') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4">
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400">
            Menu Offline
          </span>
          <h1 className="text-2xl font-extrabold">Digital Menu Not Published</h1>
          <p className="text-sm text-slate-400">
            This restaurant menu is currently in draft mode or does not exist.
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

  const categories = db.menuCategories
    .filter((c) => c.menuId === menu.id && c.isAvailable)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const items = db.menuItems
    .filter((i) => i.menuId === menu.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return <PublicMenuInteractive menu={menu} categories={categories} items={items} />;
}
