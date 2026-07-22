// Server functions for knowledge-base admin operations.
// All are gated by `requireSupabaseAuth` + a runtime admin role check
// performed with the CALLER's supabase client (RLS), not the admin client.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// deno-lint-ignore no-explicit-any
async function assertAdmin(ctx: any) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

export const listKnowledgeDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("knowledge_documents")
      .select("id, title, filename, category, subcategory, status, chunk_count, error_message, updated_at")
      .order("category", { ascending: true })
      .order("subcategory", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const knowledgeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [docsQ, chunksQ] = await Promise.all([
      supabaseAdmin.from("knowledge_documents").select("status", { count: "exact", head: false }),
      supabaseAdmin.from("knowledge_chunks").select("id", { count: "exact", head: true }),
    ]);
    const status = { aguardando: 0, processando: 0, concluido: 0, erro: 0, total: 0 };
    for (const row of (docsQ.data ?? []) as { status: keyof typeof status }[]) {
      status[row.status] = (status[row.status] ?? 0) + 1;
      status.total++;
    }
    return { docs: status, chunks: chunksQ.count ?? 0 };
  });

export const registerSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listSeedFiles } = await import("./rag/seed-loader.server");
    const { parseSourcePath } = await import("./rag/paths");

    const files = listSeedFiles();
    const rows = files.map((f) => {
      const p = parseSourcePath(f.absPath);
      return {
        title: p.title,
        filename: p.filename,
        source_path: p.sourcePath,
        category: p.category,
        subcategory: p.subcategory,
        status: "aguardando",
        chunk_count: 0,
        error_message: null,
      };
    });

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from("knowledge_documents")
        .upsert(batch, { onConflict: "source_path", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    }
    return { total: files.length, inserted: rows.length };
  });

export const processNextPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listSeedFiles } = await import("./rag/seed-loader.server");
    const { parseSourcePath } = await import("./rag/paths");
    const { ingestDocument } = await import("./rag/ingest.server");

    const { data: doc, error } = await supabaseAdmin
      .from("knowledge_documents")
      .select("id, title, filename, category, subcategory, source_path, content")
      .eq("status", "aguardando")
      .order("category", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return { done: true as const };

    await supabaseAdmin
      .from("knowledge_documents")
      .update({ status: "processando", error_message: null })
      .eq("id", doc.id);

    try {
      let text: string | null = doc.content ?? null;
      if (!text) {
        const seed = listSeedFiles().find((f) => parseSourcePath(f.absPath).sourcePath === doc.source_path);
        if (!seed) throw new Error("Conteúdo do documento não encontrado (nem no upload nem no seed).");
        text = await seed.load();
      }
      const count = await ingestDocument(
        {
          id: doc.id,
          title: doc.title,
          filename: doc.filename,
          category: doc.category,
          subcategory: doc.subcategory,
        },
        text,
      );
      await supabaseAdmin
        .from("knowledge_documents")
        .update({ status: "concluido", chunk_count: count })
        .eq("id", doc.id);
      return { done: false as const, id: doc.id, title: doc.title, chunks: count };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await supabaseAdmin
        .from("knowledge_documents")
        .update({ status: "erro", error_message: msg })
        .eq("id", doc.id);
      return { done: false as const, id: doc.id, title: doc.title, error: msg };
    }
  });


const ReprocessInput = z.object({ id: z.string().uuid() });
export const reprocessDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReprocessInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("knowledge_documents")
      .update({ status: "aguardando", error_message: null, chunk_count: 0 })
      .eq("id", data.id);
    return { ok: true };
  });

const UploadInput = z.object({
  zipBase64: z.string().min(1),
  replaceAll: z.boolean().optional().default(false),
});

const SUPPORTED = /\.(txt|md|pdf|docx|xls|xlsx|csv)$/i;

