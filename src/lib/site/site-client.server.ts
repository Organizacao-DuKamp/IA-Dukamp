// Read-only client for the Dukamp website Supabase (secondary project).
// Uses a public anon/publishable key. Never write with this client.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | undefined;

export type SiteConfigurationStatus = "ok" | "not_configured" | "invalid_url";
export type SiteConfigurationSource = "server_env" | "vite_env_alias" | "missing";

export interface ResolvedSiteConfiguration {
  url: string | undefined;
  key: string | undefined;
  source: SiteConfigurationSource;
}

/**
 * Netlify/Lovable may expose public Supabase credentials under server names or
 * Vite aliases. Supporting both prevents a valid deployment configuration from
 * being treated as missing, while keeping all lookups server-side.
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
