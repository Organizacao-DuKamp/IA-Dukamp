import { isSiteConfigured } from "./site-client.server.ts";
import {
  querySiteCategories,
  querySiteProducts,
  querySiteSellers,
  querySiteSettings,
  type SiteLookupDependencies,
  type SiteQueryResult,
} from "./site-lookup.server.ts";

interface SafeCheck {
  status: "ok" | "error";
  code: string;
  count: number;
}
export interface DukampSiteHealth {
  configured: boolean;
  products_query: SafeCheck;
  sellers_query: SafeCheck;
  categories_query: SafeCheck;
  site_settings_query: SafeCheck;
}

function safe(result: SiteQueryResult<unknown[]>): SafeCheck {
  return {
    status: result.status === "ok" || result.status === "empty_result" ? "ok" : "error",
    code: result.errorCode ?? result.status,
    count: result.count,
  };
}

/** Somente para uso server-side por desenvolvimento ou telas administrativas autenticadas. */
export async function checkDukampSiteHealth(
  deps: SiteLookupDependencies = {},
): Promise<DukampSiteHealth> {
  const configured = deps.configured ?? isSiteConfigured();
  if (!configured) {
    const missing = { status: "error", code: "not_configured", count: 0 } as const;
    return {
      configured: false,
      products_query: missing,
      sellers_query: missing,
      categories_query: missing,
      site_settings_query: missing,
    };
  }
  const [products, sellers, categories, settings] = await Promise.all([
    querySiteProducts("", 1, deps, true),
    querySiteSellers("", 1, deps),
    querySiteCategories(deps),
    querySiteSettings(deps),
  ]);
  return {
    configured: true,
    products_query: safe(products),
    sellers_query: safe(sellers),
    categories_query: safe(categories),
    site_settings_query: safe(settings),
  };
}
