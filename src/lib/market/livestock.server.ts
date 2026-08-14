// Motor de resolução de cotações pecuárias.
// Cascata obrigatória: cidade → praça vinculada → região → estado → nacional.
// Nunca inventa valores: sem linha no banco, devolve `null` com selo vermelho.

import { marketDb } from "./market.server";
import {
  daysBetween,
  distanceKm,
  fmtDate,
  fmtMoney,
  livestockConversationContext,
  parseLivestockQueryWithContext,
  type LivestockConversationContext,
  type LivestockCategoryRow,
  type LivestockPlaceRow,
  type LivestockQuery,
} from "./livestock-parse";
import type { ChatMessage } from "../chat/types";
import { MAX_CURRENT_QUOTE_AGE_DAYS, selectLivestockCandidate } from "./livestock-ranking";

export { MAX_CURRENT_QUOTE_AGE_DAYS };

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CotacaoPecuaria {
  id?: string;
  categoria: string;
  estado: string;
  cidade: string | null;
  cidade_slug: string;
  regiao: string;
  abrangencia: "municipal" | "regional" | "estadual" | "nacional";
  preco_minimo: number | null;
  preco_maximo: number | null;
  preco_referencia: number;
  unidade: string;
  condicao_pagamento: string | null;
  data_cotacao: string;
  fonte: string;
  url_fonte: string | null;
  nivel_confiabilidade: "alta" | "media" | "baixa";
  observacao: string | null;
  data_coleta?: string;
}

export type SealLevel = "local" | "regional" | "estadual" | "indisponivel";

export interface LivestockResolution {
  query: LivestockQuery;
  quote: CotacaoPecuaria | null;
  seal: SealLevel;
  sealLabel: string;
  /** Praça efetivamente usada, quando diferente da pedida. */
  usedPlace: string | null;
  distanceKm: number | null;
  ageDays: number | null;
  stale: boolean;
  note: string | null;
}

/* ------------------------------------------------------------------ */
/* Catálogos (cache por instância)                                      */
/* ------------------------------------------------------------------ */

let _cats: LivestockCategoryRow[] | null = null;
let _places: LivestockPlaceRow[] | null = null;
let _links: Array<{
  origem_slug: string;
  praca_slug: string;
  ordem: number;
  distancia_km: number | null;
}> | null = null;

export async function loadCategories(): Promise<LivestockCategoryRow[]> {
  if (_cats) return _cats;
  const { data, error } = await marketDb()
    .from("livestock_categories")
    .select("slug, nome, especie, unidade_padrao, sinonimos, max_idade_dias, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) throw new Error(error.message);
  _cats = (data ?? []) as LivestockCategoryRow[];
  return _cats;
}

export async function loadPlaces(): Promise<LivestockPlaceRow[]> {
  if (_places) return _places;
  const { data, error } = await marketDb()
    .from("livestock_places")
    .select("slug, municipio, uf, regiao, is_praca_pecuaria, lat, lon, apelidos");
  if (error) throw new Error(error.message);
  _places = (data ?? []) as LivestockPlaceRow[];
  return _places;
}

async function loadLinks(origem: string) {
  if (!_links) {
    const { data, error } = await marketDb()
      .from("livestock_place_links")
      .select("origem_slug, praca_slug, ordem, distancia_km")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    _links = (data ?? []) as any;
  }
  return (_links ?? []).filter((l) => l.origem_slug === origem).sort((a, b) => a.ordem - b.ordem);
}

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

async function latest(
  filters: Record<string, string>,
  categoria: string,
  unidade: string,
  asOfDate: string,
): Promise<CotacaoPecuaria | null> {
  let q = marketDb()
    .from("cotacoes_pecuarias")
    .select("*")
    .eq("categoria", categoria)
    .eq("unidade", unidade)
    .lte("data_cotacao", asOfDate)
    .order("data_cotacao", { ascending: false })
    .limit(1);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) return null;
  return (data?.[0] as CotacaoPecuaria) ?? null;
}

