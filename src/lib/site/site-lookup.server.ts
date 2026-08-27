// Resilient read-only lookups against the Dukamp commercial Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSiteConfigured, siteConfigurationStatus, siteSupabase } from "./site-client.server.ts";
import { normalizeName } from "../products/normalize.ts";
import { matchSellerRequest } from "./seller-domain.ts";
import type { IntentClassification } from "../chat/intent.ts";
import { rankDuKampProductsForNeed } from "./dukamp-product-ranking.ts";

export type SiteQueryStatus =
  | "ok"
  | "not_configured"
  | "unauthorized"
  | "schema_error"
  | "timeout"
  | "internal_error"
  | "empty_result";
export interface SiteQueryResult<T> {
  status: SiteQueryStatus;
  data: T;
  errorCode: string | null;
  durationMs: number;
  count: number;
}
export interface SiteProduct {
  id: string;
  name: string;
  code: string | null;
  slug: string | null;
  price: number | null;
  active: boolean | null;
  stock: number | null;
  featured?: boolean | null;
  description?: string | null;
  images?: string[] | null;
  brand?: string | null;
  consumer_price?: number | null;
  consumer_pix_price?: number | null;
  producer_price?: number | null;
  producer_pix_price?: number | null;
  reseller_price?: number | null;
  reseller_pix_price?: number | null;
  installments?: number | null;
  on_sale?: boolean | null;
  sale_consumer_price?: number | null;
  sale_consumer_pix_price?: number | null;
}
export interface SiteSeller {
  id: string;
  name: string;
  role: string | null;
  region: string | null;
  phone: string | null;
  whatsapp: string | null;
  active?: boolean | null;
  display_order?: number | null;
}
export interface SiteLookup {
  products?: SiteProduct[];
  sellers?: SiteSeller[];
  categories?: string[];
}
export interface SiteLookupDependencies {
  client?: Pick<SupabaseClient, "from">;
  configured?: boolean;
}

const PRICE_RE =
  /\b(pre[cç]o|valor|quanto\s+custa|custo|cota[cç][aã]o|comprar|compra|onde\s+compro?|onde\s+encontro|dispon[ií]vel|estoque)\b/i;
const SELLER_RE =
  /\b(vendedor|vendedora|vendedores|representante|revenda|revendedor|distribuidor|consultor|contato|whats(app)?|telefone|falar\s+com|onde\s+comprar|quero\s+comprar|adquirir|fazer\s+(um\s+)?pedido|pedir|quem\s+atende)\b/i;
const CATEGORY_RE = /\b(categorias?|linhas?\s+de\s+produtos?|cat[aá]logos?)\b/i;
const PRODUCT_RE =
  /\b(produtos?|suplementos?|ra[cç][aã]o|mineral|proteinado|dukamp|bezerro|recria|seca)\b/i;
const LIST_RE = /\b(quais|liste|lista|todos|todas|cat[aá]logo|voc[eê]s\s+t[eê]m)\b/i;
const PURPOSE_RE =
  /\b(bezerros?|recria|seca|[áa]guas|engorda|lacta[cç][aã]o|suplemento|ra[cç][aã]o|mineral|proteinado)\b/i;
const PRODUCT_SEARCH_STOPWORDS = new Set([
  "qual",
  "quais",
  "quanto",
  "custa",
  "preco",
  "valor",
  "produto",
  "produtos",
  "dukamp",
  "comprar",
  "compra",
  "estoque",
  "disponivel",
  "onde",
  "como",
  "para",
  "sobre",
  "quero",
  "saber",
  "tem",
  "uma",
  "com",
  "voces",
  "liste",
  "lista",
  "todos",
]);

const PRODUCT_SELECT =
  "id,name,code,slug,price,active,stock,featured,description,images,brand,consumer_price,consumer_pix_price,producer_price,producer_pix_price,reseller_price,reseller_pix_price,installments,on_sale,sale_consumer_price,sale_consumer_pix_price";
const PRODUCT_FALLBACK_SELECT = "id,name,code,slug,price,active,stock,featured";

