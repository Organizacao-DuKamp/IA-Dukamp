// Motor de resolução de cotações pecuárias.
// Cascata obrigatória: cidade → praça vinculada → região → estado → nacional.
// Nunca inventa valores: sem linha no banco, devolve `null` com selo vermelho.

import { marketDb } from "./market.server";
import {
  daysBetween,
  distanceKm,
  fmtDate,
  fmtMoney,
  parseLivestockQuery,
  type LivestockCategoryRow,
  type LivestockPlaceRow,
  type LivestockQuery,
} from "./livestock-parse";

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
): Promise<CotacaoPecuaria | null> {
  let q = marketDb()
    .from("cotacoes_pecuarias")
    .select("*")
    .eq("categoria", categoria)
    .eq("unidade", unidade)
    .order("data_cotacao", { ascending: false })
    .limit(1);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) return null;
  return (data?.[0] as CotacaoPecuaria) ?? null;
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
export async function resolveLivestockQuote(query: LivestockQuery): Promise<LivestockResolution> {
  const { category, place, uf, unit } = query;
  const maxAge = category.max_idade_dias ?? 10;
  const places = await loadPlaces();

  const build = (
    quote: CotacaoPecuaria | null,
    seal: SealLevel,
    usedPlace: string | null,
    dist: number | null,
    note: string | null,
  ): LivestockResolution => {
    const age = quote ? daysBetween(quote.data_cotacao) : null;
    const stale = age != null && age > maxAge;
    const finalSeal: SealLevel = !quote ? "indisponivel" : seal;
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

  // 1) cidade exata
  if (place) {
    const local = await latest({ cidade_slug: place.slug }, category.slug, unit);
    if (local) return build(local, "local", place.municipio, 0, null);

    // 2) praças vinculadas, na ordem definida
    const links = await loadLinks(place.slug);
    for (const link of links) {
      const target = places.find((p) => p.slug === link.praca_slug);
      const q = await latest({ cidade_slug: link.praca_slug }, category.slug, unit);
      if (q) {
        const dist =
          link.distancia_km ??
          (place.lat && place.lon && target?.lat && target?.lon
            ? distanceKm({ lat: place.lat, lon: place.lon }, { lat: target.lat, lon: target.lon })
            : null);
        return build(
          q,
          "regional",
          target?.municipio ?? link.praca_slug,
          dist,
          `Não há cotação registrada para ${place.municipio}/${place.uf}. Usada a praça pecuária de referência mais próxima.`,
        );
      }
    }

    // 2b) fallback geográfico: praça pecuária mais próxima por distância
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
        const q = await latest({ cidade_slug: p.slug }, category.slug, unit);
        if (q)
          return build(
            q,
            "regional",
            p.municipio,
            d,
            `Não há cotação registrada para ${place.municipio}/${place.uf}. Usada a praça pecuária mais próxima com dado publicado.`,
          );
      }
    }

    // 3) mesma região
    if (place.regiao) {
      const q = await latest({ regiao: place.regiao }, category.slug, unit);
      if (q)
        return build(
          q,
          "regional",
          place.regiao,
          null,
          `Sem cotação municipal para ${place.municipio}/${place.uf}. Usada a referência da região ${place.regiao}.`,
        );
    }
  }

  // 4) indicador estadual
  const state = uf ?? place?.uf ?? null;
  if (state) {
    const q = await latest({ estado: state, abrangencia: "estadual" }, category.slug, unit);
    if (q)
      return build(
        q,
        "estadual",
        state,
        null,
        place
          ? `Sem cotação municipal ou regional para ${place.municipio}/${place.uf}. Usado o indicador estadual de ${state}.`
          : `Usado o indicador estadual de ${state}.`,
      );
    const anyState = await latest({ estado: state }, category.slug, unit);
    if (anyState)
      return build(
        anyState,
        "estadual",
        anyState.cidade ?? state,
        null,
        `Sem cotação para a praça pedida. Usada a cotação disponível em ${state}.`,
      );
  }

  // 5) indicador nacional (só quando o usuário não pediu praça específica)
  if (!place) {
    const nac = await latest({ abrangencia: "nacional" }, category.slug, unit);
    if (nac) return build(nac, "estadual", "Brasil", null, "Indicador nacional.");
  }

  return build(null, "indisponivel", null, null, null);
}

/* ------------------------------------------------------------------ */
/* Bloco de contexto entregue ao modelo                                 */
/* ------------------------------------------------------------------ */

export function buildLivestockContext(r: LivestockResolution): string {
  const { category, place, uf, unit } = r.query;
  const askedLabel = place ? `${place.municipio}/${place.uf}` : uf ? uf : "praça não informada";

  if (!r.quote) {
    return [
      "COTAÇÃO PECUÁRIA — RESULTADO DA BASE OFICIAL",
      `SELO: ${r.sealLabel}`,
      `Categoria: ${category.nome} · Unidade pedida: ${unit} · Local pedido: ${askedLabel}`,
      "SEM COTAÇÃO REGISTRADA na base para essa categoria/praça.",
      'INSTRUÇÃO OBRIGATÓRIA (ordem exata): 1) BUSQUE AGORA na web, em fontes oficiais de mercado (CEPEA/ESALQ, Scot Consultoria, B3, Notícias Agrícolas, Canal Rural, IEA, Conab, sindicatos e associações rurais), a cotação mais recente dessa categoria para a cidade/praça pedida ou para a praça publicada mais próxima. 2) Se encontrar, apresente o valor com selo 🟡 (referência de mercado externa) trazendo obrigatoriamente preço + unidade, praça, data de referência e fonte, e diga com naturalidade que o número veio de publicação de mercado e não da base própria — se for de outra praça, avise qual é e lembre que frete, escala e negociação mudam o preço local. 2b) BUSCA APROFUNDADA OBRIGATÓRIA: antes de declarar que não encontrou, tente em sequência (a) a cidade pedida, (b) praças pecuárias vizinhas, (c) o indicador estadual, (d) o indicador nacional (CEPEA/B3). 2c) ENQUADRAMENTO: se encontrar QUALQUER referência confiável, NUNCA comece com "não encontrei"; comece pelo valor com selo 🟡 e só depois explique a origem e as ressalvas. 3) Só se NENHUMA das quatro tentativas retornar algo confiável, diga com franqueza que não há cotação disponível agora e ofereça acompanhar a fonte oficial ou o time comercial DuKamp. NUNCA invente, estime ou arredonde um valor de memória.',
    ].join("\n");
  }

  const q = r.quote;
  const faixa =
    q.preco_minimo != null && q.preco_maximo != null && q.preco_minimo !== q.preco_maximo
      ? `${fmtMoney(q.preco_minimo)} a ${fmtMoney(q.preco_maximo)}`
      : null;

  const lines = [
    "COTAÇÃO PECUÁRIA — RESULTADO DA BASE OFICIAL",
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
    r.stale
      ? `ATENÇÃO — DADO DESATUALIZADO: essa cotação tem ${r.ageDays} dias e ultrapassa a validade de ${category.max_idade_dias} dias da categoria. Apresente-a explicitamente como REFERÊNCIA ANTIGA, nunca como preço de hoje.`
      : null,
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

export async function livestockMarketAnswer(userText: string): Promise<string | null> {
  const [cats, places] = await Promise.all([loadCategories(), loadPlaces()]);
  const parsed = parseLivestockQuery(userText, cats, places);
  if (!parsed) return null;
  const resolution = await resolveLivestockQuote(parsed);
  return buildLivestockContext(resolution);
}
