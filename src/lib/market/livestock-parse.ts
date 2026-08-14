// Extração determinística de intenção para cotações pecuárias.
// Puro: recebe os catálogos já carregados e devolve a intenção detectada.

export interface LivestockCategoryRow {
  slug: string;
  nome: string;
  especie: string;
  unidade_padrao: string;
  sinonimos: string[];
  max_idade_dias: number;
  ordem: number;
}

export interface LivestockPlaceRow {
  slug: string;
  municipio: string;
  uf: string;
  regiao: string | null;
  is_praca_pecuaria: boolean;
  lat: number | null;
  lon: number | null;
  apelidos: string[];
}

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Pergunta tem intenção de preço/cotação? */
export const LIVESTOCK_PRICE_INTENT_RE =
  /(^|[^a-z0-9])(cotacao|cotacoes|preco|precos|valor|vale|custa|custando|arroba|arrobas|mercado|fechamento|indicador|quanto (esta|ta|sai|vale|custa))([^a-z0-9]|$)/;

/** Testa a intenção de preço sobre o texto já normalizado (sem acento). */
export function hasPriceIntent(text: string): boolean {
  return LIVESTOCK_PRICE_INTENT_RE.test(norm(text)) || text.includes("@");
}

const UF_RE =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

const UF_NAMES: Record<string, string> = {
  "sao paulo": "SP",
  "mato grosso do sul": "MS",
  "mato grosso": "MT",
  "minas gerais": "MG",
  goias: "GO",
  parana: "PR",
  "rio grande do sul": "RS",
  "santa catarina": "SC",
  bahia: "BA",
  para: "PA",
  rondonia: "RO",
  tocantins: "TO",
  maranhao: "MA",
  piaui: "PI",
  acre: "AC",
  amazonas: "AM",
};

export function detectUf(text: string, places: LivestockPlaceRow[]): string | null {
  const upper = text.toUpperCase();
  const m = upper.match(UF_RE);
  // evita casar "SP" dentro de outra palavra já tratado pelo \b
  if (m) return m[1];
  const low = norm(text);
  for (const [name, uf] of Object.entries(UF_NAMES)) {
    // "são paulo" pode ser a cidade — só vira UF se não houver município homônimo citado
    if (new RegExp(`\\b${name}\\b`).test(low)) {
      const isCity = places.some((p) => norm(p.municipio) === name);
      if (!isCity) return uf;
    }
  }
  return null;
}

