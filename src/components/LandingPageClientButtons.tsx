'use client';

import React from 'react';
import { LandingPageBlock } from '@/lib/types';
import { ArrowUpRight } from 'lucide-react';

interface LandingPageClientButtonsProps {
  landingPageId: string;
  blocks: LandingPageBlock[];
  primaryColor: string;
}

export function LandingPageClientButtons({
  landingPageId,
  blocks,
  primaryColor,
}: LandingPageClientButtonsProps) {
  const handleBlockClick = (blockId: string) => {
    fetch('/api/landing-pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_click',
        landingPageId,
        blockId,
      }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-3 pt-4">
      {blocks.map((block) => (
        <a
          key={block.id}
          href={block.url}
          onClick={() => handleBlockClick(block.id)}
          className="flex items-center justify-between w-full rounded-2xl p-4 text-left shadow-lg transition-transform hover:scale-[1.01]"
          style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
        >
          <div>
            <div className="text-sm font-bold">{block.title}</div>
            {block.subtitle && (
              <div className="text-xs opacity-85 mt-0.5">{block.subtitle}</div>
            )}
          </div>
          <ArrowUpRight className="h-5 w-5 shrink-0 opacity-90" />
        </a>
      ))}
    </div>
  );
}