export function siteIntentHints(text: string) {
  return {
    price: PRICE_RE.test(text),
    seller: SELLER_RE.test(text),
    category: CATEGORY_RE.test(text),
    product: PRODUCT_RE.test(text),
    listProducts: PRODUCT_RE.test(text) && LIST_RE.test(text),
  };
}

function classifyError(error: unknown): { status: SiteQueryStatus; code: string } {
  const e = (error ?? {}) as { code?: string; status?: number; message?: string; name?: string };
  if (e.name === "AbortError" || e.code === "TIMEOUT")
    return { status: "timeout", code: "timeout" };
  if (e.status === 401 || e.code === "PGRST301")
    return { status: "unauthorized", code: "invalid_key" };
  if (e.status === 403 || e.code === "42501")
    return { status: "unauthorized", code: "access_denied" };
  if (
    ["42703", "42P01", "PGRST204", "PGRST205"].includes(e.code ?? "") ||
    /column|relation|schema cache/i.test(e.message ?? "")
  )
    return { status: "schema_error", code: e.code ?? "schema_error" };
  return { status: "internal_error", code: e.code ?? "request_failed" };
}
function logQuery(operation: string, result: SiteQueryResult<unknown>) {
  console.info(`[dukamp-site] ${operation}`, {
    operation,
    status: result.status,
    error_code: result.errorCode,
    duration_ms: result.durationMs,
    result_count: result.count,
  });
}
function unavailable<T>(operation: string, data: T): SiteQueryResult<T> {
  const config = siteConfigurationStatus();
  const result: SiteQueryResult<T> = {
    status: "not_configured",
    data,
    errorCode: config,
    durationMs: 0,
    count: 0,
  };
  logQuery(operation, result);
  return result;
}
function finish<T>(
  operation: string,
  started: number,
  data: T[],
  error?: unknown,
): SiteQueryResult<T[]> {
  const classified = error ? classifyError(error) : null;
  const result: SiteQueryResult<T[]> = {
    status: classified?.status ?? (data.length ? "ok" : "empty_result"),
    data,
    errorCode: classified?.code ?? null,
    durationMs: Date.now() - started,
    count: data.length,
  };
  logQuery(operation, result);
  return result;
}
function clientFor(deps: SiteLookupDependencies) {
  return deps.client ?? siteSupabase();
}
function configured(deps: SiteLookupDependencies) {
  return deps.configured ?? isSiteConfigured();
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const previous = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[b.length]!;
}

function fuzzyTokenHit(token: string, words: string[]): boolean {
  return words.some(
    (word) =>
      word.includes(token) ||
      token.includes(word) ||
      (token.length >= 4 &&
        Math.abs(word.length - token.length) <= 2 &&
        editDistance(token, word) <= 2),
  );
}

