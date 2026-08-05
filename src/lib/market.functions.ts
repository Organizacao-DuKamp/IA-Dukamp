// Funções de servidor do módulo de mercado (cotações). Restrito a administradores,
// exceto a leitura pública de cotações usada pela IA e pelo painel.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

/** Registra/atualiza o catálogo oficial das 107 fontes. */
export const syncSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { syncMarketSources } = await import("./market/ingest.server");
    return await syncMarketSources();
  });

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const supabaseAdmin = await getPrivilegedClient(context.supabase as never);
    const { data, error } = await supabaseAdmin
      .from("market_sources")
      .select("*")
      .order("phase", { ascending: true })
      .order("category", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().max(80).optional(),
        limit: z.number().int().min(1).max(200).default(60),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const supabaseAdmin = await getPrivilegedClient(context.supabase as never);
    let q = supabaseAdmin
      .from("market_quotes")
      .select("*")
      .order("reference_date", { ascending: false })
      .limit(data.limit);
    if (data.slug) q = q.eq("product_slug", data.slug);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const manualQuote = z.object({
  product: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  price: z.number().finite().positive(),
  unit: z.string().min(1).max(40),
  locality: z.string().min(2).max(120),
  state: z.string().max(40).nullable().optional(),
  payment_condition: z.string().max(60).nullable().optional(),
  quote_type: z.string().max(40).default("indicador"),
  reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_code: z.string().min(2).max(60),
  source_url: z.string().url().max(500).optional(),
  notes: z.string().max(500).nullable().optional(),
});

/** Lançamento manual de cotações (planilha/observação de campo). */
export const saveQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ quotes: z.array(manualQuote).min(1).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { upsertQuotes } = await import("./market/ingest.server");
    return await upsertQuotes(data.quotes as any);
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const supabaseAdmin = await getPrivilegedClient(context.supabase as never);
    const { error } = await supabaseAdmin.from("market_quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Roda os coletores automáticos das APIs abertas (BCB PTAX/Selic/IPCA). */
export const collectNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runCollectors } = await import("./market/ingest.server");
    return await runCollectors();
  });

/* ---------------- Cotações pecuárias ---------------- */

const livestockQuote = z.object({
  categoria: z.string().min(2).max(60),
  cidade: z.string().max(120).nullable().optional(),
  estado: z.string().max(2).optional(),
  abrangencia: z.enum(["municipal", "regional", "estadual", "nacional"]).default("municipal"),
  preco_minimo: z.number().finite().positive().nullable().optional(),
  preco_maximo: z.number().finite().positive().nullable().optional(),
  preco_referencia: z.number().finite().positive(),
  unidade: z.string().min(1).max(20),
  condicao_pagamento: z.string().max(80).nullable().optional(),
  data_cotacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fonte: z.string().min(2).max(120),
  url_fonte: z.string().url().max(500).nullable().optional(),
  nivel_confiabilidade: z.enum(["alta", "media", "baixa"]).default("alta"),
  observacao: z.string().max(500).nullable().optional(),
});

export const listLivestockCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { loadCategories, loadPlaces } = await import("./market/livestock.server");
    const [categories, places] = await Promise.all([loadCategories(), loadPlaces()]);
    return { categories, places };
  });

export const listLivestockQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        categoria: z.string().max(60).optional(),
        limit: z.number().int().min(1).max(200).default(80),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const supabaseAdmin = await getPrivilegedClient(context.supabase as never);
    let q = supabaseAdmin
      .from("cotacoes_pecuarias")
      .select("*")
      .order("data_cotacao", { ascending: false })
      .limit(data.limit);
    if (data.categoria) q = q.eq("categoria", data.categoria);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveLivestockQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ quotes: z.array(livestockQuote).min(1).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { upsertLivestockQuotes } = await import("./market/livestock-ingest.server");
    return await upsertLivestockQuotes(data.quotes as any);
  });

export const deleteLivestockQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const supabaseAdmin = await getPrivilegedClient(context.supabase as never);
    const { error } = await supabaseAdmin.from("cotacoes_pecuarias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const livestockStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { livestockFreshness } = await import("./market/livestock-ingest.server");
    return await livestockFreshness();
  });
