// Ingestão de cotações pecuárias (`cotacoes_pecuarias`).
// Toda gravação exige categoria válida, praça, unidade, data e fonte.

import { z } from "zod";
import { loadCategories, loadPlaces } from "./livestock.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const livestockQuoteSchema = z
  .object({
    categoria: z.string().min(2).max(60),
    cidade: z.string().max(120).nullable().optional(),
    cidade_slug: z.string().max(120).optional(),
    estado: z.string().max(2).optional(),
    regiao: z.string().max(120).optional(),
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
  })
  .refine((v) => v.abrangencia !== "municipal" || !!(v.cidade || v.cidade_slug), {
    message: "cotação municipal exige cidade",
  });

export type LivestockQuoteInput = z.input<typeof livestockQuoteSchema>;

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function upsertLivestockQuotes(
  inputs: LivestockQuoteInput[],
): Promise<{ saved: number; skipped: string[] }> {
  const db = await admin();
  const [cats, places] = await Promise.all([loadCategories(), loadPlaces()]);
  const skipped: string[] = [];
  const rows: any[] = [];

  for (const raw of inputs) {
    const parsed = livestockQuoteSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push(`${(raw as any)?.categoria ?? "?"}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const q = parsed.data;
    const cat = cats.find((c) => c.slug === q.categoria);
    if (!cat) {
      skipped.push(`categoria desconhecida: ${q.categoria}`);
      continue;
    }
    const slug = q.cidade_slug ?? (q.cidade ? slugify(q.cidade) : "");
    const place = places.find((p) => p.slug === slug);
    if (q.abrangencia === "municipal" && !place) {
      skipped.push(`praça não cadastrada: ${q.cidade ?? slug}`);
      continue;
    }
    if (q.preco_minimo != null && q.preco_maximo != null && q.preco_minimo > q.preco_maximo) {
      skipped.push(`${q.categoria}: preço mínimo maior que o máximo`);
      continue;
    }
    rows.push({
      categoria: cat.slug,
      cidade: q.cidade ?? place?.municipio ?? null,
      cidade_slug: slug,
      estado: q.estado ?? place?.uf ?? "",
      regiao: q.regiao ?? place?.regiao ?? "",
      abrangencia: q.abrangencia,
      preco_minimo: q.preco_minimo ?? null,
      preco_maximo: q.preco_maximo ?? null,
      preco_referencia: q.preco_referencia,
      unidade: q.unidade,
      condicao_pagamento: q.condicao_pagamento ?? null,
      data_cotacao: q.data_cotacao,
      fonte: q.fonte,
      url_fonte: q.url_fonte ?? null,
      nivel_confiabilidade: q.nivel_confiabilidade,
      observacao: q.observacao ?? null,
      data_coleta: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await db.from("cotacoes_pecuarias").upsert(chunk, {
      onConflict: "categoria,abrangencia,cidade_slug,regiao,estado,unidade,data_cotacao,fonte",
    });
    if (error) throw new Error(error.message);
    saved += chunk.length;
  }
  return { saved, skipped };
}

/** Panorama de frescor por categoria — usado no painel administrativo. */
export async function livestockFreshness(): Promise<
  Array<{
    categoria: string;
    nome: string;
    registros: number;
    ultima_data: string | null;
    dias: number | null;
    validade: number;
    vencido: boolean;
  }>
> {
  const db = await admin();
  const cats = await loadCategories();
  const out = [];
  for (const c of cats) {
    const { data, count } = await db
      .from("cotacoes_pecuarias")
      .select("data_cotacao", { count: "exact" })
      .eq("categoria", c.slug)
      .order("data_cotacao", { ascending: false })
      .limit(1);
    const last = data?.[0]?.data_cotacao ?? null;
    const dias = last
      ? Math.floor((Date.now() - new Date(`${last}T00:00:00Z`).getTime()) / 86_400_000)
      : null;
    out.push({
      categoria: c.slug,
      nome: c.nome,
      registros: count ?? 0,
      ultima_data: last,
      dias,
      validade: c.max_idade_dias,
      vencido: dias == null || dias > c.max_idade_dias,
    });
  }
  return out;
}
