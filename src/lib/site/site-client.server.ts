// Read-only client for the Dukamp website Supabase (secondary project).
// Uses the anon publishable key. Never write with this client.

import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | undefined;

function build() {
  const url = process.env.DUKAMP_SITE_SUPABASE_URL;
  const key = process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Site Dukamp Supabase env vars ausentes.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export function siteSupabase() {
  if (!_client) _client = build();
  return _client;
}

export function isSiteConfigured(): boolean {
  return Boolean(process.env.DUKAMP_SITE_SUPABASE_URL && process.env.DUKAMP_SITE_SUPABASE_ANON_KEY);
}
