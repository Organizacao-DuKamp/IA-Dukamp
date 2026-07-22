// Query router — classifies user messages BEFORE hitting the vector DB.
// Structural questions (count / list / filter by species) are answered from
// public `products` reads. Name mentions try aliases + official_name.
// Explanatory questions fall through to RAG.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeName } from "@/lib/products/normalize";

export type SpeciesKey = "bovinos" | "equinos" | "ovinos_caprinos" | "outros";
const SPECIES_LABELS: Record<SpeciesKey, string[]> = {
  bovinos: ["bovino", "bovinos", "gado", "vaca", "boi", "novilha", "bezerro"],
  equinos: ["equino", "equinos", "cavalo", "égua", "egua", "potro"],
  ovinos_caprinos: ["ovino", "ovinos", "ovelha", "carneiro", "caprino", "caprinos", "cabra", "bode"],
  outros: [],
};

function detectSpecies(text: string): SpeciesKey | null {
  const t = normalizeName(text);
  for (const [k, terms] of Object.entries(SPECIES_LABELS) as [SpeciesKey, string[]][]) {
    if (terms.some((w) => t.includes(w))) return k;
  }
  return null;
}

const COUNT_RE = /\b(quantos|quantas|qual\s+o\s+numero|numero\s+de|quantidade\s+de|tem\s+quantos|tem\s+quantas|existem\s+quantos)\b/i;
const LIST_RE = /\b(quais|liste|listar|mostre|todos\s+os?\s+produtos?|produtos?\s+(disponi|dispon))/i;
const FEATURED_RE = /\b(destaque|destaques|em\s+destaque|principais\s+produtos?|produtos?\s+principais|mais\s+vendidos?|top\s+produtos?)\b/i;
const SELLER_WORD_RE = /\b(vendedor|vendedora|vendedores|representante|revenda|revendedor|distribuidor)\b/i;
const CATEGORY_WORD_RE = /\b(categorias?|linhas?\s+de\s+produtos?|cat[aá]logos?)\b/i;
const UNIT_WORD_RE = /\b(unidades?|filial|filiais|matriz|endere[cç]os?|localiza[cç][aã]o|onde\s+fica|onde\s+est[aá])\b/i;
const PRICE_WORD_RE = /\b(pre[cç]o|valor|quanto\s+custa|custo|cotaç[aã]o)\b/i;

export interface StructuralAnswer {
  kind: "structural";
  text: string;
}
export interface AmbiguousProduct {
  kind: "ambiguous";
  candidates: Array<{ id: string; official_name: string }>;
}
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
}

export type RouterResult = StructuralAnswer | Passthrough;

/** Find product(s) whose official_name or alias appears in the user text. */
async function findProductByName(text: string): Promise<
  { exact: ProductMention | null; ambiguous: AmbiguousProduct | null }