/** Match do município (nome completo ou apelido). Prefere o nome mais longo. */
export function detectPlace(text: string, places: LivestockPlaceRow[]): LivestockPlaceRow | null {
  const low = norm(text);
  let best: { row: LivestockPlaceRow; len: number } | null = null;
  for (const p of places) {
    const candidates = [norm(p.municipio), ...(p.apelidos ?? []).map(norm)].filter(Boolean);
    for (const c of candidates) {
      if (c.length < 4) continue;
      if (new RegExp(`(^|[^a-z0-9])${escapeRe(c)}([^a-z0-9]|$)`).test(low)) {
        if (!best || c.length > best.len) best = { row: p, len: c.length };
      }
    }
  }
  return best?.row ?? null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detecta a categoria pecuária. Percorre sinônimos do mais longo para o mais
 * curto para que "vaca gorda" nunca seja confundido com "boi", e "bezerra"
 * nunca com "bezerro".
 */
export function detectCategory(
  text: string,
  categories: LivestockCategoryRow[],
): LivestockCategoryRow | null {
  const low = norm(text);
  const pairs: Array<{ term: string; row: LivestockCategoryRow }> = [];
  for (const c of categories) {
    for (const s of [c.nome, ...(c.sinonimos ?? [])]) {
      const t = norm(s);
      if (t) pairs.push({ term: t, row: c });
    }
  }
  pairs.sort((a, b) => b.term.length - a.term.length);
  for (const { term, row } of pairs) {
    if (new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`).test(low)) return row;
  }
  return null;
}

export function detectUnit(text: string): string | null {
  const low = norm(text);
  if (/\b(arroba|arrobas|@)\b/.test(low) || text.includes("@")) return "@";
  if (/\b(por\s+)?(kg|quilo|quilos|kilo)\b/.test(low)) return "kg";
  if (/\b(cabe[cç]a|cabeças|cabecas|por\s+cabeca)\b/.test(low)) return "cabeça";
  return null;
}

export interface LivestockQuery {
  category: LivestockCategoryRow;
  place: LivestockPlaceRow | null;
  uf: string | null;
  unit: string;
}

/** Contexto mínimo persistido entre turnos de uma conversa de mercado. */
export interface LivestockConversationContext {
  categorySlug?: string | null;
  placeSlug?: string | null;
  uf?: string | null;
  unit?: string | null;
}

interface LivestockContextOptions {
  previous?: LivestockConversationContext | null;
  history?: Array<{ role?: string; content: string }>;
}

const LIVESTOCK_FOLLOW_UP_RE =
  /^(?:e\s+)?(?:a|o|da|do|de|em|no|na|para|hoje|ontem|agora|antes\s+de\s+ontem)\b/i;
const NON_LIVESTOCK_MARKET_RE =
  /\b(milho|soja|farelo\s+de\s+soja|leite|frango|su[ií]no|porco|ovos?|til[aá]pia|d[oó]lar|ptax|diesel)\b/i;

export function parseLivestockQuery(
  text: string,
  categories: LivestockCategoryRow[],
  places: LivestockPlaceRow[],
): LivestockQuery | null {
  if (!hasPriceIntent(text)) return null;
  const category = detectCategory(text, categories);
  if (!category) return null;
  const place = detectPlace(text, places);
  const uf = detectUf(text, places) ?? place?.uf ?? null;
  const unit = detectUnit(text) ?? category.unidade_padrao;
  return { category, place, uf, unit };
}

export function livestockConversationContext(query: LivestockQuery): LivestockConversationContext {
  return {
    categorySlug: query.category.slug,
    placeSlug: query.place?.slug ?? null,
    uf: query.uf,
    unit: query.unit,
  };
}

function contextFromHistory(
  history: Array<{ role?: string; content: string }>,
  categories: LivestockCategoryRow[],
  places: LivestockPlaceRow[],
): LivestockConversationContext | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role && message.role !== "user") continue;
    const parsed = parseLivestockQuery(message.content, categories, places);
    if (parsed) return livestockConversationContext(parsed);
  }
  return null;
}

/**
 * Resolve continuações como "e a vaca gorda?" ou "e em Minas Gerais?" sem
 * perder categoria, praça, UF e unidade já confirmadas. Dados explícitos do
 * turno atual sempre substituem o contexto anterior.
 */
export function parseLivestockQueryWithContext(
  text: string,
  categories: LivestockCategoryRow[],
  places: LivestockPlaceRow[],
  options: LivestockContextOptions = {},
): LivestockQuery | null {
  const currentCategory = detectCategory(text, categories);
  const currentPlace = detectPlace(text, places);
  const currentUf = detectUf(text, places);
  const currentUnit = detectUnit(text);
  const priceIntent = hasPriceIntent(text);

  // "E o milho?" depois de uma cotação bovina pertence ao roteador geral de
  // mercado e não pode herdar silenciosamente a categoria anterior.
  if (!currentCategory && NON_LIVESTOCK_MARKET_RE.test(text)) return null;

  const previous =
    options.previous ?? contextFromHistory(options.history ?? [], categories, places);
  const previousCategory = categories.find((row) => row.slug === previous?.categorySlug) ?? null;
  const previousPlace = places.find((row) => row.slug === previous?.placeSlug) ?? null;
  const hasCurrentMarketEntity = Boolean(
    currentCategory || currentPlace || currentUf || currentUnit,
  );
  const isFollowUp =
    Boolean(previousCategory) &&
    (priceIntent || hasCurrentMarketEntity || LIVESTOCK_FOLLOW_UP_RE.test(text.trim()));

  if (!priceIntent && !isFollowUp) return null;

  const category = currentCategory ?? previousCategory;
  if (!category) return null;

  // Uma UF explicitamente informada representa mudança de localidade e limpa
  // a cidade anterior. Uma nova cidade, por sua vez, define também a UF.
  const place = currentPlace ? currentPlace : currentUf ? null : previousPlace;
  const uf = currentPlace?.uf ?? currentUf ?? place?.uf ?? previous?.uf ?? null;
  const categoryChanged = Boolean(
    currentCategory && previousCategory && currentCategory.slug !== previousCategory.slug,
  );
  const unit =
    currentUnit ??
    (categoryChanged ? category.unidade_padrao : previous?.unit) ??
    category.unidade_padrao;

  return { category, place, uf, unit };
}

/* ------------------------------------------------------------------ */
/* Formatação                                                           */
/* ------------------------------------------------------------------ */

export function fmtMoney(v: number | string): string {
  return `R$ ${Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(d: string): string {
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

export function daysBetween(iso: string, ref = new Date()): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.floor((ref.getTime() - d) / 86_400_000);
}

export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
