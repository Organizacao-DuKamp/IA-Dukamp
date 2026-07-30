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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      .object({ slug: z.string().max(80).optional(), limit: z.number().int().min(1).max(200).default(60) })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .inputValidator((d: unknown) => z.object({ quotes: z.array(manualQuote).min(1).max(200) }).parse(d))
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
