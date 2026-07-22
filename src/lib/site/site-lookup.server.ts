// Live lookups against the Dukamp website Supabase.
// Used when a user question maps to commercial data (price, availability,
// sellers/where to buy, catalog listing) that lives on the site, not in the
// technical knowledge base.

import { isSiteConfigured, siteSupabase } from "./site-client.server";
import { normalizeName } from "@/lib/products/normalize";

export interface SiteProduct {
  id: string;
  name: string;
  code: string | null;
  slug: string | null;
  price: number | null;
  active: boolean | null;
  stock: number | null;
}

export interface SiteSeller {
  id: string;
  name: string;
  role: string | null;
  region: string | null;
  phone: string | null;
  whatsapp: string | null;
}

export interface SiteLookup {
  products?: SiteProduct[];
  sellers?: SiteSeller[];
  categories?: string[];
}

const PRICE_RE = /\b(pre[cç]o|valor|quanto\s+custa|custo|cotaç[aã]o|comprar|compra|onde\s+compro?|onde\s+encontro|dispon[ií]vel|estoque)\b/i;
const SELLER_RE = /\b(vendedor|vendedora|vendedores|representante|revenda|revendedor|distribuidor|contato|whats(app)?|telefone|falar\s+com|onde\s+comprar)\b/i;
const CATEGORY_RE = /\b(categorias?|linhas?\s+de\s+produtos?|cat[aá]logos?)\b/i;

export function siteIntentHints(text: string) {
  return {
    price: PRICE_RE.test(text),
    seller: SELLER_RE.test(text),
    category: CATEGORY_RE.test(text),
  };
}

/** Rough token search over product name/code. */
export async function searchSiteProducts(query: string, limit = 8): Promise<SiteProduct[]> {
  if (!isSiteConfigured()) return [];
  const q = normalizeName(query).replace(/[^a-z0-9\s/]/g, " ").trim();
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3).slice(0, 4);
  if (tokens.length === 0) return [];

  // Build OR ilike across name for each token; PostgREST accepts .or()
  const orExpr = tokens.map((t) => `name.ilike.*${t}*`).join(",");
  const { data, error } = await siteSupabase()
    .from("products")
    .select("id,name,code,slug,price,active,stock")
    .or(orExpr)
    .eq("active", true)
    .limit(limit);
  if (error) {
    console.error("[site] product search error:", error.message);
    return [];
  }
  return (data ?? []) as SiteProduct[];
}

export async function listSiteSellers(limit = 30): Promise<SiteSeller[]> {
  if (!isSiteConfigured()) return [];
  const { data, error } = await siteSupabase()
    .from("sellers")
    .select("id,name,role,region,phone,whatsapp")
    .order("name", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[site] sellers error:", error.message);
    return [];
  }
  return (data ?? []) as SiteSeller[];
}

export async function findSellersByRegion(text: string): Promise<SiteSeller[]> {
  const all = await listSiteSellers(100);
  const norm = normalizeName(text);
  const filtered = all.filter((s) => {
    if (!s.region) return false;
    return norm.includes(normalizeName(s.region));
  });
  return filtered.length > 0 ? filtered : [];
}

export async function listSiteCategories(): Promise<string[]> {
  if (!isSiteConfigured()) return [];
  const { data, error } = await siteSupabase()
    .from("categories")
    .select("name,active,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[site] categories error:", error.message);
    return [];
  }
  return (data ?? []).map((c: any) => c.name as string);
}

function fmtPrice(n: number | null): string {
  if (n == null) return "";
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

/** Format a compact block for the LLM (or direct reply). */
export function siteBlock(look: SiteLookup): string {
  const parts: string[] = [];
  if (look.products && look.products.length > 0) {
    const lines = look.products.map((p) => {
      const price = p.price != null ? ` — ${fmtPrice(p.price)}` : "";
      const stock = p.stock != null && p.stock > 0 ? " (em estoque)" : p.stock === 0 ? " (sem estoque no momento)" : "";
      return `- ${p.name}${price}${stock}`;
    });
    parts.push(`DADOS DO SITE DUKAMP — PRODUTOS COMERCIAIS:\n${lines.join("\n")}`);
  }
  if (look.sellers && look.sellers.length > 0) {
    const lines = look.sellers.map((s) => {
      const region = s.region ? ` — ${s.region}` : "";
      const wpp = s.whatsapp ? ` — WhatsApp: ${s.whatsapp}` : s.phone ? ` — Tel: ${s.phone}` : "";
      return `- ${s.name}${region}${wpp}`;
    });
    parts.push(`DADOS DO SITE DUKAMP — VENDEDORES:\n${lines.join("\n")}`);
  }
  if (look.categories && look.categories.length > 0) {
    parts.push(`DADOS DO SITE DUKAMP — CATEGORIAS ATIVAS:\n- ${look.categories.join("\n- ")}`);
  }
  return parts.join("\n\n");
}