export const uploadKnowledgeZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseSourcePath } = await import("./rag/paths");
    const { extractText, sha256Hex } = await import("./rag/text-extract.server");
    const JSZip = (await import("jszip")).default;

    const binary = atob(data.zipBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files).filter((f) => !f.dir && SUPPORTED.test(f.name));
    if (entries.length === 0) {
      throw new Error("Nenhum arquivo suportado no ZIP (.txt .md .pdf .docx .xls .xlsx .csv).");
    }

    // Build a report so admins can see per-file outcomes.
    const { data: report } = await supabaseAdmin
      .from("import_reports")
      .insert({ kind: "zip_upload", summary: { total: entries.length, replaceAll: data.replaceAll } })
      .select("id")
      .single();
    const reportId = (report?.id as string) || null;
    const reportItems: Array<{ report_id: string; file_name: string; status: string; message: string; details: Record<string, unknown> }> = [];

    const rows: Array<{
      title: string;
      filename: string;
      source_path: string;
      category: string;
      subcategory: string | null;
      status: string;
      chunk_count: number;
      error_message: string | null;
      content: string;
      file_type: string;
      original_file: string;
      content_hash: string;
      internal_title: string;
    }> = [];

    for (const entry of entries) {
      const raw = entry.name.replace(/^\/+/, "");
      let rel = raw;
      const marker = "base-conhecimento/";
      const mIdx = raw.indexOf(marker);
      if (mIdx >= 0) rel = raw.slice(mIdx + marker.length);
      else {
        const parts = raw.split("/");
        if (parts.length > 1) rel = parts.slice(1).join("/");
      }
      const fakeAbs = `/src/seed/base-conhecimento/${rel}`;
      const p = parseSourcePath(fakeAbs);
      try {
        const buf = await entry.async("arraybuffer");
        const { text, fileType } = await extractText(p.filename, buf);
        const hash = await sha256Hex(text);
        rows.push({
          title: p.title,
          filename: p.filename,
          source_path: p.sourcePath,
          category: p.category,
          subcategory: p.subcategory,
          status: "aguardando",
          chunk_count: 0,
          error_message: null,
          content: text,
          file_type: fileType,
          original_file: p.filename,
          content_hash: hash,
          internal_title: p.title,
        });
        if (reportId) reportItems.push({
          report_id: reportId,
          file_name: p.filename,
          status: "ok",
          message: `Extraído (${fileType})`,
          details: { chars: text.length },
        });
      } catch (err) {
        if (reportId) reportItems.push({
          report_id: reportId,
          file_name: p.filename,
          status: "error",
          message: err instanceof Error ? err.message : "Erro ao extrair.",
          details: {},
        });
      }
    }

    if (data.replaceAll) {
      await supabaseAdmin.from("knowledge_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabaseAdmin.from("knowledge_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      // Detect duplicates by content_hash against existing docs.
      const hashes = rows.map((r) => r.content_hash);
      const { data: existing } = await supabaseAdmin
        .from("knowledge_documents")
        .select("id, content_hash, source_path")
        .in("content_hash", hashes);
      const dupByHash = new Map<string, { id: string; source_path: string }>();
      for (const e of existing ?? []) {
        if (e.content_hash) dupByHash.set(e.content_hash as string, { id: e.id as string, source_path: e.source_path as string });
      }
      for (const r of rows) {
        const dup = dupByHash.get(r.content_hash);
        if (dup && dup.source_path !== r.source_path && reportId) {
          reportItems.push({
            report_id: reportId,
            file_name: r.filename,
            status: "duplicate",
            message: "Conteúdo idêntico a documento existente.",
            details: { duplicate_of: dup.id },
          });
        }
      }
    }

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from("knowledge_documents")
        .upsert(batch as never, { onConflict: "source_path", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    }

    if (reportId && reportItems.length > 0) {
      for (let i = 0; i < reportItems.length; i += 100) {
        await supabaseAdmin.from("import_report_items").insert(reportItems.slice(i, i + 100) as never);
      }
    }
    if (reportId) {
      await supabaseAdmin.from("import_reports").update({
        summary: {
          total: entries.length,
          extracted: rows.length,
          errors: reportItems.filter((r) => r.status === "error").length,
          duplicates: reportItems.filter((r) => r.status === "duplicate").length,
          replaceAll: data.replaceAll,
        },
      }).eq("id", reportId);
    }

    return { total: entries.length, inserted: rows.length, report_id: reportId };
  });

// Single-file upload (any supported format).
const FileInput = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  category: z.string().default("UPLOAD"),
  subcategory: z.string().nullable().optional(),
  confirmReplace: z.boolean().default(false),
});
export const uploadKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FileInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText, sha256Hex } = await import("./rag/text-extract.server");
    const { parseSourcePath } = await import("./rag/paths");

    const binary = atob(data.contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const buf = bytes.buffer;

    const { text, fileType } = await extractText(data.filename, buf);
    const hash = await sha256Hex(text);
    const fakePath = `/src/seed/base-conhecimento/${data.category}/${data.subcategory ? data.subcategory + "/" : ""}${data.filename}`;
    const p = parseSourcePath(fakePath);

    // Check duplicate by hash first.
    const { data: existing } = await supabaseAdmin
      .from("knowledge_documents")
      .select("id, source_path")
      .eq("content_hash", hash)
      .maybeSingle();
    if (existing && !data.confirmReplace) {
      return {
        duplicate: true as const,
        existing_id: existing.id,
        existing_path: existing.source_path,
      };
    }

    const row = {
      title: p.title,
      filename: p.filename,
      source_path: p.sourcePath,
      category: p.category,
      subcategory: p.subcategory,
      status: "aguardando",
      chunk_count: 0,
      error_message: null,
      content: text,
      file_type: fileType,
      original_file: data.filename,
      content_hash: hash,
      internal_title: p.title,
    };
    const { error } = await supabaseAdmin
      .from("knowledge_documents")
      .upsert(row as never, { onConflict: "source_path", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    return { duplicate: false as const, ok: true };
  });


