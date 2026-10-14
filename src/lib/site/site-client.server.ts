// Read-only client for the Dukamp website Supabase (secondary project).
// Uses a public anon/publishable key. Never write with this client.
//
// The fallback below is intentionally limited to the public anon role. Supabase
// anon keys are client-facing credentials; security remains enforced by RLS.
// Server environment variables still take priority and can replace the fallback.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PUBLIC_DUKAMP_SITE_URL = "https://pioyrbcdprnplhcoyzam.supabase.co";
const PUBLIC_DUKAMP_SITE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpb3lyYmNkcHJucGxoY295emFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTk2NDYsImV4cCI6MjEwMDA5NTY0Nn0.wIPY4KZUEnP1ziR2lGQBF0sIj-b2p_SIZjTMEZe4WWk";

let _client: SupabaseClient | undefined;

export type SiteConfigurationStatus = "ok" | "not_configured" | "invalid_url";
export type SiteConfigurationSource =
  "server_env" | "vite_env_alias" | "public_fallback" | "missing";

export interface ResolvedSiteConfiguration {
  url: string | undefined;
  key: string | undefined;
  source: SiteConfigurationSource;
}

/**
 * Netlify may expose public Supabase credentials under server names or
 * Vite aliases. Supporting both prevents a valid deployment configuration from
 * being treated as missing. The public fallback keeps the read-only commercial
 * directory available on deployments that do not inherit the secondary env.
 */
export function resolveSiteConfiguration(): ResolvedSiteConfiguration {
  const serverUrl = process.env.DUKAMP_SITE_SUPABASE_URL?.trim();
  const serverKey =
    process.env.DUKAMP_SITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (serverUrl && serverKey) {
    return { url: serverUrl, key: serverKey, source: "server_env" };
  }

  const viteUrl = process.env.VITE_DUKAMP_SITE_SUPABASE_URL?.trim();
  const viteKey =
    process.env.VITE_DUKAMP_SITE_SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (viteUrl && viteKey) {
    return { url: viteUrl, key: viteKey, source: "vite_env_alias" };
  }

  if (PUBLIC_DUKAMP_SITE_URL && PUBLIC_DUKAMP_SITE_ANON_KEY) {
    return {
      url: PUBLIC_DUKAMP_SITE_URL,
      key: PUBLIC_DUKAMP_SITE_ANON_KEY,
      source: "public_fallback",
    };
  }

  return { url: serverUrl || viteUrl, key: serverKey || viteKey, source: "missing" };
}

export function siteConfigurationStatus(): SiteConfigurationStatus {
  const { url, key } = resolveSiteConfiguration();
  if (!url || !key) return "not_configured";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
      return "invalid_url";
    }
  } catch {
    return "invalid_url";
  }
  return "ok";
}

function build(): SupabaseClient {
  const { url, key } = resolveSiteConfiguration();
  const status = siteConfigurationStatus();
  if (!url || !key || status !== "ok") {
    throw new Error("Integração comercial DuKamp não configurada no runtime do servidor.");
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
