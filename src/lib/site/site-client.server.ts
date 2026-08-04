// Read-only client for the Dukamp website Supabase (secondary project).
// Uses the anon publishable key. Never write with this client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;

export type SiteConfigurationStatus = "ok" | "not_configured" | "invalid_url";

export function siteConfigurationStatus(): SiteConfigurationStatus {
  const url = process.env.DUKAMP_SITE_SUPABASE_URL;
  const key = process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  if (!url || !key) return "not_configured";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname) return "invalid_url";
  } catch {
    return "invalid_url";
  }
  return "ok";
}

function build(): SupabaseClient {
  const url = process.env.DUKAMP_SITE_SUPABASE_URL;
  const key = process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  const status = siteConfigurationStatus();
  if (!url || !key || status !== "ok") {
    throw new Error("Site Dukamp Supabase env vars ausentes.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export function siteSupabase(): SupabaseClient {
  if (!_client) _client = build();
  return _client;
}

export function isSiteConfigured(): boolean {
  const status = siteConfigurationStatus();
  console.info("[dukamp-site] configuration", {
    operation: "configuration",
    status: status === "ok" ? "ok" : "error",
    error_code: status === "ok" ? null : status,
    duration_ms: 0,
    result_count: 0,
  });
  return status === "ok";
}
