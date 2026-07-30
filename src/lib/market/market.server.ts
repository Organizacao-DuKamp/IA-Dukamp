// Leitura e análise de cotações estruturadas (`market_quotes`).
// Regra de ouro: nenhuma cotação é apresentada sem DATA, UNIDADE, PRAÇA e FONTE.

import { createClient } from "@supabase/supabase-js";
import type { MarketQuote, QuoteAnalytics } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
let _db: any;

/** Cliente de leitura: usa service role quando existe; senão a chave pública
 * (as tabelas de mercado são de leitura pública por RLS). */
export function marketDb(): any {
  if (_db) return _db;
  const url =
    process.env.SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase indisponível para consulta de mercado.");
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: any, init: any = {}) => {
        const headers = new Headers(init.headers);
        if (key.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  return _db;
}

export function slugifyProduct(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ------------------------------------------------------------------ */
/* Reconhecimento do produto/indicador citado na pergunta               */
/* ------------------------------------------------------------------ */

export interface MarketTarget {
  slug: string;
  label: string;
  category: string;
}

const TARGETS: Array<MarketTarget & { patterns: RegExp }> = [
  { slug: "boi-gordo", label: "Boi gordo", category: "bovinos", patterns: /\b(boi\s+gordo|arroba\s+do\s+boi|arroba\s+de\s+boi|indicador\s+do\s+boi|@\s*do\s*boi)\b/i },
  { slug: "vaca-gorda", label: "Vaca gorda", category: "bovinos", patterns: /\bvaca\s+gorda\b/i },
  { slug: "bezerro", label: "Bezerro", category: "bovinos", patterns: /\b(bezerro|bezerra|reposi[cç][aã]o)\b/i },
  { slug: "milho", label: "Milho", category: "graos", patterns: /\bmilho\b/i },
  { slug: "soja", label: "Soja", category: "graos", patterns: /\b(soja|farelo\s+de\s+soja)\b/i },
  { slug: "leite", label: "Leite ao produtor", category: "leite", patterns: /\bleite\b/i },
  { slug: "frango", label: "Frango", category: "aves", patterns: /\b(frango|ave\s+viva)\b/i },
  { slug: "suino", label: "Suíno vivo", category: "suinos", patterns: /\b(su[ií]no|porco)\b/i },
  { slug: "ovos", label: "Ovos", category: "aves", patterns: /\bovos?\b/i },
  { slug: "ovinos", label: "Ovinos", category: "ovinos", patterns: /\b(ovino|cordeiro|carneiro)\b/i },
  { slug: "tilapia", label: "Tilápia", category: "pescado", patterns: /\btil[aá]pia\b/i },
  { slug: "dolar", label: "Dólar (PTAX)", category: "cambio", patterns: /\b(d[oó]lar|ptax|c[aâ]mbio|usd)\b/i },
  { slug: "diesel", label: "Diesel", category: "combustivel", patterns: /\b(diesel|[oó]leo\s+diesel|combust[ií]vel)\b/i },
  { slug: "boi-gordo-futuro", label: "Boi gordo futuro (B3)", category: "futuros", patterns: /\b(bgi|boi\s+futuro|futuro\s+do\s+boi|ifboi)\b/i },
  { slug: "milho-futuro", label: "Milho futuro (B3)", category: "futuros", patterns: /\b(ccm|milho\s+futuro|futuro\s+do\s+milho|ifmilho)\b/i },
];

/** Pergunta é sobre cotação/preço de mercado? */
export const MARKET_INTENT_RE =
  /\b(cota[cç][aã]o|cota[cç][oõ]es|pre[cç]o\s+d[oa]\s+(boi|bezerro|milho|soja|leite|arroba|frango|su[ií]no|ovos|diesel)|arroba|indicador\s+cepea|cepea|b3|mercado\s+futuro|escala\s+de\s+abate|d[oó]lar|ptax|quanto\s+(est[aá]|t[aá])\s+(a\s+arroba|o\s+boi|o\s+milho|a\s+soja|o\s+leite|o\s+d[oó]lar)|fechamento\s+do\s+mercado)\b/i;

export function detectMarketTargets(text: string): MarketTarget[] {
  const found: MarketTarget[] = [];
  for (const t of TARGETS) {
    if (t.patterns.test(text)) found.push({ slug: t.slug, label: t.label, category: t.category });
  }
  return found;
}

const UF_RE = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;
export function detectState(text: string): string | null {
  const m = text.toUpperCase().match(UF_RE);
  if (m) return m[1];
  const map: Record<string, string> = {
    "são paulo": "SP", "sao paulo": "SP", "mato grosso do sul": "MS", "mato grosso": "MT",
    "minas gerais": "MG", "goiás": "GO", "goias": "GO", "paraná": "PR", "parana": "PR",
    "rio grande do sul": "RS", "santa catarina": "SC", "bahia": "BA", "pará": "PA", "para": "PA",
    "rondônia": "RO", "rondonia": "RO", "tocantins": "TO",
  };
  const low = text.toLowerCase();
  for (const [k, v] of Object.entries(map)) if (low.includes(k)) return v;
  return null;
}

/* ------------------------------------------------------------------ */
/* Cidades / praças e proximidade                                       */
/* ------------------------------------------------------------------ */

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Cidades/praças frequentes em consultas de pecuária e grãos, com UF e
 * coordenadas aproximadas (para escolher a praça mais próxima). */
const CITIES: Array<{ name: string; uf: string; lat: number; lon: number }> = [
  { name: "aracatuba", uf: "SP", lat: -21.21, lon: -50.44 },
  { name: "sao jose do rio preto", uf: "SP", lat: -20.81, lon: -49.38 },
  { name: "rio preto", uf: "SP", lat: -20.81, lon: -49.38 },
  { name: "monte aprazivel", uf: "SP", lat: -20.77, lon: -49.71 },
  { name: "votuporanga", uf: "SP", lat: -20.42, lon: -49.97 },
  { name: "andradina", uf: "SP", lat: -20.9, lon: -51.38 },
  { name: "birigui", uf: "SP", lat: -21.29, lon: -50.34 },
  { name: "presidente prudente", uf: "SP", lat: -22.13, lon: -51.39 },
  { name: "marilia", uf: "SP", lat: -22.21, lon: -49.95 },
  { name: "bauru", uf: "SP", lat: -22.31, lon: -49.06 },
  { name: "barretos", uf: "SP", lat: -20.56, lon: -48.57 },
  { name: "sao paulo", uf: "SP", lat: -23.55, lon: -46.63 },
  { name: "campinas", uf: "SP", lat: -22.9, lon: -47.06 },
  { name: "ribeirao preto", uf: "SP", lat: -21.17, lon: -47.81 },
  { name: "araraquara", uf: "SP", lat: -21.79, lon: -48.18 },
  { name: "presidente epitacio", uf: "SP", lat: -21.76, lon: -52.11 },
  { name: "tres lagoas", uf: "MS", lat: -20.75, lon: -51.68 },
  { name: "campo grande", uf: "MS", lat: -20.44, lon: -54.65 },
  { name: "dourados", uf: "MS", lat: -22.22, lon: -54.81 },
  { name: "cuiaba", uf: "MT", lat: -15.6, lon: -56.1 },
  { name: "rondonopolis", uf: "MT", lat: -16.47, lon: -54.64 },
  { name: "sorriso", uf: "MT", lat: -12.55, lon: -55.72 },
  { name: "sinop", uf: "MT", lat: -11.86, lon: -55.5 },
  { name: "goiania", uf: "GO", lat: -16.69, lon: -49.26 },
  { name: "rio verde", uf: "GO", lat: -17.79, lon: -50.93 },
  { name: "uberlandia", uf: "MG", lat: -18.91, lon: -48.27 },
  { name: "uberaba", uf: "MG", lat: -19.75, lon: -47.93 },
  { name: "belo horizonte", uf: "MG", lat: -19.92, lon: -43.94 },
  { name: "londrina", uf: "PR", lat: -23.31, lon: -51.16 },
  { name: "maringa", uf: "PR", lat: -23.42, lon: -51.94 },
  { name: "cascavel", uf: "PR", lat: -24.96, lon: -53.46 },
  { name: "curitiba", uf: "PR", lat: -25.43, lon: -49.27 },
  { name: "passo fundo", uf: "RS", lat: -28.26, lon: -52.41 },
  { name: "porto alegre", uf: "RS", lat: -30.03, lon: -51.23 },
  { name: "chapeco", uf: "SC", lat: -27.1, lon: -52.62 },
  { name: "barreiras", uf: "BA", lat: -12.15, lon: -44.99 },
  { name: "palmas", uf: "TO", lat: -10.18, lon: -48.33 },
  { name: "maraba", uf: "PA", lat: -5.37, lon: -49.12 },
  { name: "porto velho", uf: "RO", lat: -8.76, lon: -63.9 },
  { name: "paranagua", uf: "PR", lat: -25.52, lon: -48.51 },
  { name: "santos", uf: "SP", lat: -23.96, lon: -46.33 },
];

export interface GeoRef {
  name: string;
  uf: string;
  lat: number;
  lon: number;
}

/** Detecta a cidade/praça citada na pergunta (quando conhecida). */
export function detectCity(text: string): GeoRef | null {
  const low = norm(text);
  let best: GeoRef | null = null;
  for (const c of CITIES) {
    if (low.includes(c.name) && (!best || c.name.length > best.name.length)) best = c;
  }
  return best;
}

function distanceKm(a: GeoRef, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Localiza a geo-referência de uma praça vinda do banco (locality/state). */
function geoOfQuote(q: MarketQuote): GeoRef | null {
  const loc = norm(q.locality ?? "");
  for (const c of CITIES) if (loc.includes(c.name)) return c;
  return null;
}

export interface NearestResult {
  series: MarketQuote[];
  /** Nota explicando a substituição de praça, quando houver. */
  note: string | null;
}

/**
 * Busca a série da praça pedida; se não existir, cai para a praça mais próxima
 * (mesma UF primeiro, depois menor distância) e devolve a nota da substituição.
 */
export async function getSeriesNearest(
  slug: string,
  askedCity: GeoRef | null,
  askedState: string | null,
): Promise<NearestResult> {
  const state = askedState ?? askedCity?.uf ?? null;

  // 1) praça exata pedida
  if (askedCity) {
    const all = await getSeries(slug, {}).catch(() => []);
    const exact = all.filter((q) => norm(q.locality ?? "").includes(askedCity.name));
    if (exact.length) return { series: exact, note: null };

    // 2) mesma UF
    const sameUf = all.filter((q) => q.state === askedCity.uf);
    const pickFrom = (cands: MarketQuote[]): MarketQuote[] => {
      const byLoc = new Map<string, MarketQuote[]>();
      for (const q of cands) {
        const k = `${q.locality}|${q.state ?? ""}`;
        byLoc.set(k, [...(byLoc.get(k) ?? []), q]);
      }
      let bestKey: string | null = null;
      let bestDist = Infinity;
      for (const [k, list] of byLoc) {
        const g = geoOfQuote(list[0]);
        const d = g ? distanceKm(askedCity, g) : 1500;
        if (d < bestDist) { bestDist = d; bestKey = k; }
      }
      return bestKey ? byLoc.get(bestKey)! : [];
    };

    const chosen = sameUf.length ? pickFrom(sameUf) : pickFrom(all);
    if (chosen.length) {
      const g = geoOfQuote(chosen[0]);
      const dist = g ? distanceKm(askedCity, g) : null;
      const cityLabel = askedCity.name.replace(/\b\w/g, (m) => m.toUpperCase());
      return {
        series: chosen,
        note:
          `PRAÇA SUBSTITUÍDA — não há cotação registrada para ${cityLabel}/${askedCity.uf}. ` +
          `Os números abaixo são da praça mais próxima com dado publicado: ${chosen[0].locality}` +
          `${chosen[0].state ? `/${chosen[0].state}` : ""}` +
          `${dist != null ? ` (cerca de ${dist} km de ${cityLabel})` : ""}. ` +
          `INSTRUÇÃO: avise o usuário, de forma natural, que o valor é da praça vizinha e não da cidade pedida, e lembre que frete e negociação alteram o preço local.`,
      };
    }
  }

  // 3) sem cidade conhecida: UF e depois nacional
  if (state) {
    const byState = await getSeries(slug, { state }).catch(() => []);
    if (byState.length) return { series: byState, note: null };
    const all = await getSeries(slug, {}).catch(() => []);
    if (all.length) {
      return {
        series: all,
        note:
          `PRAÇA SUBSTITUÍDA — não há cotação registrada para ${state}. ` +
          `Os números abaixo são de ${all[0].locality}${all[0].state ? `/${all[0].state}` : ""}. ` +
          `INSTRUÇÃO: avise que a referência é de outra praça e que o preço local varia com frete e negociação.`,
      };
    }
    return { series: [], note: null };
  }

  return { series: await getSeries(slug, {}).catch(() => []), note: null };
}

/* ------------------------------------------------------------------ */
/* Consultas                                                            */
/* ------------------------------------------------------------------ */

export async function getSeries(
  slug: string,
  opts: { state?: string | null; quoteType?: string | null; days?: number } = {},
): Promise<MarketQuote[]> {
  const days = opts.days ?? 400;
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  let q = marketDb()
    .from("market_quotes")
    .select("*")
    .eq("product_slug", slug)
    .gte("reference_date", since)
    .order("reference_date", { ascending: false })
    .limit(600);
  if (opts.state) q = q.eq("state", opts.state);
  if (opts.quoteType) q = q.eq("quote_type", opts.quoteType);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketQuote[];
}

export async function getLatestQuote(
  slug: string,
  opts: { state?: string | null; quoteType?: string | null } = {},
): Promise<MarketQuote | null> {
  const series = await getSeries(slug, { ...opts, days: 120 });
  return series[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Cálculos (fase 3 — inteligência de mercado)                          */
/* ------------------------------------------------------------------ */

function pct(now: number, before: number): number | null {
  if (!before) return null;
  return Number((((now - before) / before) * 100).toFixed(2));
}

function nearest(series: MarketQuote[], daysBack: number): MarketQuote | null {
  if (series.length === 0) return null;
  const target = new Date(series[0].reference_date).getTime() - daysBack * 86400_000;
  let best: MarketQuote | null = null;
  let bestDiff = Infinity;
  for (const q of series.slice(1)) {
    const diff = Math.abs(new Date(q.reference_date).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = q; }
  }
  // tolerância: metade da janela
  if (best && bestDiff > (daysBack * 86400_000) / 2 + 3 * 86400_000) return null;
  return best;
}

function movingAverage(series: MarketQuote[], days: number): number | null {
  if (series.length === 0) return null;
  const cutoff = new Date(series[0].reference_date).getTime() - days * 86400_000;
  const vals = series
    .filter((q) => new Date(q.reference_date).getTime() >= cutoff)
    .map((q) => Number(q.price));
  if (vals.length < 2) return null;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
}

export function analyze(series: MarketQuote[]): QuoteAnalytics | null {
  if (series.length === 0) return null;
  const last = series[0];
  const price = Number(last.price);
  const d1 = nearest(series, 1);
  const d7 = nearest(series, 7);
  const d30 = nearest(series, 30);
  const d365 = nearest(series, 365);
  const prices = series.map((q) => ({ price: Number(q.price), date: q.reference_date }));
  const max = prices.reduce((a, b) => (b.price > a.price ? b : a), prices[0]);
  const min = prices.reduce((a, b) => (b.price < a.price ? b : a), prices[0]);
  return {
    last,
    varDaily: last.var_daily != null ? Number(last.var_daily) : d1 ? pct(price, Number(d1.price)) : null,
    varWeekly: last.var_weekly != null ? Number(last.var_weekly) : d7 ? pct(price, Number(d7.price)) : null,
    varMonthly: last.var_monthly != null ? Number(last.var_monthly) : d30 ? pct(price, Number(d30.price)) : null,
    varYearly: d365 ? pct(price, Number(d365.price)) : null,
    ma7: movingAverage(series, 7),
    ma30: movingAverage(series, 30),
    ma90: movingAverage(series, 90),
    max,
    min,
    samples: series.length,
  };
}

/** Relações clássicas: boi/bezerro, arroba/milho, leite/milho. */
export async function relations(state?: string | null): Promise<string[]> {
  const out: string[] = [];
  const [boi, bezerro, milho, leite] = await Promise.all([
    getLatestQuote("boi-gordo", { state }).catch(() => null),
    getLatestQuote("bezerro", { state }).catch(() => null),
    getLatestQuote("milho", { state }).catch(() => null),
    getLatestQuote("leite", { state }).catch(() => null),
  ]);
  if (boi && bezerro) {
    const r = Number(bezerro.price) / Number(boi.price);
    out.push(`CÁLCULO — relação bezerro/boi gordo: ${r.toFixed(2)} arrobas de boi para comprar 1 bezerro (bezerro ${fmtMoney(bezerro.price)}/${bezerro.unit} em ${bezerro.locality}, boi ${fmtMoney(boi.price)}/${boi.unit} em ${boi.locality}).`);
  }
  if (boi && milho) {
    const r = Number(boi.price) / Number(milho.price);
    out.push(`CÁLCULO — relação arroba/milho: ${r.toFixed(2)} sacas de milho por arroba de boi.`);
  }
  if (leite && milho) {
    const r = Number(milho.price) / Number(leite.price);
    out.push(`CÁLCULO — relação leite/milho: são necessários ${r.toFixed(1)} litros de leite para comprar 1 saca de milho.`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Formatação                                                           */
/* ------------------------------------------------------------------ */

export function fmtMoney(v: number | string): string {
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string): string {
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

function fmtVar(v: number | null): string {
  if (v == null) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(2)}%`;
}

/** Bloco textual completo de uma cotação, com os campos obrigatórios. */
export function quoteBlock(a: QuoteAnalytics): string {
  const q = a.last;
  const lines: string[] = [];
  lines.push(
    `FATO — ${q.product} (${q.quote_type}): ${fmtMoney(q.price)}/${q.unit} · ${q.locality}${q.state ? `/${q.state}` : ""}${q.payment_condition ? ` · ${q.payment_condition}` : ""} · referência ${fmtDate(q.reference_date)}${q.source_updated_at ? ` (atualizado às ${new Date(q.source_updated_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})` : ""} · fonte: ${q.source_name}.`,
  );
  const vars = [
    a.varDaily != null ? `dia ${fmtVar(a.varDaily)}` : null,
    a.varWeekly != null ? `semana ${fmtVar(a.varWeekly)}` : null,
    a.varMonthly != null ? `mês ${fmtVar(a.varMonthly)}` : null,
    a.varYearly != null ? `12 meses ${fmtVar(a.varYearly)}` : null,
  ].filter(Boolean);
  if (vars.length) lines.push(`CÁLCULO — variação: ${vars.join(" · ")}.`);
  const mas = [
    a.ma7 != null ? `MM7 ${fmtMoney(a.ma7)}` : null,
    a.ma30 != null ? `MM30 ${fmtMoney(a.ma30)}` : null,
    a.ma90 != null ? `MM90 ${fmtMoney(a.ma90)}` : null,
  ].filter(Boolean);
  if (mas.length) lines.push(`CÁLCULO — médias móveis: ${mas.join(" · ")}.`);
  if (a.max && a.min && a.samples > 3) {
    lines.push(
      `CÁLCULO — no período analisado (${a.samples} registros): máxima ${fmtMoney(a.max.price)} em ${fmtDate(a.max.date)}, mínima ${fmtMoney(a.min.price)} em ${fmtDate(a.min.date)}.`,
    );
  }
  if (a.ma7 != null && a.ma30 != null) {
    const dir = a.ma7 > a.ma30 ? "de alta" : a.ma7 < a.ma30 ? "de baixa" : "lateral";
    const gap = Math.abs(((a.ma7 - a.ma30) / a.ma30) * 100);
    const conf = gap > 3 ? "confiança moderada" : "confiança baixa";
    lines.push(`TENDÊNCIA — curto prazo ${dir} (MM7 vs MM30, ${conf}). Não é garantia de preço futuro.`);
  }
  lines.push(`FONTE: ${q.source_name} — ${q.source_url} (coleta em ${fmtDate((q.collected_at ?? q.reference_date).slice(0, 10))}).`);
  return lines.join("\n");
}

/** Diferença físico x futuro (basis) quando as duas séries existem. */
export async function basisBlock(slug: string, state?: string | null): Promise<string | null> {
  const futureSlug = slug === "boi-gordo" ? "boi-gordo-futuro" : slug === "milho" ? "milho-futuro" : null;
  if (!futureSlug) return null;
  const [fis, fut] = await Promise.all([
    getLatestQuote(slug, { state }).catch(() => null),
    getLatestQuote(futureSlug).catch(() => null),
  ]);
  if (!fis || !fut) return null;
  const diff = Number(fut.price) - Number(fis.price);
  const p = pct(Number(fut.price), Number(fis.price));
  return `CÁLCULO — físico x futuro: físico ${fmtMoney(fis.price)}/${fis.unit} (${fis.locality}, ${fmtDate(fis.reference_date)}, ${fis.source_name}) vs futuro ${fmtMoney(fut.price)}/${fut.unit} (${fut.locality}, ${fmtDate(fut.reference_date)}, ${fut.source_name}) → diferença de ${fmtMoney(diff)} (${p != null ? fmtVar(p) : "—"}).`;
}

/** Fontes oficiais indicadas quando ainda não há dado registrado. */
export async function suggestedSources(category: string): Promise<Array<{ name: string; org: string; url: string }>> {
  const map: Record<string, string[]> = {
    cambio: ["cambio"],
    combustivel: ["diesel"],
    futuros: ["futuros"],
    macroeconomia: ["cambio"],
  };
  const cats = map[category] ?? ["cotacoes"];
  const { data } = await marketDb()
    .from("market_sources")
    .select("name, org, url")
    .eq("kind", "dynamic")
    .eq("active", true)
    .in("category", cats)
    .order("phase", { ascending: true })
    .limit(3);
  return (data ?? []) as any;
}
