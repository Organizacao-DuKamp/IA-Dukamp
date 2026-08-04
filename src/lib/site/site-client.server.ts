// Read-only client for the Dukamp website Supabase (secondary project).
// Uses only the public anon key and must never write with this client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;

export type SiteConfigurationStatus = "ok" | "not_configured" | "invalid_url";
export type SiteConfigurationSource = "environment" | "public_fallback";

// The DuKamp storefront already exposes this anon key to browsers. Keeping this
// server-only fallback makes the TPEC-IA work on Netlify/Lovable even when the
// secondary-project variables were not copied to that deployment. RLS remains
// the actual security boundary; this is never a service-role credential.
const PUBLIC_DUKAMP_SITE_URL = "https://pioyrbcdprnplhcoyzam.supabase.co";
const PUBLIC_DUKAMP_SITE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpb3lyYmNkcHJucGxoY295emFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTk2NDYsImV4cCI6MjEwMDA5NTY0Nn0.wIPY4KZUEnP1ziR2lGQBF0sIj-b2p_SIZjTMEZe4WWk";

export interface ResolvedSiteConfiguration {
  url: string;
  key: string;
  source: SiteConfigurationSource;
}

export function resolveSiteConfiguration(): ResolvedSiteConfiguration {
  const envUrl = process.env.DUKAMP_SITE_SUPABASE_URL?.trim();
  const envKey = process.env.DUKAMP_SITE_SUPABASE_ANON_KEY?.trim();
  if (envUrl && envKey) return { url: envUrl, key: envKey, source: "environment" };
  return {
    url: PUBLIC_DUKAMP_SITE_URL,
    key: PUBLIC_DUKAMP_SITE_ANON_KEY,
    source: "public_fallback",
  };
}

export function siteConfigurationStatus(): SiteConfigurationStatus {
  const { url, key } = resolveSiteConfiguration();
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
  const { url, key } = resolveSiteConfiguration();
  const status = siteConfigurationStatus();
  if (!url || !key || status !== "ok") {
    throw new Error("Integração comercial DuKamp indisponível.");
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
  const source = resolveSiteConfiguration().source;
  console.info("[dukamp-site] configuration", {
    operation: "configuration",
    status: status === "ok" ? "ok" : "error",
    error_code: status === "ok" ? null : status,
    configuration_source: source,
    duration_ms: 0,
    result_count: 0,
  });
  return status === "ok";
}
