import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function BrandLogo({ size = 'md', showTagline = false }: BrandLogoProps) {
  const dimensions = size === 'sm' ? 28 : size === 'lg' ? 40 : 34;
  const textSize =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 p-1.5 shadow-md shadow-violet-600/25"
        style={{ width: dimensions, height: dimensions }}
      >
        {/* Original Geometric QR-Inspired Vector Emblem */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-full h-full text-white"
          aria-hidden="true"
        >
          <rect x="2.5" y="2.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2.2" />
          <rect x="5" y="5" width="2" height="2" rx="0.5" fill="currentColor" />
          <rect x="14.5" y="2.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2.2" />
          <rect x="17" y="5" width="2" height="2" rx="0.5" fill="currentColor" />
          <rect x="2.5" y="14.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="2.2" />
          <rect x="5" y="17" width="2" height="2" rx="0.5" fill="currentColor" />
          <circle cx="15.5" cy="15.5" r="1.6" fill="currentColor" />
          <path
            d="M19.5 14.5V19.5H14.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11.8" cy="11.8" r="1.4" fill="#A5F3FC" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-extrabold tracking-tight ${textSize} text-slate-900 dark:text-white`}>
          RM<span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">QR</span>
        </span>
        {showTagline && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-0.5">
            Smart QR Cloud
          </span>
        )}
      </div>
    </div>
  );
}
