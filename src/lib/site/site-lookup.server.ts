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
const SELLER_RE = /\b(vendedor|vendedora|vendedores|representante|revenda|revendedor|distribuidor|contato|whats(app)?|telefone|falar\s+com|onde\s+comprar|quero\s+comprar|gostaria\s+de\s+comprar|posso\s+comprar|como\s+compro|onde\s+compro|adquirir|fazer\s+(um\s+)?pedido|pedir)\b/i;
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
  const norm = " " + normalizeName(text) + " ";
  // aliases → região oficial no cadastro
  const aliases: Record<string, string[]> = {
    "sao jose do rio preto": ["rio preto", "sjrp", "s j rio preto", "s. j. do rio preto"],
    "monte aprazivel": ["monte apraz", "mte aprazivel"],
    "macaubal": ["macaubal"],
    "itaruma": ["itaruma"],
  };
  const filtered = all.filter((s) => {
    if (!s.region) return false;
    const regNorm = normalizeName(s.region);
    if (norm.includes(" " + regNorm + " ") || norm.includes(regNorm)) return true;
    const alist = aliases[regNorm] ?? [];
    return alist.some((a) => norm.includes(a));
  });
  return filtered;
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

export interface SiteUnit {
  label: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
  razaoSocial?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function pickAfter(text: string, label: RegExp): string | undefined {
  const m = text.match(label);
  if (!m) return undefined;
  const rest = text.slice(m.index! + m[0].length);
  // Stop at next known label OR the next numbered section heading like "2. Objeto".
  const stopRe = /(Raz[aã]o social\s*:|Nome fantasia\s*:|CNPJ\s*:|Endere[cç]o\s*:|E-?mail[^:\n]{0,40}:|Telefone[^:\n]{0,40}:|WhatsApp[^:\n]{0,40}:|\s\d{1,2}\.\s+[A-ZÀ-Ú])/;
  const stop = rest.search(stopRe);
  const val = (stop >= 0 ? rest.slice(0, stop) : rest).trim();
  // Strip a trailing dangling "Telefone ou" / "E-mail" fragment if present.
  const cleaned = val
    .replace(/^[:\-\s]+/, "")
    .replace(/\s+(Telefone|E-?mail|WhatsApp|CNPJ|Endere[cç]o|Raz[aã]o social|Nome fantasia)(\s+(ou|de)\s+\w+)?\s*$/i, "")
    .trim();
  return cleaned || undefined;
}

/**
 * Extract Dukamp company unit info from site_settings footer pages
 * (that's where the legal address + contact live). Also returns distinct
 * seller regions to indicate commercial coverage.
 */
export async function getSiteUnits(): Promise<{ headquarters?: SiteUnit; regions: string[] }> {
  if (!isSiteConfigured()) return { regions: [] };
  const [{ data: settings }, sellers] = await Promise.all([
    siteSupabase()
      .from("site_settings")
      .select("key,value")
      .in("key", ["footer_page:termos-e-condicoes", "footer_page:como-comprar", "footer_page:politica-de-entrega"]),
    listSiteSellers(200),
  ]);

  let headquarters: SiteUnit | undefined;
  for (const row of (settings ?? []) as Array<{ key: string; value: any }>) {
    const html: string = row?.value?.html ?? "";
    if (!html) continue;
    const text = stripHtml(html);
    const address = pickAfter(text, /Endere[cç]o\s*:/i);
    if (!address) continue;
    headquarters = {
      label: "Matriz",
      razaoSocial: pickAfter(text, /Raz[aã]o social\s*:/i),
      cnpj: pickAfter(text, /CNPJ\s*:/i),
      address,
      email: (text.match(/E-?mail(?:\s+de\s+atendimento)?\s*:\s*([^\s<>()]+@[^\s<>()]+)/i)?.[1] ?? "").trim() || undefined,
      phone: (text.match(/Telefone(?:\s+ou\s+WhatsApp)?\s*:\s*([()\d\s\-+.]{8,25})/i)?.[1] ?? "").trim() || undefined,
    };
    const cityMatch = address.match(/,\s*([^,/]+)\/([A-Z]{2})\b/);
    if (cityMatch) {
      headquarters.city = cityMatch[1].trim();
      headquarters.state = cityMatch[2].trim();
    }
    break;
  }

  const regions = Array.from(
    new Set(sellers.map((s) => (s.region ?? "").trim()).filter((r) => r.length > 0)),
  ).sort();

  return { headquarters, regions };
}