export async function querySiteProducts(
  query: string,
  limit = 8,
  deps: SiteLookupDependencies = {},
  listAll = false,
): Promise<SiteQueryResult<SiteProduct[]>> {
  const operation = "products lookup";
  if (!configured(deps)) return unavailable(operation, []);
  const started = Date.now();
  try {
    const client = clientFor(deps);
    const normalized = normalizeName(query)
      .replace(/[^a-z0-9\s/]/g, " ")
      .trim();
    const tokens = normalized
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !PRODUCT_SEARCH_STOPWORDS.has(token))
      .slice(0, 8);
    let request = client.from("products").select(PRODUCT_SELECT).eq("active", true);
    if (!listAll && tokens.length)
      request = request.or(
        tokens.flatMap((token) => [`name.ilike.*${token}*`, `code.ilike.*${token}*`]).join(","),
      );
    let response: { data: unknown[] | null; error: unknown } = await request.limit(
      Math.min(Math.max(limit * 5, 20), 100),
    );
    if (response.error && classifyError(response.error).status === "schema_error") {
      let fallback = client.from("products").select(PRODUCT_FALLBACK_SELECT).eq("active", true);
      if (!listAll && tokens.length)
        fallback = fallback.or(
          tokens.flatMap((token) => [`name.ilike.*${token}*`, `code.ilike.*${token}*`]).join(","),
        );
      response = await fallback.limit(Math.min(Math.max(limit * 5, 20), 100));
    }
    if (!response.error && !listAll && tokens.length && (response.data?.length ?? 0) === 0) {
      response = await client.from("products").select(PRODUCT_SELECT).eq("active", true).limit(100);
      if (response.error && classifyError(response.error).status === "schema_error")
        response = await client
          .from("products")
          .select(PRODUCT_FALLBACK_SELECT)
          .eq("active", true)
          .limit(100);
    }
    if (response.error) return finish(operation, started, [], response.error);
    const products = (
      (response.data ?? []) as Array<Partial<SiteProduct> & { id: string; name: string }>
    ).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code ?? null,
      slug: p.slug ?? null,
      price: p.price ?? null,
      active: p.active ?? true,
      stock: p.stock ?? null,
      featured: p.featured ?? null,
      description: p.description ?? null,
      images: Array.isArray(p.images)
        ? p.images.filter((item): item is string => typeof item === "string")
        : [],
      brand: p.brand ?? null,
      consumer_price: p.consumer_price ?? null,
      consumer_pix_price: p.consumer_pix_price ?? null,
      producer_price: p.producer_price ?? null,
      producer_pix_price: p.producer_pix_price ?? null,
      reseller_price: p.reseller_price ?? null,
      reseller_pix_price: p.reseller_pix_price ?? null,
      installments: p.installments ?? null,
      on_sale: p.on_sale ?? null,
      sale_consumer_price: p.sale_consumer_price ?? null,
      sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,
    }));
    if (listAll || !tokens.length) return finish(operation, started, products.slice(0, limit));
    const ranked = products
      .map((product) => {
        const name = normalizeName(product.name);
        const code = normalizeName(product.code ?? "");
        const words = `${name} ${code}`.split(/\s+/).filter(Boolean);
        const distanceHits = tokens.filter((token) => fuzzyTokenHit(token, words)).length;
        return { product, score: distanceHits / tokens.length };
      })
      .filter(({ score }) => score >= 0.34)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "pt-BR"))
      .slice(0, limit)
      .map(({ product }) => product);
    return finish(operation, started, ranked);
  } catch (error) {
    return finish(operation, started, [], error);
  }
}

export async function queryRecommendedSiteProducts(
  query: string,
  limit = 8,
  deps: SiteLookupDependencies = {},
): Promise<SiteQueryResult<SiteProduct[]>> {
  const operation = "products recommendation lookup";
  if (!configured(deps)) return unavailable(operation, []);
  const started = Date.now();
  try {
    const client = clientFor(deps);
    let response: { data: unknown[] | null; error: unknown } = await client
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("active", true)
      .limit(500);
    if (response.error && classifyError(response.error).status === "schema_error") {
      response = await client
        .from("products")
        .select(PRODUCT_FALLBACK_SELECT)
        .eq("active", true)
        .limit(500);
    }
    if (response.error) return finish(operation, started, [], response.error);
    const products = (
      (response.data ?? []) as Array<Partial<SiteProduct> & { id: string; name: string }>
    ).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code ?? null,
      slug: p.slug ?? null,
      price: p.price ?? null,
      active: p.active ?? true,
      stock: p.stock ?? null,
      featured: p.featured ?? null,
      description: p.description ?? null,
      images: Array.isArray(p.images)
        ? p.images.filter((item): item is string => typeof item === "string")
        : [],
      brand: p.brand ?? null,
      consumer_price: p.consumer_price ?? null,
      consumer_pix_price: p.consumer_pix_price ?? null,
      producer_price: p.producer_price ?? null,
      producer_pix_price: p.producer_pix_price ?? null,
      reseller_price: p.reseller_price ?? null,
      reseller_pix_price: p.reseller_pix_price ?? null,
      installments: p.installments ?? null,
      on_sale: p.on_sale ?? null,
      sale_consumer_price: p.sale_consumer_price ?? null,
      sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,
    }));
    const ranked = rankDuKampProductsForNeed(products, query, limit);
    return finish(operation, started, ranked);
  } catch (error) {
    return finish(operation, started, [], error);
  }
}

