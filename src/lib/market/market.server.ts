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
  const { data } = await marketDb()
    .from("market_sources")
    .select("name, org, url")
    .eq("kind", "dynamic")
    .eq("active", true)
    .in("category", [category, "cotacoes"])
    .order("phase", { ascending: true })
    .limit(3);
  return (data ?? []) as any;
}
