import React from 'react';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { ShieldCheck, QrCode, Utensils, Star, Sparkles } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#080B12] text-slate-600 dark:text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-4 space-y-4">
            <BrandLogo size="md" showTagline />
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-w-sm">
              Connect your physical and digital worlds one scan at a time. Dynamic QR codes,
              branded landing pages, AI digital restaurant menus, and Google Review growth in one modular platform.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Privacy-first telemetry &amp; safe redirect verification
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Platform
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/features" className="hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> Dynamic QR Studio
                </Link>
              </li>
              <li>
                <Link href="/features#menus" className="hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5" /> AI Digital Menus
                </Link>
              </li>
              <li>
                <Link href="/features#reviews" className="hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" /> Google Review Growth
                </Link>
              </li>
              <li>
                <Link href="/features#landing-pages" className="hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Micro Landing Pages
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="hover:text-violet-600 dark:hover:text-violet-400">About RMQR</Link></li>
              <li><Link href="/pricing" className="hover:text-violet-600 dark:hover:text-violet-400">Pricing &amp; Plans</Link></li>
              <li><Link href="/contact" className="hover:text-violet-600 dark:hover:text-violet-400">Contact &amp; Support</Link></li>
              <li><Link href="/login" className="hover:text-violet-600 dark:hover:text-violet-400">Customer Portal</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Legal &amp; Security
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/privacy" className="hover:text-violet-600 dark:hover:text-violet-400">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-violet-600 dark:hover:text-violet-400">Terms of Service</Link></li>
              <li><Link href="/privacy#telemetry" className="hover:text-violet-600 dark:hover:text-violet-400">Scan Data &amp; GDPR</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Get Started
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Create your first custom QR code or restaurant menu in under 60 seconds.
            </p>
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Create Free Account
            </Link>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 dark:border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} RMQR Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-800 dark:hover:text-slate-200">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-800 dark:hover:text-slate-200">Terms</Link>
            <Link href="/contact" className="hover:text-slate-800 dark:hover:text-slate-200">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
