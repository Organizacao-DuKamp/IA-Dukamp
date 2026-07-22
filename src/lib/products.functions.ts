// Product & review-queue server functions. Admin-gated.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { autoAliases, normalizeName, toSlug } from "./products/normalize";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

// -------- list / read --------
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("official_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProductAliases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("product_aliases")
      .select("id, alias, alias_normalized, origin, created_at")
      .eq("product_id", data.product_id)
      .order("alias", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- update / mutate --------
const UpdateSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    official_name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    species: z.string().nullable().optional(),
    animal_phase: z.string().nullable().optional(),
    package_weight: z.string().nullable().optional(),
    indication: z.string().nullable().optional(),
    consumption: z.string().nullable().optional(),
    usage_instructions: z.string().nullable().optional(),
    composition: z.string().nullable().optional(),
    guarantee_levels: z.string().nullable().optional(),
    active: z.boolean().optional(),
    requires_review: z.boolean().optional(),
    is_duplicate: z.boolean().optional(),
    duplicate_of: z.string().uuid().nullable().optional(),
  }),
});
export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { ...data.patch };
    if (typeof patch.official_name === "string") {
      patch.slug = toSlug(patch.official_name);
    }
    const { error } = await supabaseAdmin.from("products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AliasAddSchema = z.object({
  product_id: z.string().uuid(),
  alias: z.string().min(1).max(200),
});
export const addProductAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AliasAddSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_aliases").insert({
      product_id: data.product_id,
      alias: data.alias.trim(),
      alias_normalized: normalizeName(data.alias),
      origin: "manual",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProductAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_aliases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- review queue --------
