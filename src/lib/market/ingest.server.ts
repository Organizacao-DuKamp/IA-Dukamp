// Ingestão de dados de mercado: catálogo de fontes, gravação de cotações
// e coletores automáticos de APIs abertas.

import { z } from "zod";
import { MARKET_SOURCES } from "./sources";
import { marketDb, slugifyProduct } from "./market.server";
import type { MarketQuote } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/* ------------------------------------------------------------------ */
/* Catálogo de fontes                                                   */
/* ------------------------------------------------------------------ */

export async function syncMarketSources(): Promise<{ total: number }> {
  const db = await admin();
  const rows = MARKET_SOURCES.map((s) => ({
    code: s.code,
    name: s.name,
    org: s.org,
    category: s.category,
    url: s.url,
    kind: s.kind,
    phase: s.phase,
    region: s.region,
    ingest_method: s.ingestMethod,
    license_note: s.licenseNote,
    active: true,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await db
      .from("market_sources")
      .upsert(rows.slice(i, i + 50), { onConflict: "code" });
    if (error) throw new Error(error.message);
  }
  return { total: rows.length };
}

/* ------------------------------------------------------------------ */
/* Gravação de cotações                                                 */
/* ------------------------------------------------------------------ */

export const quoteInputSchema = z.object({
  product: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  price: z.number().finite().positive(),
  unit: z.string().min(1).max(40),
  locality: z.string().min(2).max(120),
  state: z.string().max(40).nullable().optional(),
  payment_condition: z.string().max(60).nullable().optional(),
  quote_type: z.string().max(40).default("indicador"),
  reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_updated_at: z.string().nullable().optional(),
  source_code: z.string().min(2).max(60),
  source_url: z.string().url().max(500).optional(),
  var_daily: z.number().finite().nullable().optional(),
  var_weekly: z.number().finite().nullable().optional(),
  var_monthly: z.number().finite().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  raw: z.any().optional(),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

function pct(now: number, before: number): number | null {
  if (!before) return null;
  return Number((((now - before) / before) * 100).toFixed(4));
}

/** Grava/atualiza cotações preenchendo fonte, slug e variações calculadas. */
export async function upsertQuotes(inputs: QuoteInput[]): Promise<{ saved: number; skipped: string[] }> {
  const db = await admin();
  const skipped: string[] = [];
  const rows: Partial<MarketQuote>[] = [];

  for (const raw of inputs) {
    const parsed = quoteInputSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push(`${(raw as any)?.product ?? "?"}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const q = parsed.data;
    const src = MARKET_SOURCES.find((s) => s.code === q.source_code);
    if (!src && !q.source_url) {
      skipped.push(`${q.product}: fonte "${q.source_code}" desconhecida e sem URL.`);
      continue;
    }
    const slug = slugifyProduct(q.product);

    // Variações calculadas a partir do histórico já gravado
    let vd = q.var_daily ?? null;
    let vw = q.var_weekly ?? null;
    let vm = q.var_monthly ?? null;
    if (vd == null || vw == null || vm == null) {
      const { data: hist } = await db
        .from("market_quotes")
        .select("price, reference_date")
        .eq("product_slug", slug)
        .eq("unit", q.unit)
        .eq("locality", q.locality)
        .eq("quote_type", q.quote_type)
        .lt("reference_date", q.reference_date)
        .order("reference_date", { ascending: false })
        .limit(90);
      const list = (hist ?? []) as Array<{ price: number; reference_date: string }>;
      const at = (days: number) => {
        const target = new Date(q.reference_date).getTime() - days * 86400_000;
        let best: { price: number; reference_date: string } | null = null;
        let bd = Infinity;
        for (const h of list) {
          const d = Math.abs(new Date(h.reference_date).getTime() - target);
          if (d < bd) { bd = d; best = h; }
        }
        return best && bd <= (days * 86400_000) / 2 + 3 * 86400_000 ? Number(best.price) : null;
      };
      const p1 = at(1), p7 = at(7), p30 = at(30);
      if (vd == null && p1) vd = pct(q.price, p1);
      if (vw == null && p7) vw = pct(q.price, p7);
      if (vm == null && p30) vm = pct(q.price, p30);
    }

    rows.push({
      product: q.product,
      product_slug: slug,
      category: q.category,
      price: q.price,
      unit: q.unit,
      locality: q.locality,
      state: q.state ?? null,
      payment_condition: q.payment_condition ?? null,
      quote_type: q.quote_type,
      reference_date: q.reference_date,
      source_updated_at: q.source_updated_at ?? null,
      source_code: q.source_code,
      source_name: src?.name ?? q.source_code,
      source_url: q.source_url ?? src?.url ?? "",
      collected_at: new Date().toISOString(),
      var_daily: vd,
      var_weekly: vw,
      var_monthly: vm,
      notes: q.notes ?? null,
      raw: q.raw ?? null,
    });
  }

  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await db.from("market_quotes").upsert(chunk, {
      onConflict: "product_slug,unit,locality,quote_type,reference_date,source_code",
    });
    if (error) throw new Error(error.message);
    saved += chunk.length;
  }
  return { saved, skipped };
}

/* ------------------------------------------------------------------ */
/* Coletores automáticos (APIs públicas e abertas)                      */
/* ------------------------------------------------------------------ */

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Dólar PTAX (Banco Central — API aberta Olinda). */
async function collectPtax(days = 10): Promise<QuoteInput[]> {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400_000);
  const f = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
  const url =
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@i,dataFinalCotacao=@f)` +
    `?@i='${f(start)}'&@f='${f(end)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PTAX ${res.status}`);
  const json: any = await res.json();
  return (json.value ?? []).map((v: any) => ({
    product: "Dólar comercial (PTAX venda)",
    category: "cambio",
    price: Number(v.cotacaoVenda),
    unit: "R$/US$",
    locality: "Brasil",
    state: null,
    quote_type: "cambio",
    reference_date: String(v.dataHoraCotacao).slice(0, 10),
    source_updated_at: new Date(String(v.dataHoraCotacao).replace(" ", "T") + "-03:00").toISOString(),
    source_code: "bcb_ptax",
    notes: "PTAX de venda, fechamento oficial do Banco Central.",
    raw: v,
  }));
}

/** Selic e IPCA (séries abertas do BCB) como indicadores de contexto. */
async function collectBcbSeries(
  serie: number,
  product: string,
  unit: string,
  sourceCode: string,
  lastN = 12,
): Promise<QuoteInput[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${lastN}?formato=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SGS ${serie} ${res.status}`);
  const json: any[] = await res.json();
  return json.map((v) => {
    const [d, m, y] = String(v.data).split("/");
    return {
      product,
      category: "macroeconomia",
      price: Number(String(v.valor).replace(",", ".")),
      unit,
      locality: "Brasil",
      state: null,
      quote_type: "indicador",
      reference_date: `${y}-${m}-${d}`,
      source_code: sourceCode,
      raw: v,
    } as QuoteInput;
  });
}

export interface CollectorResult {
  collector: string;
  saved: number;
  error?: string;
}

/** Executa os coletores automáticos disponíveis (APIs abertas, sem raspagem). */
export async function runCollectors(): Promise<CollectorResult[]> {
  const jobs: Array<{ name: string; run: () => Promise<QuoteInput[]> }> = [
    { name: "BCB PTAX (dólar)", run: () => collectPtax(15) },
    { name: "BCB Selic meta", run: () => collectBcbSeries(432, "Selic meta", "% a.a.", "bcb_selic", 12) },
    { name: "IBGE IPCA (BCB/SGS)", run: () => collectBcbSeries(433, "IPCA mensal", "% a.m.", "bcb_sgs", 12) },
  ];
  const out: CollectorResult[] = [];
  for (const job of jobs) {
    try {
      const quotes = await job.run();
      const { saved } = await upsertQuotes(quotes);
      out.push({ collector: job.name, saved });
    } catch (e) {
      out.push({ collector: job.name, saved: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export { isoDate };
