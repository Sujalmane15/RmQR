'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from './BrandLogo';
import { ThemeToggleButton } from './ThemeProvider';
import {
  BarChart3,
  Building2,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldAlert,
  Smartphone,
  Star,
  Utensils,
  X,
} from 'lucide-react';

interface SessionState {
  user: {
    id: string;
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
    onboardingCompleted: boolean;
  };
  activeOrg: {
    id: string;
    name: string;
    slug: string;
    industry: string;
  };
  role: string;
  organizations: Array<{
    organization: { id: string; name: string; slug: string };
    role: string;
  }>;
  subscription: {
    planId: string;
  };
}

const SIDEBAR_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/qr-codes', label: 'QR Codes', icon: QrCode },
  { href: '/dashboard/qr-codes/new', label: 'QR Code Studio', icon: Plus },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/landing-pages', label: 'Landing Pages', icon: Smartphone },
  { href: '/dashboard/menus', label: 'Restaurant Menus', icon: Utensils },
  { href: '/dashboard/reviews', label: 'Google Reviews', icon: Star },
  { href: '/dashboard/campaigns', label: 'Campaigns & Bulk', icon: FolderKanban },
  { href: '/dashboard/billing', label: 'Billing & Plans', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings & API', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (active && data?.authenticated) {
          setSession(data);
        }
      })
      .catch(() => {
        if (active) router.replace('/login');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const handleSwitchOrg = async (organizationId: string) => {
    if (organizationId === '__new__') {
      setShowNewOrgModal(true);
      return;
    }
    const res = await fetch('/api/auth/switch-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });
    if (res.ok) {
      window.location.reload();
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const res = await fetch('/api/auth/switch-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_org', name: newOrgName }),
    });
    if (res.ok) {
      setShowNewOrgModal(false);
      setNewOrgName('');
      window.location.reload();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/qr-codes?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size="lg" />
          <p className="text-xs font-medium text-slate-500 animate-pulse">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F19]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1322] z-30">
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <Link href="/dashboard">
            <BrandLogo size="md" />
          </Link>
          <span className="rounded-full bg-violet-600/15 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            {session.subscription.planId}
          </span>
        </div>

        {/* Workspace Selector */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800">
          <label
            htmlFor="workspace-select"
            className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"
          >
            Active Workspace ({session.role})
          </label>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-violet-500 shrink-0" />
            <select
              id="workspace-select"
              value={session.activeOrg.id}
              onChange={(e) => handleSwitchOrg(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
            >
              {session.organizations.map((item) => (
                <option key={item.organization.id} value={item.organization.id}>
                  {item.organization.name} ({item.role})
                </option>
              ))}
              <option value="__new__">+ Create New Workspace...</option>
            </select>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Dashboard Sidebar">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href ||
                  (item.href !== '/dashboard/qr-codes' && pathname.startsWith(item.href)) ||
                  (item.href === '/dashboard/qr-codes' &&
                    pathname.startsWith('/dashboard/qr-codes') &&
                    pathname !== '/dashboard/qr-codes/new');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {session.user.isSuperAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors mt-4 border border-amber-500/30 ${
                pathname.startsWith('/admin')
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Admin Console</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {session.user.fullName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{session.user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              data-testid="logout-btn"
              title="Sign Out"
              aria-label="Sign Out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Toggle dashboard sidebar"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form onSubmit={handleSearchSubmit} className="relative max-w-md w-full hidden sm:block">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search QR codes by name, slug, or tag..."
                aria-label="Search QR codes"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pl-9 pr-4 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/qr-codes/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-violet-600/25 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create QR</span>
            </Link>
            <ThemeToggleButton />
            <button
              type="button"
              onClick={handleLogout}
              className="lg:hidden inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-white dark:bg-[#0E1322] h-full flex flex-col p-4 z-10">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <BrandLogo size="md" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile sidebar"
                  className="p-2 rounded-lg text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {session.user.isSuperAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-amber-500"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Admin Console</span>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}

        {/* New Workspace Modal */}
        {showNewOrgModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create New Organization Workspace
              </h2>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Workspace Name</label>
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Downtown Branch or Client Brand"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewOrgModal(false)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
