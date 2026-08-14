// Query router — classifies user messages BEFORE hitting the vector DB.
// Structural questions (count / list / filter by species) are answered from
// public `products` reads. Name mentions try aliases + official_name.
// Explanatory questions fall through to RAG.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeName } from "@/lib/products/normalize";
import { shouldSkipGenericProductLookup } from "./product-routing-guard";
import {
  cleanContact,
  formatSellerList,
  matchSellerRequest,
  sellerContactLine,
  type PublicSeller,
} from "@/lib/site/seller-domain";
import type { ChatMessage } from "./types";
import type { LivestockConversationContext } from "@/lib/market/livestock-parse";

export type SpeciesKey = "bovinos" | "equinos" | "ovinos_caprinos" | "outros";
const SPECIES_LABELS: Record<SpeciesKey, string[]> = {
  bovinos: ["bovino", "bovinos", "gado", "vaca", "boi", "novilha", "bezerro"],
  equinos: ["equino", "equinos", "cavalo", "égua", "egua", "potro"],
  ovinos_caprinos: [
    "ovino",
    "ovinos",
    "ovelha",
    "carneiro",
    "caprino",
    "caprinos",
    "cabra",
    "bode",
  ],
  outros: [],
};

function detectSpecies(text: string): SpeciesKey | null {
  const t = normalizeName(text);
  for (const [k, terms] of Object.entries(SPECIES_LABELS) as [SpeciesKey, string[]][]) {
    if (terms.some((w) => t.includes(w))) return k;
  }
  return null;
}

const COUNT_RE =
  /\b(quanto(?!\s+custa)|quanta|quantos|quantas|qual\s+o\s+numero|n[uú]mero\s+de|quantidade\s+de|tem\s+quantos?|tem\s+quantas?|existem?\s+quantos?|total\s+de)\b/i;
const LIST_RE =
  /\b(quais|liste|listar|listagem|lista\s+d|mostre|mostrar|me\s+(diga|mande|manda|envie|passe|passa|traga|mostre|mostra)|mande|manda|envie|enviar|passe|passar|traga|trazer|diga\s+os?|nomes?\s+d[oe]s?\b(?!\w)|quem\s+s[aã]o|todos\s+os?|todas\s+as?|produtos?\s+(disponi|dispon))/i;
const FEATURED_RE =
  /\b(destaque|destaques|em\s+destaque|principais\s+produtos?|produtos?\s+principais|mais\s+vendidos?|top\s+produtos?)\b/i;
const SELLER_WORD_RE =
  /\b(vendedor|vendedora|vendedores|representante|revenda|revendedor|distribuidor|consultor\s+t[eé]cnico|quem\s+atende|quem\s+cuida\s+d[ae]|respons[aá]vel\s+pela\s+regi[aã]o|contato\s+comercial|equipe\s+comercial)\b/i;
const CATEGORY_WORD_RE = /\b(categorias?|linhas?\s+de\s+produtos?|cat[aá]logos?)\b/i;
const UNIT_WORD_RE =
  /\b(unidades?|filial|filiais|matriz|endere[cç]os?|localiza[cç][aã]o|onde\s+fica|onde\s+est[aá])\b/i;
const PRICE_WORD_RE =
  /\b(pre[cç]o|valor|quanto\s+custa|custo|cotaç[aã]o|estoque|disponibilidade)\b/i;

export interface StructuralAnswer {
  kind: "structural";
  text: string;
}
export interface AmbiguousProduct {
  kind: "ambiguous";
  candidates: Array<{ id: string; official_name: string }>;
}
type ProductLookupRow = ProductMention["product"] & {
  active: boolean;
  is_duplicate: boolean | null;
  requires_review: boolean | null;
};

export interface ProductMention {
  kind: "product";
  product: {
    id: string;
    official_name: string;
    species: string | null;
    category: string | null;
    description: string | null;
    indication: string | null;
    composition: string | null;
    guarantee_levels: string | null;
    consumption: string | null;
    usage_instructions: string | null;
    package_weight: string | null;
    animal_phase: string | null;
  };
  confidence: "exact" | "fuzzy";
}
export interface Passthrough {
  kind: "passthrough";
  productHint?: ProductMention;
  /** Bloco de cotações estruturadas injetado no contexto do modelo. */
  marketContext?: string;
  /** Entidades de mercado confirmadas para continuar a conversa sem ambiguidade. */
  livestockContext?: LivestockConversationContext;
  /** Controla se a resposta pode usar a base ou deve pesquisar preço corrente. */
  marketFreshness?: "fresh" | "stale" | "missing";
}

export type RouterResult = StructuralAnswer | Passthrough;

export interface RouterConversationContext {
  history?: ChatMessage[];
  livestock?: LivestockConversationContext | null;
}