export interface LivestockResolverDependencies {
  now?: Date;
  loadPlaces?: () => Promise<LivestockPlaceRow[]>;
  loadLinks?: (originSlug: string) => Promise<
    Array<{
      origem_slug: string;
      praca_slug: string;
      ordem: number;
      distancia_km: number | null;
    }>
  >;
  latestQuote?: typeof latest;
}

interface CandidateSpec {
  filters: Record<string, string>;
  rank: number;
  seal: Exclude<SealLevel, "indisponivel">;
  usedPlace: string | null;
  distanceKm: number | null;
  note: string | null;
}

interface ResolvedCandidate extends CandidateSpec {
  quote: CotacaoPecuaria;
  ageDays: number;
}

function dateInSaoPaulo(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const pick = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

const SEAL_LABELS: Record<SealLevel, string> = {
  local: "🟢 Cotação Local",
  regional: "🟡 Referência Regional",
  estadual: "🟠 Referência Estadual",
  indisponivel: "🔴 Sem cotação recente",
};

/**
 * Percorre a cascata de localidades e devolve a melhor cotação disponível,
 * sempre acompanhada do selo de abrangência e do controle de frescor.
 */
export async function resolveLivestockQuote(
  query: LivestockQuery,
  dependencies: LivestockResolverDependencies = {},
): Promise<LivestockResolution> {
  const { category, place, uf, unit } = query;
  const now = dependencies.now ?? new Date();
  const asOfDate = dateInSaoPaulo(now);
  const places = await (dependencies.loadPlaces ?? loadPlaces)();
  const getLinks = dependencies.loadLinks ?? loadLinks;
  const getLatest = dependencies.latestQuote ?? latest;

  const build = (
    quote: CotacaoPecuaria | null,
    seal: SealLevel,
    usedPlace: string | null,
    dist: number | null,
    note: string | null,
  ): LivestockResolution => {
    const age = quote ? daysBetween(quote.data_cotacao, now) : null;
    const stale = age != null && age > MAX_CURRENT_QUOTE_AGE_DAYS;
    const finalSeal: SealLevel = !quote || stale ? "indisponivel" : seal;
    return {
      query,
      quote,
      seal: finalSeal,
      sealLabel: SEAL_LABELS[finalSeal],
      usedPlace,
      distanceKm: dist,
      ageDays: age,
      stale,
      note,
    };
  };

  const specs = new Map<string, CandidateSpec>();
  const add = (spec: CandidateSpec) => {
    const key = Object.entries(spec.filters)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, value]) => `${field}=${value}`)
      .join("&");
    const previous = specs.get(key);
    if (!previous || spec.rank < previous.rank) specs.set(key, spec);
  };

  // Monta toda a cascata antes de escolher. Assim, uma referência estadual de
  // hoje vence uma cotação municipal de um mês atrás; em datas iguais, a praça
  // geograficamente mais específica continua tendo prioridade.
  if (place) {
    add({
      filters: { cidade_slug: place.slug },
      rank: 0,
      seal: "local",
      usedPlace: place.municipio,
      distanceKm: 0,
      note: null,
    });

    const links = await getLinks(place.slug);
    for (const link of links) {
      const target = places.find((p) => p.slug === link.praca_slug);
      const dist =
        link.distancia_km ??
        (place.lat != null && place.lon != null && target?.lat != null && target.lon != null
          ? distanceKm({ lat: place.lat, lon: place.lon }, { lat: target.lat, lon: target.lon })
          : null);
      add({
        filters: { cidade_slug: link.praca_slug },
        rank: 10 + link.ordem,
        seal: "regional",
        usedPlace: target?.municipio ?? link.praca_slug,
        distanceKm: dist,
        note: `Não há cotação recente para ${place.municipio}/${place.uf}. Usada a praça pecuária de referência mais próxima.`,
      });
    }

    if (place.lat != null && place.lon != null) {
      const ranked = places
        .filter(
          (p) => p.slug !== place.slug && p.is_praca_pecuaria && p.lat != null && p.lon != null,
        )
        .map((p) => ({
          p,
          d: distanceKm({ lat: place.lat!, lon: place.lon! }, { lat: p.lat!, lon: p.lon! }),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 6);
      for (const { p, d } of ranked) {
        add({
          filters: { cidade_slug: p.slug },
          rank: 100 + d,
          seal: "regional",
          usedPlace: p.municipio,
          distanceKm: d,
          note: `Não há cotação recente para ${place.municipio}/${place.uf}. Usada a praça pecuária mais próxima com dado publicado.`,
        });
      }
    }

    if (place.regiao) {
      add({
        filters: { regiao: place.regiao },
        rank: 1_000,
        seal: "regional",
        usedPlace: place.regiao,
        distanceKm: null,
        note: `Sem cotação municipal recente para ${place.municipio}/${place.uf}. Usada a referência da região ${place.regiao}.`,
      });
    }
  }

  const state = uf ?? place?.uf ?? null;
  if (state) {
    add({
      filters: { estado: state, abrangencia: "estadual" },
      rank: 2_000,
      seal: "estadual",
      usedPlace: state,
      distanceKm: null,
      note: place
        ? `Sem cotação municipal ou regional recente para ${place.municipio}/${place.uf}. Usado o indicador estadual de ${state}.`
        : `Usado o indicador estadual de ${state}.`,
    });
    add({
      filters: { estado: state },
      rank: 3_000,
      seal: "estadual",
      usedPlace: state,
      distanceKm: null,
      note: `Sem cotação recente para a praça pedida. Usada a publicação mais nova disponível em ${state}.`,
    });
  }

  if (!place) {
    add({
      filters: { abrangencia: "nacional" },
      rank: 4_000,
      seal: "estadual",
      usedPlace: "Brasil",
      distanceKm: null,
      note: "Indicador nacional.",
    });
  }

  const candidates = (
    await Promise.all(
      [...specs.values()].map(async (spec): Promise<ResolvedCandidate | null> => {
        const quote = await getLatest(spec.filters, category.slug, unit, asOfDate);
        if (!quote) return null;
        const ageDays = daysBetween(quote.data_cotacao, now);
        if (ageDays < 0) return null;
        return { ...spec, quote, ageDays };
      }),
    )
  ).filter((candidate): candidate is ResolvedCandidate => candidate !== null);

  const selected = selectLivestockCandidate(
    candidates.map((candidate) => ({
      value: candidate,
      date: candidate.quote.data_cotacao,
      ageDays: candidate.ageDays,
      localityRank: candidate.rank,
    })),
  )?.value;
  if (!selected) return build(null, "indisponivel", null, null, null);
  return build(
    selected.quote,
    selected.seal,
    selected.usedPlace,
    selected.distanceKm,
    selected.note,
  );
}

/* ------------------------------------------------------------------ */
/* Bloco de contexto entregue ao modelo                                 */
/* ------------------------------------------------------------------ */

export function buildLivestockContext(r: LivestockResolution): string {
  const { category, place, uf, unit } = r.query;
  const askedLabel = place ? `${place.municipio}/${place.uf}` : uf ? uf : "praça não informada";

  if (!r.quote || r.stale) {
    const discardedHistorical = r.quote
      ? `A base possui apenas um registro de ${fmtDate(r.quote.data_cotacao)} (${r.ageDays} dia(s)), descartado por estar fora da janela corrente. O preço antigo foi omitido deste contexto e não pode ser usado na resposta.`
      : null;
    return [
      "COTAÇÃO PECUÁRIA — RESULTADO DA BASE OFICIAL",
      "STATUS: SEM COTAÇÃO RECENTE",
      `SELO: ${r.sealLabel}`,
      `Categoria: ${category.nome} · Unidade pedida: ${unit} · Local pedido: ${askedLabel}`,
      `A base própria não possui publicação de hoje, ontem ou anteontem para essa combinação.`,
      discardedHistorical,
      "INSTRUÇÃO OBRIGATÓRIA (ordem exata): 1) NÃO responda com registro histórico da base como se fosse atual. 2) BUSQUE AGORA na web, priorizando nesta ordem: publicação de hoje, de ontem e de anteontem, em fontes oficiais de mercado (CEPEA/ESALQ, Scot Consultoria, B3, Notícias Agrícolas, Canal Rural, IEA, Conab, sindicatos e associações rurais). 3) Procure primeiro a cidade/praça pedida, depois praças pecuárias vizinhas, o indicador estadual e por fim o indicador nacional. 4) Se encontrar, apresente o valor com selo 🟡 trazendo obrigatoriamente preço + unidade, praça, data de referência e fonte; se for de outra praça, avise e lembre que frete, escala e negociação mudam o preço local. 5) Se não houver publicação nesses três dias, use a publicação confiável mais recente que localizar, informe claramente a data e nunca a chame de preço de hoje. 6) Só se nenhuma busca retornar algo confiável, declare indisponibilidade. NUNCA invente, estime ou use preço de memória.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const q = r.quote;
  const faixa =
    q.preco_minimo != null && q.preco_maximo != null && q.preco_minimo !== q.preco_maximo
      ? `${fmtMoney(q.preco_minimo)} a ${fmtMoney(q.preco_maximo)}`
      : null;

  const lines = [
    "COTAÇÃO PECUÁRIA — RESULTADO DA BASE OFICIAL",
    "STATUS: COTAÇÃO RECENTE",
    `SELO: ${r.sealLabel}`,
    `Categoria: ${q.categoria === category.slug ? category.nome : q.categoria}`,
    `Local pedido: ${askedLabel}`,
    `Praça da cotação: ${q.cidade ?? (q.regiao || q.estado)}${q.estado ? `/${q.estado}` : ""}${
      r.distanceKm != null && r.distanceKm > 0
        ? ` (cerca de ${r.distanceKm} km do local pedido)`
        : ""
    }`,
    `Abrangência: ${q.abrangencia}`,
    `Preço de referência: ${fmtMoney(q.preco_referencia)}/${q.unidade}${faixa ? ` · faixa praticada: ${faixa}` : ""}`,
    q.condicao_pagamento ? `Condição de pagamento: ${q.condicao_pagamento}` : null,
    `Data da cotação: ${fmtDate(q.data_cotacao)}${r.ageDays != null ? ` (${r.ageDays} dia(s) atrás)` : ""}`,
    `Fonte: ${q.fonte}${q.url_fonte ? ` — ${q.url_fonte}` : ""}`,
    `Confiabilidade da fonte: ${q.nivel_confiabilidade}`,
    q.observacao ? `Observação: ${q.observacao}` : null,
    r.note ? `SUBSTITUIÇÃO DE PRAÇA: ${r.note}` : null,
    "",
    "INSTRUÇÕES OBRIGATÓRIAS DE RESPOSTA:",
    `1. Comece a resposta com o selo "${r.sealLabel}".`,
    "2. Use EXATAMENTE os números acima. Nunca arredonde para outro valor, nunca estime, nunca cite preço que não esteja nesse bloco.",
    "3. Informe sempre categoria, praça, unidade, data e fonte.",
    r.note
      ? "4. Diga de forma natural que o valor NÃO é da cidade pedida, e sim da praça de referência indicada, e lembre que frete, escala de abate e negociação mudam o preço local."
      : "4. Lembre que frete, prazo e negociação alteram o preço praticado localmente.",
  ].filter(Boolean);

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Entrada única usada pelo roteador                                    */
/* ------------------------------------------------------------------ */

export interface LivestockMarketResult {
  context: string;
  query: LivestockQuery;
  conversationContext: LivestockConversationContext;
  freshness: "fresh" | "stale" | "missing";
}

export async function livestockMarketAnswer(
  userText: string,
  history: ChatMessage[] = [],
  previous: LivestockConversationContext | null = null,
): Promise<LivestockMarketResult | null> {
  const [cats, places] = await Promise.all([loadCategories(), loadPlaces()]);
  const parsed = parseLivestockQueryWithContext(userText, cats, places, { previous, history });
  if (!parsed) return null;
  const resolution = await resolveLivestockQuote(parsed);
  return {
    context: buildLivestockContext(resolution),
    query: parsed,
    conversationContext: livestockConversationContext(parsed),
    freshness: !resolution.quote ? "missing" : resolution.stale ? "stale" : "fresh",
  };
}
