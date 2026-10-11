// =============================================================================
// RMQR — Supabase Browser & Server Client Helpers
// Connects to Supabase PostgreSQL & Auth when NEXT_PUBLIC_SUPABASE_URL is set.
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';

export function isSupabaseConfigured(): boolean {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return Boolean(url && key && url.startsWith('http'));
}

export function getSupabaseBrowserClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
  ) {
    return null;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