/** Find product(s) whose official_name or alias appears in the user text. */
async function findProductByName(
  text: string,
): Promise<{ exact: ProductMention | null; ambiguous: AmbiguousProduct | null }> {
  if (shouldSkipGenericProductLookup(text)) return { exact: null, ambiguous: null };
  const norm = normalizeName(text);
  if (norm.length < 3) return { exact: null, ambiguous: null };

  // Pull compact list of aliases + product names. If the service role key is
  // missing (e.g. on Netlify without SUPABASE_SERVICE_ROLE_KEY), skip the
  // local lookup — the site fallback downstream will still work.
  let aliases: Array<{ alias_normalized: string | null; product_id: string }> | null = null;
  let products: ProductLookupRow[] | null = null;
  try {
    const res1 = await supabaseAdmin.from("product_aliases").select("alias_normalized, product_id");
    aliases = res1.data;
    const res2 = await supabaseAdmin
      .from("products")
      .select(
        "id, official_name, species, category, description, indication, composition, guarantee_levels, consumption, usage_instructions, package_weight, animal_phase, active, is_duplicate, requires_review",
      );
    products = res2.data;
  } catch (err) {
    console.warn(
      "[router] local products lookup skipped:",
      err instanceof Error ? err.message : err,
    );
    return { exact: null, ambiguous: null };
  }

  const activeById = new Map(
    (products ?? []).filter((p) => p.active && !p.is_duplicate).map((p) => [p.id, p]),
  );

  const hits = new Set<string>();
  for (const a of aliases ?? []) {
    if (!a.alias_normalized || a.alias_normalized.length < 3) continue;
    // Whole-word-ish check.
    const pattern = new RegExp(
      `(^|\\W)${a.alias_normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`,
    );
    if (pattern.test(norm)) hits.add(a.product_id);
  }
  for (const p of products ?? []) {
    const key = normalizeName(p.official_name);
    if (key.length < 3) continue;
    if (norm.includes(key)) hits.add(p.id);
  }

  const matched = [...hits].map((id) => activeById.get(id)).filter(Boolean) as NonNullable<
    ReturnType<typeof activeById.get>
  >[];

  if (matched.length === 0) return { exact: null, ambiguous: null };
  if (matched.length === 1) {
    const p = matched[0];
    return {
      exact: {
        kind: "product",
        product: {
          id: p.id,
          official_name: p.official_name,
          species: p.species,
          category: p.category,
          description: p.description,
          indication: p.indication,
          composition: p.composition,
          guarantee_levels: p.guarantee_levels,
          consumption: p.consumption,
          usage_instructions: p.usage_instructions,
          package_weight: p.package_weight,
          animal_phase: p.animal_phase,
        },
        confidence: "exact",
      },
      ambiguous: null,
    };
  }
  return {
    exact: null,
    ambiguous: {
      kind: "ambiguous",
      candidates: matched.map((p) => ({ id: p.id, official_name: p.official_name })),
    },
  };
}

async function countActive(
  species: SpeciesKey | null,
): Promise<{ n: number; source: "local" | "site" }> {
  try {
    let q = supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("is_duplicate", false)
      .eq("requires_review", false);
    if (species) q = q.eq("species", species);
    const { count } = await q;
    if ((count ?? 0) > 0) return { n: count ?? 0, source: "local" };
  } catch (err) {
    console.warn("[router] local count skipped:", err instanceof Error ? err.message : err);
  }

  // Fallback to the Dukamp site DB (source of truth for the commercial catalog).
  try {
    const { siteSupabase, isSiteConfigured } = await import("@/lib/site/site-client.server");
    if (!isSiteConfigured()) return { n: 0, source: "local" };
    const { count: siteCount } = await siteSupabase()
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("active", true);
    return { n: siteCount ?? 0, source: "site" };
  } catch {
    return { n: 0, source: "local" };
  }
}