export async function querySiteSellers(
  text = "",
  limit = 30,
  deps: SiteLookupDependencies = {},
): Promise<SiteQueryResult<SiteSeller[]>> {
  const operation = "sellers lookup";
  if (!configured(deps)) return unavailable(operation, []);
  const started = Date.now();
  try {
    const client = clientFor(deps);
    let response: { data: unknown[] | null; error: unknown } = await client
      .from("sellers")
      .select("id,name,role,region,phone,whatsapp,active,display_order")
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(limit);
    if (response.error && classifyError(response.error).status === "schema_error")
      response = await client
        .from("sellers")
        .select("id,name,role,region,phone,whatsapp,active")
        .eq("active", true)
        .order("name", { ascending: true })
        .limit(limit);
    if (response.error) return finish(operation, started, [], response.error);
    const sellers = (response.data ?? []) as SiteSeller[];
    const match = text.trim()
      ? matchSellerRequest(text, sellers)
      : { kind: "all" as const, sellers, label: null };
    return finish(operation, started, match.sellers as SiteSeller[]);
  } catch (error) {
    return finish(operation, started, [], error);
  }
}

export async function querySiteCategories(
  deps: SiteLookupDependencies = {},
): Promise<SiteQueryResult<string[]>> {
  const operation = "categories lookup";
  if (!configured(deps)) return unavailable(operation, []);
  const started = Date.now();
  try {
    const client = clientFor(deps);
    let response: { data: unknown[] | null; error: unknown } = await client
      .from("categories")
      .select("name,active,sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (response.error && classifyError(response.error).status === "schema_error")
      response = await client
        .from("categories")
        .select("name,active")
        .eq("active", true)
        .order("name", { ascending: true });
    if (response.error) return finish(operation, started, [], response.error);
    const rows = (response.data ?? []) as Array<{ name: string }>;
    return finish(
      operation,
      started,
      rows.map((row) => row.name),
    );
  } catch (error) {
    return finish(operation, started, [], error);
  }
}
export async function querySiteSettings(
  deps: SiteLookupDependencies = {},
): Promise<SiteQueryResult<Array<{ key: string }>>> {
  const operation = "site settings lookup";
  if (!configured(deps)) return unavailable(operation, []);
  const started = Date.now();
  try {
    const response = await clientFor(deps).from("site_settings").select("key").limit(20);
    if (response.error) return finish(operation, started, [], response.error);
    return finish(operation, started, (response.data ?? []) as Array<{ key: string }>);
  } catch (error) {
    return finish(operation, started, [], error);
  }
}
export async function searchSiteProducts(query: string, limit = 8): Promise<SiteProduct[]> {
  return (await querySiteProducts(query, limit)).data;
}
export async function listSiteSellers(limit = 30): Promise<SiteSeller[]> {
  return (await querySiteSellers("", limit)).data;
}
export async function findSellersByRegion(text: string): Promise<SiteSeller[]> {
  return (await querySiteSellers(text, 100)).data;
}
export async function listSiteCategories(): Promise<string[]> {
  return (await querySiteCategories()).data;
}

export interface CommercialExecution {
  lookup: SiteLookup;
  statuses: string[];
}

/** Liga a intenção validada às consultas reais do Supabase comercial. */
export async function executeCommercialLookup(
  intent: IntentClassification,
  text: string,
  deps: SiteLookupDependencies = {},
): Promise<CommercialExecution> {
  const hints = siteIntentHints(text);
  const lookup: SiteLookup = {};
  const statuses: string[] = [];
  if (["product", "product_recommendation", "internal_price"].includes(intent.intent)) {
    const products =
      intent.intent === "product_recommendation" || PURPOSE_RE.test(text)
        ? await queryRecommendedSiteProducts(text, 8, deps)
        : await querySiteProducts(text, 12, deps, hints.listProducts);
    if (products.data.length) lookup.products = products.data;
    statuses.push(`site-products:${products.status}`);
  }
  if (intent.intent === "seller_contact") {
    const sellers = await querySiteSellers(text, 30, deps);
    if (sellers.data.length) lookup.sellers = sellers.data;
    statuses.push(`site-sellers:${sellers.status}`);
  }
  if (intent.intent === "store" || hints.category) {
    const categories = hints.category ? await querySiteCategories(deps) : null;
    if (categories?.data.length) lookup.categories = categories.data;
    if (categories) statuses.push(`site-categories:${categories.status}`);
  }
  return { lookup, statuses };
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
      const publicPrice =
        p.on_sale && p.sale_consumer_price != null
          ? p.sale_consumer_price
          : (p.consumer_price ?? p.price);
      const publicPix =
        p.on_sale && p.sale_consumer_pix_price != null
          ? p.sale_consumer_pix_price
          : p.consumer_pix_price;
      const details = [
        p.brand ? `marca: ${p.brand}` : null,
        p.code ? `código: ${p.code}` : null,
        publicPrice != null ? `preço público: ${fmtPrice(publicPrice)}` : null,
        publicPix != null ? `Pix público: ${fmtPrice(publicPix)}` : null,
        p.installments && p.installments > 1 ? `até ${p.installments}x` : null,
        p.stock != null ? `estoque: ${p.stock}` : null,
      ].filter(Boolean);
      const description = p.description?.trim()
        ? `\n  descrição oficial: ${p.description.trim().slice(0, 700)}`
        : "";
      const images = (p.images ?? []).filter(Boolean).slice(0, 3);
      const imageLine = images.length ? `\n  imagens oficiais: ${images.join(" | ")}` : "";
      return `- ${p.name}${details.length ? ` — ${details.join("; ")}` : ""}${description}${imageLine}`;
    });
    parts.push(`DADOS OFICIAIS E ATUAIS DA DUKAMP — PRODUTOS COMERCIAIS:\n${lines.join("\n")}`);
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
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickAfter(text: string, label: RegExp): string | undefined {
  const m = text.match(label);
  if (!m) return undefined;
  const rest = text.slice(m.index! + m[0].length);
  // Stop at next known label OR the next numbered section heading like "2. Objeto".
  const stopRe =
    /(Raz[aã]o social\s*:|Nome fantasia\s*:|CNPJ\s*:|Endere[cç]o\s*:|E-?mail[^:\n]{0,40}:|Telefone[^:\n]{0,40}:|WhatsApp[^:\n]{0,40}:|\s\d{1,2}\.\s+[A-ZÀ-Ú])/;
  const stop = rest.search(stopRe);
  const val = (stop >= 0 ? rest.slice(0, stop) : rest).trim();
  // Strip a trailing dangling "Telefone ou" / "E-mail" fragment if present.
  const cleaned = val
    .replace(/^[:\-\s]+/, "")
    .replace(
      /\s+(Telefone|E-?mail|WhatsApp|CNPJ|Endere[cç]o|Raz[aã]o social|Nome fantasia)(\s+(ou|de)\s+\w+)?\s*$/i,
      "",
    )
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
      .in("key", [
        "footer_page:termos-e-condicoes",
        "footer_page:como-comprar",
        "footer_page:politica-de-entrega",
      ]),
    listSiteSellers(200),
  ]);

  let headquarters: SiteUnit | undefined;
  for (const row of (settings ?? []) as Array<{
    key: string;
    value?: { html?: unknown };
  }>) {
    const html = typeof row.value?.html === "string" ? row.value.html : "";
    if (!html) continue;
    const text = stripHtml(html);
    const address = pickAfter(text, /Endere[cç]o\s*:/i);
    if (!address) continue;
    headquarters = {
      label: "Matriz",
      razaoSocial: pickAfter(text, /Raz[aã]o social\s*:/i),
      cnpj: pickAfter(text, /CNPJ\s*:/i),
      address,
      email:
        (
          text.match(/E-?mail(?:\s+de\s+atendimento)?\s*:\s*([^\s<>()]+@[^\s<>()]+)/i)?.[1] ?? ""
        ).trim() || undefined,
      phone:
        (
          text.match(/Telefone(?:\s+ou\s+WhatsApp)?\s*:\s*([()\d\s\-+.]{8,25})/i)?.[1] ?? ""
        ).trim() || undefined,
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