> {
  const norm = normalizeName(text);
  if (norm.length < 3) return { exact: null, ambiguous: null };

  // Pull compact list of aliases + product names.
  const { data: aliases } = await supabaseAdmin
    .from("product_aliases")
    .select("alias_normalized, product_id");
  const { data: products } = await supabaseAdmin
    .from("products")
    .select(
      "id, official_name, species, category, description, indication, composition, guarantee_levels, consumption, usage_instructions, package_weight, animal_phase, active, is_duplicate, requires_review",
    );

  const activeById = new Map(
    (products ?? [])
      .filter((p) => p.active && !p.is_duplicate)
      .map((p) => [p.id, p]),
  );

  const hits = new Set<string>();
  for (const a of aliases ?? []) {
    if (!a.alias_normalized || a.alias_normalized.length < 3) continue;
    // Whole-word-ish check.
    const pattern = new RegExp(`(^|\\W)${a.alias_normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`);
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

async function countActive(species: SpeciesKey | null): Promise<{ n: number; source: "local" | "site" }> {
  let q = supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .eq("is_duplicate", false)
    .eq("requires_review", false);
  if (species) q = q.eq("species", species);
  const { count } = await q;
  if ((count ?? 0) > 0) return { n: count ?? 0, source: "local" };

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
  const local = (data ?? []).map((p) => p.official_name);
  if (local.length > 0) return local;

  // Fallback to the Dukamp site DB.
  try {
    const { siteSupabase, isSiteConfigured } = await import("@/lib/site/site-client.server");
    if (!isSiteConfigured()) return [];
    const { data: siteData } = await siteSupabase()
      .from("products")
      .select("name")
      .eq("active", true)
      .order("name", { ascending: true })
      .limit(300);
    return (siteData ?? []).map((p: any) => p.name as string);
  } catch {
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
  return (data ?? []).map((p: any) => ({ name: p.name as string, price: (p.price as number | null) ?? null }));
}

async function countSellers(): Promise<number> {
  const c = await siteClient();
  if (!c) return 0;
  const { count } = await c
    .from("sellers")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count ?? 0;
}

async function listSellersFull(): Promise<Array<{ name: string; role: string | null; region: string | null; phone: string | null; whatsapp: string | null }>> {
  const c = await siteClient();
  if (!c) return [];
  const { data } = await c
    .from("sellers")
    .select("name,role,region,phone,whatsapp,active,display_order")
    .eq("active", true)
    .order("display_order", { ascending: true })
    .limit(100);
  return (data ?? []) as any[];
}

async function findSellerByName(text: string): Promise<Array<{ name: string; role: string | null; region: string | null; phone: string | null; whatsapp: string | null }>> {
  const all = await listSellersFull();
  const norm = normalizeName(text);
  const hits = all.filter((s) => {
    const key = normalizeName(s.name);
    if (key.length < 3) return false;
    // token overlap: first name or full name inside text
    const firstName = key.split(/\s+/)[0];
    return norm.includes(key) || norm.includes(firstName);
  });
  return hits;
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
  return (data ?? []).map((r: any) => r.name as string);
}

/** Try to find a product on the site DB by name substring (fallback when local `products` is empty). */
async function findSiteProductByName(text: string): Promise<Array<{ name: string; price: number | null; code: string | null; description: string | null }>> {
  const c = await siteClient();
  if (!c) return [];
  const q = normalizeName(text).replace(/[^a-z0-9\s/]/g, " ").trim();
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3).slice(0, 5);
  if (tokens.length === 0) return [];
  const orExpr = tokens.map((t) => `name.ilike.*${t}*`).join(",");
  const { data } = await c
    .from("products")
    .select("name,price,code,description,active")
    .or(orExpr)
    .eq("active", true)
    .limit(20);
  return (data ?? []) as any[];
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

// ---- Main router ---------------------------------------------------------

export async function routeQuery(userText: string): Promise<RouterResult> {
  const species = detectSpecies(userText);
  const hasCount = COUNT_RE.test(userText);
  const hasList = LIST_RE.test(userText);
  const hasFeatured = FEATURED_RE.test(userText);
  const hasSellerWord = SELLER_WORD_RE.test(userText);
  const hasCategoryWord = CATEGORY_WORD_RE.test(userText);
  const hasUnitWord = UNIT_WORD_RE.test(userText);
  const hasPriceWord = PRICE_WORD_RE.test(userText);

  // Units / filial / matriz — data not available yet.
  if (hasUnitWord && !hasSellerWord) {
    return {
      kind: "structural",
      text: "Ainda não tenho os endereços das unidades DuKamp (matriz/filiais) cadastrados aqui. Recomendo consultar o site oficial ou falar com um vendedor DuKamp.",
    };
  }

  // Sellers — count
  if (hasSellerWord && hasCount) {
    const n = await countSellers();
    return {
      kind: "structural",
      text: n === 0
        ? "Não encontrei vendedores cadastrados no momento."
        : `Atualmente a DuKamp tem **${n} vendedor(es) ativo(s)** cadastrado(s).`,
    };
  }

  // Sellers — list
  if (hasSellerWord && (hasList || /todos|equipe/i.test(userText))) {
    const list = await listSellersFull();
    if (list.length === 0) return { kind: "structural", text: "Nenhum vendedor ativo encontrado." };
    const bullets = list.map((s) => {
      const parts = [`**${s.name}**`];
      if (s.role) parts.push(s.role);
      if (s.region) parts.push(s.region);
      const contact = s.whatsapp ? ` — WhatsApp: ${s.whatsapp}` : s.phone ? ` — Tel: ${s.phone}` : "";
      return `- ${parts.join(" — ")}${contact}`;
    }).join("\n");
    return { kind: "structural", text: `Vendedores DuKamp:\n\n${bullets}` };
  }

  // Sellers — by name
  if (hasSellerWord || /\b(quem\s+e|contato\s+d[aeo])\b/i.test(userText)) {
    const hits = await findSellerByName(userText);
    if (hits.length === 1) {
      const s = hits[0];
      const lines = [`**${s.name}**`];
      if (s.role) lines.push(`- Cargo: ${s.role}`);
      if (s.region) lines.push(`- Região: ${s.region}`);
      if (s.whatsapp) lines.push(`- WhatsApp: ${s.whatsapp}`);
      if (s.phone) lines.push(`- Telefone: ${s.phone}`);
      return { kind: "structural", text: lines.join("\n") };
    }
    if (hits.length > 1) {
      const opts = hits.map((s) => `- **${s.name}**${s.region ? ` (${s.region})` : ""}`).join("\n");
      return { kind: "structural", text: `Encontrei mais de um vendedor. A qual você se refere?\n\n${opts}` };
    }
  }

  // Categories
  if (hasCategoryWord && hasCount) {
    const n = await countCategories();
    return {
      kind: "structural",
      text: n === 0
        ? "Não encontrei categorias cadastradas."
        : `A DuKamp tem **${n} categoria(s) ativa(s)** no catálogo.`,
    };
  }
  if (hasCategoryWord && (hasList || /todas/i.test(userText))) {
    const cats = await listCategoriesFull();
    if (cats.length === 0) return { kind: "structural", text: "Nenhuma categoria ativa encontrada." };
    return { kind: "structural", text: `Categorias ativas:\n\n${cats.map((c) => `- ${c}`).join("\n")}` };
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
    const bullets = feat.map((p) => `- **${p.name}**${p.price != null ? ` — ${fmtBRL(p.price)}` : ""}`).join("\n");
    return { kind: "structural", text: `Produtos em destaque no site DuKamp:\n\n${bullets}` };
  }

  // Products — count
  if (hasCount && (!hasSellerWord && !hasCategoryWord)) {
    const { n, source } = await countActive(species);
    const label = species
      ? ` para ${species === "ovinos_caprinos" ? "ovinos e caprinos" : species}`
      : "";
    if (n === 0) {
      return { kind: "structural", text: `Ainda não tenho produtos cadastrados${label} na base ativa.` };
    }
    const suffix = source === "site" ? " (catálogo do site oficial DuKamp)" : "";
    return {
      kind: "structural",
      text: `Atualmente há **${n} produto(s) ativo(s)**${label} no catálogo DuKamp${suffix}.`,
    };
  }

  // Products — list
  if (hasList && !hasSellerWord && !hasCategoryWord) {
    const items = await listActive(species);
    if (items.length === 0) return { kind: "structural", text: "Nenhum produto ativo encontrado." };
    const shown = items.slice(0, 60);
    const bullets = shown.map((n) => `- ${n}`).join("\n");
    const more = items.length > shown.length ? `\n\n_(exibindo ${shown.length} de ${items.length})_` : "";
    return {
      kind: "structural",
      text: `Produtos ativos${species ? ` (${species === "ovinos_caprinos" ? "ovinos e caprinos" : species})` : ""}:\n\n${bullets}${more}`,
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
  const siteHits = await findSiteProductByName(userText);
  if (siteHits.length === 1) {
    const p = siteHits[0];
    const desc = stripHtml(p.description);
    const lines = [`**${p.name}**`];
    if (p.code) lines.push(`- Código: ${p.code}`);
    if (p.price != null) lines.push(`- Preço${hasPriceWord ? "" : " (site)"}: ${fmtBRL(p.price)}`);
    if (desc) lines.push(`\n${desc.slice(0, 1800)}`);
    return { kind: "structural", text: lines.join("\n") };
  }
  if (siteHits.length > 1 && siteHits.length <= 8) {
    const opts = siteHits.map((p) => `- **${p.name}**`).join("\n");
    return { kind: "structural", text: `Encontrei mais de um produto no site que pode se encaixar. A qual você se refere?\n\n${opts}` };
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