async function listActive(species: SpeciesKey | null): Promise<string[]> {
  // Prioridade: catálogo próprio da marca DuKamp (base técnica). O catálogo do
  // site inclui itens de revenda da agropecuária, então só entra como reforço
  // (filtrado pela marca) ou como fallback quando a base própria está vazia.
  try {
    let q = supabaseAdmin
      .from("products")
      .select("official_name")
      .eq("active", true)
      .eq("is_duplicate", false)
      .eq("requires_review", false)
      .order("official_name", { ascending: true })
      .limit(200);
    if (species) q = q.eq("species", species);
    const { data } = await q;
    const names = (data ?? []).map((p) => p.official_name);
    if (names.length > 0) return names;
  } catch (err) {
    console.warn("[router] local list skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { siteSupabase, isSiteConfigured } = await import("@/lib/site/site-client.server");
    if (!isSiteConfigured()) return [];
    const { data: siteData } = await siteSupabase()
      .from("products")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(300);
    let names = ((siteData ?? []) as Array<{ name: string }>)
      .map((p) => p.name)
      .filter((n) => /kamp/i.test(n));
    if (species) {
      const terms = SPECIES_LABELS[species];
      const filtered = names.filter((n) =>
        terms.some((t) => normalizeName(n).includes(normalizeName(t))),
      );
      if (filtered.length > 0) names = filtered;
    }
    return names;
  } catch (err) {
    console.warn("[router] site catalog list skipped:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ---- Site (Dukamp website) helpers ---------------------------------------

async function siteClient() {
  const { siteSupabase, isSiteConfigured } = await import("@/lib/site/site-client.server");
  if (!isSiteConfigured()) return null;
  return siteSupabase();
}

async function listFeaturedProducts(): Promise<Array<{ name: string; price: number | null }>> {
  const c = await siteClient();
  if (!c) return [];
  const { data } = await c
    .from("products")
    .select("name,price,active,featured")
    .eq("active", true)
    .eq("featured", true)
    .order("name", { ascending: true })
    .limit(50);
  return (data ?? []).map((p) => ({
    name: p.name,
    price: p.price ?? null,
  }));
}

async function countSellers(): Promise<number> {
  const c = await siteClient();
  if (!c) return 0;
  const { count, error } = await c
    .from("sellers")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  if (error) {
    console.error("[site:sellers] count failed", { code: error.code ?? "unknown" });
    return 0;
  }
  return count ?? 0;
}

async function listSellersFull(): Promise<
  Array<{
    name: string;
    role: string | null;
    region: string | null;
    phone: string | null;
    whatsapp: string | null;
  }>
> {
  const c = await siteClient();
  if (!c) return [];
  const { data, error } = await c
    .from("sellers")
    .select("name,role,region,phone,whatsapp,active,display_order")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[site:sellers] directory lookup failed", { code: error.code ?? "unknown" });
    return [];
  }
  return data ?? [];
}

async function findSellerByName(text: string): Promise<
  Array<{
    name: string;
    role: string | null;
    region: string | null;
    phone: string | null;
    whatsapp: string | null;
  }>
> {
  const all = await listSellersFull();
  const match = matchSellerRequest(text, all);
  return match.kind === "name" ? match.sellers : [];
}

async function countCategories(): Promise<number> {
  const c = await siteClient();
  if (!c) return 0;
  const { count } = await c
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count ?? 0;
}

async function listCategoriesFull(): Promise<string[]> {
  const c = await siteClient();
  if (!c) return [];
  const { data } = await c
    .from("categories")
    .select("name,active,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => r.name);
}

const SITE_SEARCH_STOPWORDS = new Set([
  "sim",
  "nao",
  "não",
  "tem",
  "the",
  "quero",
  "saber",
  "nome",
  "nomes",
  "deles",
  "dela",
  "dele",
  "delas",
  "eles",
  "elas",
  "essa",
  "esse",
  "isso",
  "aqui",
  "ali",
  "sobre",
  "como",
  "onde",
  "quem",
  "qual",
  "quais",
  "quando",
  "porque",
  "por",
  "que",
  "com",
  "sem",
  "para",
  "pra",
  "dos",
  "das",
  "dum",
  "duma",
  "seu",
  "sua",
  "seus",
  "suas",
  "tudo",
  "todo",
  "toda",
  "todos",
  "todas",
  "muito",
  "muita",
  "mais",
  "menos",
  "meu",
  "minha",
  "voce",
  "você",
  "vocês",
  "obrigado",
  "obrigada",
  "favor",
  "ola",
  "olá",
  "oi",
  "boa",
  "bom",
  "dia",
  "tarde",
  "noite",
  "produto",
  "produtos",
  "vendedor",
  "vendedores",
  "categoria",
  "categorias",
  "cliente",
  "clientes",
  "dukamp",
  "preço",
  "preco",
  "valor",
  "fica",
  "ficam",
  "informa",
  "informe",
  "informação",
  "informacao",
  "informações",
  // verbos/expressões coloquiais comuns que geravam falsos positivos (ex: "toma" casando com "auTOMAtica")
  "toma",
  "tomar",
  "jeito",
  "jeitoo",
  "ajeita",
  "ajeitar",
  "vamos",
  "vai",
  "vem",
  "olha",
  "olhe",
  "entao",
  "então",
  "entendi",
  "entende",
  "entender",
  "legal",
  "bacana",
  "show",
  "massa",
  "cara",
  "gente",
  "tipo",
  "assim",
  "serio",
  "sério",
  "calma",
  "espera",
  "esperar",
  "deixa",
  "deixar",
  "fala",
  "falar",
  "faz",
  "fazer",
  "tudo",
  "nada",
  "algo",
  "alguma",
  "alguem",
  "alguém",
  "ninguém",
  "ninguem",
  "talvez",
  "acho",
  "achei",
  "acha",
  "achar",
  "preciso",
  "precisa",
  "precisar",
  "gostaria",
  "gostei",
  "gosta",
  "gostar",
  "aparece",
  "apareceu",
  "aparecer",
  "funciona",
  "funcionar",
  "erro",
  "erros",
  "bug",
  "teste",
  "testar",
  "ainda",
]);

/** Try to find a product on the site DB by name substring (fallback when local `products` is empty). */
async function findSiteProductByName(
  text: string,
): Promise<
  Array<{ name: string; price: number | null; code: string | null; description: string | null }>
> {
  if (shouldSkipGenericProductLookup(text)) return [];
  const c = await siteClient();
  if (!c) return [];
  const q = normalizeName(text)
    .replace(/[^a-z0-9\s/]/g, " ")
    .trim();
  const tokens = q
    .split(/\s+/)
    .filter((t) => t.length >= 5 && !SITE_SEARCH_STOPWORDS.has(t) && !/^\d+$/.test(t))
    .slice(0, 5);
  if (tokens.length === 0) return [];
  const orExpr = tokens.map((t) => `name.ilike.*${t}*`).join(",");
  const { data } = await c
    .from("products")
    .select("name,price,code,description,active")
    .or(orExpr)
    .eq("active", true)
    .limit(30);
  // Post-filter: token deve casar como palavra inteira no nome (evita "toma" casar com "auTOMAtica"/"decTOMAx").
  const rows = data ?? [];
  const filtered = rows.filter((p) => {
    const norm = normalizeName(p.name);
    return tokens.some((t) => {
      const re = new RegExp(`(^|\\W)${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\W|$)`);
      return re.test(norm);
    });
  });
  // Desempate: se um dos nomes aparecer (quase) inteiro na pergunta, ele vence
  // a ambiguidade — "me fale sobre o DUKAMP PROTÉICO SUPREMO 25KG" não deve
  // devolver lista de opções.
  if (filtered.length > 1) {
    const scored = filtered
      .map((p) => {
        const nameTokens = normalizeName(p.name)
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length >= 3);
        const hit = nameTokens.filter((t) => q.includes(t)).length;
        return { p, ratio: nameTokens.length ? hit / nameTokens.length : 0, hit };
      })
      .sort((a, b) => b.ratio - a.ratio || b.hit - a.hit);
    if (
      scored[0].ratio >= 0.7 &&
      (scored.length === 1 || scored[0].ratio - scored[1].ratio >= 0.2)
    ) {
      return [scored[0].p];
    }
  }
  return filtered.slice(0, 20);
}

function fmtBRL(n: number | null): string {
  if (n == null) return "";
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Mercado / cotações ---------------------------------------------------

/**
 * Responde perguntas de cotação a partir da tabela estruturada `market_quotes`.
 * Retorna null quando a pergunta não é de mercado — aí o fluxo normal segue.
 * Nunca devolve preço sem data, unidade, praça e fonte.
 */
interface MarketAnswerResult {
  context: string;
  freshness: "fresh" | "stale" | "missing";
}

async function marketAnswer(userText: string): Promise<MarketAnswerResult | null> {
  const mk = await import("@/lib/market/market.server");
  if (!mk.MARKET_INTENT_RE.test(userText)) return null;
  const targets = mk.detectMarketTargets(userText);
  if (targets.length === 0) return null;

  const state = mk.detectState(userText);
  const city = mk.detectCity(userText);
  const blocks: string[] = [];
  const unavailable: Array<{
    target: (typeof targets)[number];
    discardedDate: string | null;
  }> = [];

  for (const t of targets.slice(0, 3)) {
    const { series, note } = await mk
      .getSeriesNearest(t.slug, city, state)
      .catch(() => ({ series: [], note: null }));
    const a = mk.analyze(series);
    if (!a) {
      unavailable.push({ target: t, discardedDate: null });
      continue;
    }
    if (!mk.isCurrentMarketQuote(a.last.reference_date)) {
      unavailable.push({ target: t, discardedDate: a.last.reference_date });
      continue;
    }
    if (note) blocks.push(note);
    blocks.push(mk.quoteBlock(a));
    const basis = await mk.basisBlock(t.slug, state).catch(() => null);
    if (basis) blocks.push(basis);
  }

  if (/\b(rela[cç][aã]o|paridade|poder\s+de\s+compra|troca)\b/i.test(userText)) {
    const rel = await mk.relations(state).catch(() => []);
    blocks.push(...rel);
  }

  const placeLabel = city
    ? ` para ${city.name.replace(/\b\w/g, (m) => m.toUpperCase())}/${city.uf}`
    : state
      ? ` para ${state}`
      : "";

  for (const { target: t, discardedDate } of unavailable) {
    const srcs = await mk.suggestedSources(t.category).catch(() => []);
    const ref = srcs.map((s) => `${s.name} (${s.org}): ${s.url}`).join(" · ");
    blocks.push(
      `STATUS: SEM COTAÇÃO RECENTE — a base própria não tem publicação de hoje, ontem ou anteontem para ${t.label}${placeLabel}. ` +
        (discardedDate
          ? `O registro interno de ${mk.fmtDate(discardedDate)} foi descartado e o preço dele foi omitido por não ser corrente. `
          : "Não há registro interno utilizável para essa combinação. ") +
        `INSTRUÇÃO OBRIGATÓRIA (ordem exata): 1) BUSQUE AGORA na web, em fontes oficiais de mercado (CEPEA/ESALQ, Scot Consultoria, B3, Notícias Agrícolas, Canal Rural, Conab, IEA, cooperativas e bolsas regionais), a cotação mais recente de ${t.label}${placeLabel} — ou, se a cidade pedida não tiver publicação, a da praça publicada mais próxima. ` +
        `2) Se encontrar, apresente o valor trazendo obrigatoriamente preço + unidade, praça, data de referência e fonte, deixando claro (de forma natural) que é referência de publicação de mercado e não da base própria; se for de outra praça, diga qual e lembre que frete, prazo e negociação alteram o preço local. ` +
        `2b) BUSCA APROFUNDADA OBRIGATÓRIA: antes de dizer que não achou, tente em sequência (a) a cidade pedida, (b) praças vizinhas da mesma região, (c) o indicador estadual, (d) o indicador nacional/CEPEA. ` +
        `2c) ENQUADRAMENTO: se encontrar QUALQUER referência confiável, NUNCA comece a resposta com "não encontrei"/"não há cotação". Comece pelo valor com selo 🟡 e só depois explique que é de outra praça/indicador e o que pode mudar o preço local. ` +
        `3) Entregue o resultado nesta primeira resposta: nunca ofereça buscar, consultar ou comparar a referência mais recente em uma mensagem futura. ` +
        `4) Só se NENHUMA das quatro tentativas retornar algo confiável, diga com franqueza que não tem a cotação atualizada de ${t.label} agora e NÃO apresente valor algum. ` +
        `NUNCA invente, estime, arredonde ou use preço de memória/material técnico. ` +
        (ref ? `Fontes oficiais para oferecer ao usuário: ${ref}.` : ""),
    );
  }

  if (blocks.length === 0) return null;
  return {
    context: [
      "DADOS DE MERCADO (use exatamente estes números; nunca invente ou arredonde para outro valor):",
      ...blocks,
    ].join("\n"),
    freshness:
      unavailable.length === 0
        ? "fresh"
        : unavailable.some((item) => item.discardedDate)
          ? "stale"
          : "missing",
  };
}

// ---- Main router ---------------------------------------------------------

/**
 * Filtra a lista do catálogo pela finalidade citada na pergunta
 * ("produtos para bezerro", "ração de vaca de leite"). Evita despejar
 * o catálogo inteiro quando o usuário pediu algo específico.
 */
const PURPOSE_TERMS: Array<{ label: string; re: RegExp; match: RegExp }> = [
  {
    label: "bezerros",
    re: /\bbezerr[oa]s?\b|\bcreep\b|\baleitamento\b|\bterneir[oa]s?\b/i,
    match: /bezerr|creep|baby|inicial|aleita|leite\s*em\s*p|colostr/i,
  },
  {
    label: "vacas de leite",
    re: /\bvacas?\s+(de\s+)?leite\w*\b|\blactaç[aã]o\b|\bleiteir[ao]s?\b/i,
    match: /leit|lacta|ordenha/i,
  },
  {
    label: "vacas de cria",
    re: /\bvacas?\s+de\s+cria\b|\bcria\b|\bmatrizes?\b/i,
    match: /cria|reprodu|matriz|fosfor/i,
  },
  {
    label: "recria",
    re: /\brecria\b|\bnovilh[oa]s?\b|\bgarrote?s?\b/i,
    match: /recria|crescimento|novilh/i,
  },
  {
    label: "engorda / terminação",
    re: /\bengorda\b|\btermina[cç][aã]o\b|\bconfinament\w*\b|\bboi\s+gordo\b/i,
    match: /engorda|termina|confin|energ/i,
  },
  {
    label: "sal mineral",
    re: /\bsal\s+mineral\b|\bminerali?zaç\w*\b/i,
    match: /sal\s+mineral|suplement\w*\s+mineral|minerali|fosfat|fosfor|nucleo|n[uú]cleo/i,
  },
  { label: "proteinado", re: /\bproteinad[oa]s?\b|\bprote[ií]c[oa]s?\b/i, match: /prote/i },
  {
    label: "equinos",
    re: /\bequin[oa]s?\b|\bcavalo?s?\b|\bégua?s?\b/i,
    match: /equin|cavalo|horse|haras/i,
  },
  {
    label: "ovinos e caprinos",
    re: /\bovin[oa]s?\b|\bcaprin[oa]s?\b|\bovelh\w*\b|\bcabr\w*\b/i,
    match: /ovin|caprin|ovelh|cabr/i,
  },
  {
    label: "carrapaticidas",
    re: /\bcarrapat\w*\b|\bmosca\b|\bectoparasit\w*\b/i,
    match: /carrapat|mosca|ectop|pour|banho/i,
  },
  {
    label: "vermífugos",
    re: /\bverm[ií]fug\w*\b|\bverminose\b|\bendoparasit\w*\b/i,
    match:
      /verm[ií]fug|vermic|ivermec|ivermic|albenda|levamis|doramec|closant|antihelmint|anti-?helm/i,
  },
  { label: "vacinas", re: /\bvacinas?\b|\bimuniz\w*\b/i, match: /vacin|imuno|soro/i },
];

function filterCatalogByPurpose(
  items: string[],
  userText: string,
): { matched: string[]; label: string | null } {
  const hit = PURPOSE_TERMS.find((t) => t.re.test(userText));
  if (!hit) return { matched: [], label: null };
  const matched = items.filter((n) => hit.match.test(normalizeName(n)));
  return { matched, label: hit.label };
}

const PERSONAL_DATA_RE =
  /\b(cpf|rg|carteira\s+de\s+identidade|sal[aá]rio|comiss[aã]o\s+d[eo]|conta\s+banc[aá]ria|pix\s+pessoal|endere[cç]o\s+residencial|onde\s+mora|data\s+de\s+nascimento|documento\s+pessoal)\b/i;

export async function routeQuery(
  userText: string,
  conversation: RouterConversationContext = {},
): Promise<RouterResult> {
  if (PERSONAL_DATA_RE.test(userText)) {
    return {
      kind: "structural",
      text: "Não posso compartilhar dados pessoais (documentos, salários, endereços residenciais ou dados bancários) de vendedores ou clientes. Posso passar o contato comercial público do vendedor da sua região, se ajudar.",
    };
  }
  const species = detectSpecies(userText);
  const hasCount = COUNT_RE.test(userText);
  const hasList = LIST_RE.test(userText);
  const hasFeatured = FEATURED_RE.test(userText);
  const hasSellerWord = SELLER_WORD_RE.test(userText);
  const hasCategoryWord = CATEGORY_WORD_RE.test(userText);
  const hasUnitWord = UNIT_WORD_RE.test(userText);
  const hasPriceWord = PRICE_WORD_RE.test(userText);
  // Palavras que caracterizam consulta ao CATÁLOGO (e não uma pergunta técnica).
  const mentionsProdutoWord =
    /\b(produtos?|cat[aá]logo|itens|mercadorias?|ra[cç][oõ]es?|suplementos?|minerais?|n[uú]cleos?|concentrados?|sal\s+mineral|mineraliza\w*|sku|estoque|verm[ií]fug\w*|carrapaticidas?|vacinas?)\b/i.test(
      userText,
    );
  const marketQuoteIntent =
    /\b(cotaç[aã]o|cotaç[oõ]es|arroba|@|mercado|bolsa|b3|cepea|scot|indicador|futuros?|f[ií]sico|leil[aã]o|leil[oõ]es)\b/i.test(
      userText,
    );

  // ---- Cotações pecuárias (base própria, cascata cidade→praça→região→UF) ----
  const livestockResult = await import("@/lib/market/livestock.server")
    .then((m) =>
      m.livestockMarketAnswer(userText, conversation.history ?? [], conversation.livestock ?? null),
    )
    .catch(() => null);
  if (livestockResult) {
    return {
      kind: "passthrough",
      marketContext: livestockResult.context,
      livestockContext: livestockResult.conversationContext,
      marketFreshness: livestockResult.freshness,
    };
  }

  // ---- Cotações e indicadores de mercado (dados dinâmicos estruturados) ----
  const marketResult = await marketAnswer(userText).catch(() => null);
  if (marketResult)
    return {
      kind: "passthrough",
      marketContext: marketResult.context,
      marketFreshness: marketResult.freshness,
    };

  // Unidades: só responda com dados atuais recuperados do site.
  if (hasUnitWord && !hasSellerWord) {
    const { getSiteUnits } = await import("@/lib/site/site-lookup.server");
    const { headquarters, regions } = await getSiteUnits().catch(() => ({
      headquarters: undefined,
      regions: [] as string[],
    }));

    if (!headquarters) {
      return {
        kind: "structural",
        text: "Não consegui confirmar agora as unidades e os endereços no cadastro oficial da DuKamp. Para não passar uma informação desatualizada, tente novamente em alguns instantes.",
      };
    }

    const lines = [
      `**${headquarters.label} DuKamp**${headquarters.razaoSocial ? ` — ${headquarters.razaoSocial}` : ""}`,
    ];
    if (headquarters.address) lines.push(`- Endereço: ${headquarters.address}`);
    if (headquarters?.cnpj) lines.push(`- CNPJ: ${headquarters.cnpj}`);
    if (headquarters?.phone) lines.push(`- Telefone/WhatsApp: ${headquarters.phone}`);
    if (headquarters?.email) lines.push(`- E-mail: ${headquarters.email}`);
    if (!hasCount && regions.length > 0) {
      lines.push("");
      lines.push(`Regiões com vendedor ativo no cadastro: ${regions.join(", ")}.`);
    }
    if (hasCount) {
      lines.push("");
      lines.push(
        "O cadastro consultado confirma esta matriz, mas não fornece uma contagem confiável de todas as unidades. Por isso não vou estimar esse total.",
      );
    }

    return { kind: "structural", text: lines.join("\n") };
  }

  // Sellers — count (optionally filtered by region mentioned in the same message)
  if (hasSellerWord && hasCount) {
    const { findSellersByRegion } = await import("@/lib/site/site-lookup.server");
    const byRegion = await findSellersByRegion(userText);
    if (byRegion.length > 0 || /\b(em|no|na|nos|nas)\s+[a-zà-ú]/i.test(userText)) {
      // The user mentioned a region — answer only for that region.
      const regionLabel = byRegion[0]?.region ?? "essa região";
      if (byRegion.length === 0) {
        return {
          kind: "structural",
          text: `Não encontrei vendedores DuKamp cadastrados nessa região. Posso listar vendedores de regiões próximas ou passar o contato da matriz, se quiser.`,
        };
      }
      const bullets = byRegion
        .map((s) => {
          const parts = [`**${s.name}**`];
          if (s.role) parts.push(s.role);
          const contact = sellerContactLine(s as PublicSeller);
          return `- ${parts.join(" — ")}${contact}`;
        })
        .join("\n");
      return {
        kind: "structural",
        text: `A DuKamp tem **${byRegion.length} vendedor(es)** em ${regionLabel}:\n\n${bullets}`,
      };
    }
    const n = await countSellers();
    return {
      kind: "structural",
      text:
        n === 0
          ? "Não encontrei vendedores cadastrados no momento."
          : `Atualmente a DuKamp tem **${n} vendedor(es) ativo(s)** cadastrado(s).`,
    };
  }

  // Sellers — list (broadened: "nomes", "quem são", "todos", "equipe", "liste")
  if (
    hasSellerWord &&
    (hasList || /\b(todos|todas|equipe|nomes?|quem\s+s[aã]o)\b/i.test(userText))
  ) {
    const { findSellersByRegion } = await import("@/lib/site/site-lookup.server");
    const byRegion = await findSellersByRegion(userText);
    const list = byRegion.length > 0 ? byRegion : await listSellersFull();
    if (list.length === 0) return { kind: "structural", text: "Nenhum vendedor ativo encontrado." };
    const bullets = list
      .map((s) => {
        const parts = [`**${s.name}**`];
        if (s.role) parts.push(s.role);
        if (s.region && byRegion.length === 0) parts.push(s.region);
        const contact = sellerContactLine(s as PublicSeller);
        return `- ${parts.join(" — ")}${contact}`;
      })
      .join("\n");
    const header =
      byRegion.length > 0
        ? `Vendedores DuKamp em ${byRegion[0].region ?? "essa região"} (${list.length}):`
        : `Vendedores DuKamp (${list.length}):`;
    return { kind: "structural", text: `${header}\n\n${bullets}` };
  }

  // Sellers — by name
  if (hasSellerWord || /\b(quem\s+e|contato\s+d[aeo])\b/i.test(userText)) {
    const hits = await findSellerByName(userText);
    if (hits.length === 1) {
      const s = hits[0];
      const lines = [`**${s.name}**`];
      if (s.role) lines.push(`- Cargo: ${s.role}`);
      if (s.region) lines.push(`- Região: ${s.region}`);
      const wpp = cleanContact(s.whatsapp);
      const tel = cleanContact(s.phone);
      if (wpp) lines.push(`- WhatsApp: ${wpp}`);
      if (tel && tel !== wpp) lines.push(`- Telefone: ${tel}`);
      return { kind: "structural", text: lines.join("\n") };
    }
    if (hits.length > 1) {
      const opts = hits.map((s) => `- **${s.name}**${s.region ? ` (${s.region})` : ""}`).join("\n");
      return {
        kind: "structural",
        text: `Encontrei mais de um vendedor. A qual você se refere?\n\n${opts}`,
      };
    }
    // Antes de desistir, tenta por região/cidade citada.
    {
      const { findSellersByRegion } = await import("@/lib/site/site-lookup.server");
      const byRegion = await findSellersByRegion(userText);
      if (byRegion.length > 0) {
        const bullets = byRegion
          .map((s) => {
            const parts = [`**${s.name}**`];
            if (s.role) parts.push(s.role);
            if (s.region) parts.push(s.region);
            const contact = sellerContactLine(s as PublicSeller);
            return `- ${parts.join(" — ")}${contact}`;
          })
          .join("\n");
        return { kind: "structural", text: `Atendimento DuKamp para essa região:\n\n${bullets}` };
      }
    }

    // Um pedido genérico como "quero falar com algum vendedor" não contém
    // nome nem região. Nesse caso, a ação útil é consultar e apresentar o
    // cadastro ativo — não concluir, incorretamente, que uma cidade falhou.
    const available = await listSellersFull();
    if (available.length > 0) {
      const sellerAnswer = formatSellerList(
        matchSellerRequest(userText, available as PublicSeller[]),
      );
      return {
        kind: "structural",
        text: `${sellerAnswer}\n\nSe você me disser sua cidade, eu separo quem atende mais perto de você.`,
      };
    }

    // Nunca cair na web para "quem atende X": isso pode trazer contatos de
    // terceiros. Também não use telefone/endereço fixo como fallback.
    const { getSiteUnits } = await import("@/lib/site/site-lookup.server");
    const { headquarters } = await getSiteUnits().catch(() => ({ headquarters: undefined }));
    if (headquarters?.phone || headquarters?.email) {
      const channels = [
        headquarters.phone ? `Telefone/WhatsApp: ${headquarters.phone}` : null,
        headquarters.email ? `E-mail: ${headquarters.email}` : null,
      ]
        .filter(Boolean)
        .join(" — ");
      return {
        kind: "structural",
        text: `Não encontrei contatos individuais de vendedores ativos no cadastro agora. Como alternativa, este é o **atendimento institucional da DuKamp**: ${channels}.`,
      };
    }
    return {
      kind: "structural",
      text: "Não consegui consultar a lista de vendedores ativos da DuKamp agora. Tente novamente em alguns instantes para eu buscar os contatos atualizados no cadastro oficial.",
    };
  }

  // Categories
  if (hasCategoryWord && hasCount) {
    const n = await countCategories();
    return {
      kind: "structural",
      text:
        n === 0
          ? "Não encontrei categorias cadastradas."
          : `A DuKamp tem **${n} categoria(s) ativa(s)** no catálogo.`,
    };
  }
  if (hasCategoryWord && (hasList || /todas/i.test(userText))) {
    const cats = await listCategoriesFull();
    if (cats.length === 0)
      return { kind: "structural", text: "Nenhuma categoria ativa encontrada." };
    return {
      kind: "structural",
      text: `Categorias ativas:\n\n${cats.map((c) => `- ${c}`).join("\n")}`,
    };
  }

  // Featured products
  if (hasFeatured) {
    const feat = await listFeaturedProducts();
    if (feat.length === 0) {
      return {
        kind: "structural",
        text: "Não há produtos marcados como destaque no site DuKamp neste momento.",
      };
    }
    const bullets = feat
      .map((p) => `- **${p.name}**${p.price != null ? ` — ${fmtBRL(p.price)}` : ""}`)
      .join("\n");
    return { kind: "structural", text: `Produtos em destaque no site DuKamp:\n\n${bullets}` };
  }

  // Products — count. Só responde contagem de catálogo quando a pergunta é
  // claramente sobre produtos/itens da DuKamp. "Quantos piquetes preciso?" ou
  // "quanto isso custa?" são perguntas técnicas/comerciais, não contagem de SKU.
  const catalogScope = /\b(dukamp|cat[aá]logo|loja|site|voc[eê]s|estoque|linha)\b/i.test(userText);
  if (
    hasCount &&
    !hasSellerWord &&
    !hasCategoryWord &&
    !marketQuoteIntent &&
    mentionsProdutoWord &&
    (catalogScope || /\bprodutos?\b|\bitens\b|\bsku\b/i.test(userText))
  ) {
    const { n, source } = await countActive(species);
    const label = species
      ? ` para ${species === "ovinos_caprinos" ? "ovinos e caprinos" : species}`
      : "";
    if (n === 0) {
      return {
        kind: "structural",
        text: `Ainda não tenho produtos cadastrados${label} na base ativa.`,
      };
    }
    const suffix = source === "site" ? " (catálogo do site oficial DuKamp)" : "";
    return {
      kind: "structural",
      text: `Atualmente há **${n} produto(s) ativo(s)**${label} no catálogo DuKamp${suffix}.`,
    };
  }

  // Products — list (only when the user explicitly asked for products/catalog).
  // Mencionar apenas uma espécie (ex.: "cotação do boi gordo") NÃO deve
  // despejar o catálogo — precisa haver menção explícita a produto/ração/etc.
  const wantsCatalogList =
    hasList ||
    /\b(tem|t[eê]m|tem\s+algum|voc[eê]s\s+t[eê]m|vende[m]?|vendem|procuro|preciso\s+de|quero\s+um|quero\s+uma|indica|indicaç[aã]o\s+de)\b/i.test(
      userText,
    );
  if (
    wantsCatalogList &&
    !hasPriceWord &&
    !hasSellerWord &&
    !hasCategoryWord &&
    mentionsProdutoWord &&
    !marketQuoteIntent
  ) {
    const items = await listActive(species);
    if (items.length === 0) return { kind: "structural", text: "Nenhum produto ativo encontrado." };
    // Filtro por finalidade/categoria citada na pergunta ("para bezerros",
    // "para vaca de leite"): evita despejar o catálogo inteiro.
    const filtered = filterCatalogByPurpose(items, userText);
    const list = filtered.matched.length > 0 ? filtered.matched : items;
    const shown = list.slice(0, 40);
    const bullets = shown.map((n: string) => `- ${n}`).join("\n");
    const more =
      list.length > shown.length ? `\n\n_(exibindo ${shown.length} de ${list.length})_` : "";
    const header =
      filtered.matched.length > 0
        ? `Produtos DuKamp relacionados a **${filtered.label}**:`
        : `Produtos ativos${species ? ` (${species === "ovinos_caprinos" ? "ovinos e caprinos" : species})` : ""}:`;
    const note =
      filtered.matched.length === 0 && filtered.label
        ? `\n\n_(não achei itens com o termo "${filtered.label}" no nome; segue a lista geral)_`
        : "";
    return {
      kind: "structural",
      text: `${header}\n\n${bullets}${more}${note}`,
    };
  }

  // Name-based routing (local fichas técnicas)
  const { exact, ambiguous } = await findProductByName(userText);
  if (ambiguous) {
    const opts = ambiguous.candidates.map((c) => `- **${c.official_name}**`).join("\n");
    return {
      kind: "structural",
      text: `Encontrei mais de um produto que pode se encaixar. A qual deles você se refere?\n\n${opts}`,
    };
  }
  if (exact) return { kind: "passthrough", productHint: exact };

  // Site product name fallback (when local fichas are empty).
  // Only trigger when the user shows explicit product/commercial intent — otherwise
  // technical questions (ex.: "como calcular lotação de Brachiaria brizantha")
  // would incorrectly dump a product card just because a token matched a SKU name.
  const PRODUCT_INTENT_RE =
    /\b(pre[cç]o|valor|quanto\s+custa|custo|cotaç[aã]o|comprar|compra|adquirir|pedir|ped[ií]do|or[çc]amento|dispon[ií]vel|disponibilidade|estoque|vende|vendem|onde\s+(compro|acho|encontro)|tem\s+(o|a|esse|essa|algum|alguma)|ficha\s+t[eé]cnica|produto\s+chamado|informa[cç][oõ]es?\s+(do|sobre\s+o|sobre\s+a)\s+produto|me\s+(fale|diga|conte|explique|mostra|mostre|passa|passe)\s+(sobre|do|da|de|o|a)|fala\s+(sobre|do|da)|descreve|descreva|o\s+que\s+[eé]\s+(o|a|esse|essa)|para\s+que\s+serve|pra\s+que\s+serve|quero\s+saber\s+(sobre|do|da)|detalhes\s+(do|da|sobre))\b/i;
  const explicitProductIntent =
    hasPriceWord || mentionsProdutoWord || PRODUCT_INTENT_RE.test(userText);

  if (explicitProductIntent) {
    const siteHits = await findSiteProductByName(userText);
    if (siteHits.length === 1) {
      const p = siteHits[0];
      const desc = stripHtml(p.description);
      const lines = [`**${p.name}**`];
      if (p.code) lines.push(`- Código: ${p.code}`);
      if (p.price != null)
        lines.push(`- Preço${hasPriceWord ? "" : " (site)"}: ${fmtBRL(p.price)}`);
      if (desc) lines.push(`\n${desc.slice(0, 1800)}`);
      return { kind: "structural", text: lines.join("\n") };
    }
    if (siteHits.length > 1 && siteHits.length <= 8) {
      const opts = siteHits.map((p) => `- **${p.name}**`).join("\n");
      return {
        kind: "structural",
        text: `Encontrei mais de um produto no site que pode se encaixar. A qual você se refere?\n\n${opts}`,
      };
    }
  }

  return { kind: "passthrough" };
}

/** Build a structured product context block to feed the LLM (never exposed raw to user). */
export function productContextBlock(p: ProductMention["product"]): string {
  const rows: string[] = [`FICHA OFICIAL DO PRODUTO **${p.official_name}**`];
  const push = (label: string, v: string | null) => {
    if (v && v.trim()) rows.push(`- ${label}: ${v.trim()}`);
  };
  push("Espécie", p.species);
  push("Categoria", p.category);
  push("Fase animal", p.animal_phase);
  push("Embalagem", p.package_weight);
  push("Indicação", p.indication);
  push("Consumo", p.consumption);
  push("Modo de uso", p.usage_instructions);
  push("Composição", p.composition);
  push("Níveis de garantia", p.guarantee_levels);
  push("Descrição", p.description);
  return rows.join("\n");
}
