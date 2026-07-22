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

const COUNT_RE = /\b(quantos|quantas|qual\s+o\s+numero|numero\s+de|quantidade\s+de)\b/i;
const LIST_RE = /\b(quais|liste|listar|liste\s+os?|mostre\s+os?|todos\s+os?\s+produtos?|produtos?\s+(disponi|dispon))/i;

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

export async function routeQuery(userText: string): Promise<RouterResult> {
  const species = detectSpecies(userText);

  // Structural: count
  if (COUNT_RE.test(userText)) {
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

  // Structural: list
  if (LIST_RE.test(userText)) {
    const items = await listActive(species);
    if (items.length === 0) {
      return { kind: "structural", text: "Nenhum produto ativo encontrado." };
    }
    // Cap displayed items to keep the reply readable.
    const shown = items.slice(0, 60);
    const bullets = shown.map((n) => `- ${n}`).join("\n");
    const more = items.length > shown.length ? `\n\n_(exibindo ${shown.length} de ${items.length})_` : "";
    return {
      kind: "structural",
      text: `Produtos ativos${species ? ` (${species === "ovinos_caprinos" ? "ovinos e caprinos" : species})` : ""}:\n\n${bullets}${more}`,
    };
  }

  // Name-based routing
  const { exact, ambiguous } = await findProductByName(userText);
  if (ambiguous) {
    const opts = ambiguous.candidates.map((c) => `- **${c.official_name}**`).join("\n");
    return {
      kind: "structural",
      text: `Encontrei mais de um produto que pode se encaixar. A qual deles você se refere?\n\n${opts}`,
    };
  }
  if (exact) return { kind: "passthrough", productHint: exact };

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