export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("product_review_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ResolveSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["aprovado", "rejeitado", "mesclado"]),
  notes: z.string().optional(),
});
export const resolveReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResolveSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("product_review_queue")
      .update({ status: data.status, resolution_notes: data.notes ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- reports --------
export const listImportReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("import_reports")
      .select("id, kind, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getImportReportItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ report_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("import_report_items")
      .select("*")
      .eq("report_id", data.report_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- extraction: read all documents, build product candidates --------
const ExtractSchema = z.object({
  dryRun: z.boolean().default(true),
  publish: z.boolean().default(false),
});
export const extractProductsFromKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parserMod = await import("./products/parser.server");
    const { parseCandidate, mergeCandidates } = parserMod;
    type ProductCandidate = import("./products/parser.server").ProductCandidate;

    const { data: docs, error } = await supabaseAdmin
      .from("knowledge_documents")
      .select("id, title, filename, category, subcategory, source_path, content")
      .not("content", "is", null);
    if (error) throw new Error(error.message);

    const bySlug = new Map<
      string,
      { candidate: ProductCandidate; sources: string[]; divergences: Array<{ field: string; a: string; b: string }> }
    >();
    const skipped: Array<{ file: string; reason: string }> = [];

    for (const doc of docs ?? []) {
      const cand = parseCandidate(doc);
      if (!cand) {
        skipped.push({ file: doc.filename, reason: "não é ficha/descritivo/folder de produto" });
        continue;
      }
      const existing = bySlug.get(cand.slug);
      if (!existing) {
        bySlug.set(cand.slug, { candidate: cand, sources: [doc.id], divergences: [] });
      } else {
        const { merged, divergences } = mergeCandidates(existing.candidate, cand);
        existing.candidate = merged;
        existing.sources.push(doc.id);
        existing.divergences.push(...divergences);
      }
    }

    const summary = {
      total_docs: docs?.length ?? 0,
      products_found: bySlug.size,
      with_divergence: 0,
      with_missing_fields: 0,
      published: 0,
      dry_run: data.dryRun && !data.publish,
    };
    const items: Array<{
      file_name: string | null;
      status: string;
      message: string;
      details: Record<string, unknown>;
    }> = [];

    // Create the report row first so we can attach items.
    const { data: report, error: repErr } = await supabaseAdmin
      .from("import_reports")
      .insert({
        kind: "product_extraction",
        summary,
        triggered_by: context.userId,
      })
      .select("id")
      .single();
    if (repErr || !report) throw new Error(repErr?.message || "Falha ao criar relatório.");
    const reportId = report.id as string;

    for (const [slug, entry] of bySlug) {
      const { candidate, sources, divergences } = entry;
      const requiresReview = divergences.length > 0 || candidate.missing_fields.length > 0;
      if (divergences.length > 0) summary.with_divergence++;
      if (candidate.missing_fields.length > 0) summary.with_missing_fields++;

      items.push({
        file_name: candidate.official_name,
        status: divergences.length > 0 ? "divergence" : requiresReview ? "missing_fields" : "ok",
        message: divergences.length > 0
          ? `${divergences.length} campo(s) com divergência entre fichas`
          : requiresReview
            ? `Campos ausentes: ${candidate.missing_fields.join(", ")}`
            : "Ficha completa",
        details: {
          slug,
          sources,
          divergences,
          missing_fields: candidate.missing_fields,
        },
      });

      if (!data.publish) continue;

      // Upsert product by slug.
      const upsertRow = {
        official_name: candidate.official_name,
        slug,
        description: candidate.description,
        category: candidate.category,
        species: candidate.species,
        animal_phase: candidate.animal_phase,
        package_weight: candidate.package_weight,
        indication: candidate.indication,
        consumption: candidate.consumption,
        usage_instructions: candidate.usage_instructions,
        composition: candidate.composition,
        guarantee_levels: candidate.guarantee_levels,
        active: true,
        requires_review: requiresReview,
        source_document: sources[0],
        source_updated_at: new Date().toISOString(),
      };
      const { data: prodRow, error: upErr } = await supabaseAdmin
        .from("products")
        .upsert(upsertRow, { onConflict: "slug" })
        .select("id")
        .single();
      if (upErr || !prodRow) {
        items.push({
          file_name: candidate.official_name,
          status: "error",
          message: upErr?.message || "Falha ao gravar produto.",
          details: { slug },
        });
        continue;
      }
      summary.published++;

      // Auto aliases (best-effort).
      const aliases = autoAliases(candidate.official_name).map((a) => ({
        product_id: prodRow.id as string,
        alias: a,
        alias_normalized: normalizeName(a),
        origin: "auto",
      }));
      if (aliases.length > 0) {
        await supabaseAdmin
          .from("product_aliases")
          .upsert(aliases, { onConflict: "product_id,alias_normalized", ignoreDuplicates: true });
      }

      // Divergences -> review queue.
      if (divergences.length > 0) {
        await supabaseAdmin.from("product_review_queue").insert({
          product_id: prodRow.id,
          reason: "divergencia",
          details: { divergences, sources },
          status: "pendente",
        });
      } else if (candidate.missing_fields.length > 0) {
        await supabaseAdmin.from("product_review_queue").insert({
          product_id: prodRow.id,
          reason: "campos_ausentes",
          details: { missing_fields: candidate.missing_fields, sources },
          status: "pendente",
        });
      }
    }

    // Insert report items in batches.
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100).map((it) => ({ ...it, report_id: reportId }));
      await supabaseAdmin.from("import_report_items").insert(batch);
    }

    // Update the report summary with final counts.
    await supabaseAdmin.from("import_reports").update({ summary }).eq("id", reportId);

    return { report_id: reportId, ...summary };
  });

// -------- public counts / lookups (safe for chat routing) --------
const CountSchema = z.object({
  species: z.string().optional(),
  category: z.string().optional(),
  active_only: z.boolean().default(true),
});
export const countProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CountSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ??
      (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = process.env.SUPABASE_URL ??
      (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL;
    if (!key || !url) throw new Error("Supabase indisponível.");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    let q = sb.from("products").select("id", { count: "exact", head: true });
    if (data.active_only) q = q.eq("active", true);
    if (data.species) q = q.eq("species", data.species);
    if (data.category) q = q.eq("category", data.category);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

const ListSchema = z.object({
  species: z.string().optional(),
  category: z.string().optional(),
  active_only: z.boolean().default(true),
  limit: z.number().min(1).max(200).default(100),
});
export const listPublicProducts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ??
      (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = process.env.SUPABASE_URL ??
      (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL;
    if (!key || !url) throw new Error("Supabase indisponível.");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    let q = sb
      .from("products")
      .select("id, official_name, species, category, package_weight")
      .order("official_name", { ascending: true })
      .limit(data.limit);
    if (data.active_only) q = q.eq("active", true);
    if (data.species) q = q.eq("species", data.species);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
