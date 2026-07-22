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

export const uploadKnowledgeZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseSourcePath } = await import("./rag/paths");
    const JSZip = (await import("jszip")).default;

    // Decode base64 -> Uint8Array
    const binary = atob(data.zipBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files).filter(
      (f) => !f.dir && /\.(txt|md)$/i.test(f.name),
    );
    if (entries.length === 0) {
      throw new Error("Nenhum arquivo .txt ou .md encontrado no ZIP.");
    }

    // Normalize path: ensure it contains the "/base-conhecimento/" marker so parseSourcePath works.
    // Also strip any leading top-level folder from the zip (e.g., "base-conhecimento/..." or "my-export/...").
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
    }> = [];
    for (const entry of entries) {
      const raw = entry.name.replace(/^\/+/, "");
      // Try to find "base-conhecimento" segment; if absent, treat the first segment as it.
      let rel = raw;
      const marker = "base-conhecimento/";
      const mIdx = raw.indexOf(marker);
      if (mIdx >= 0) {
        rel = raw.slice(mIdx + marker.length);
      } else {
        // strip leading top-level folder if there is one
        const parts = raw.split("/");
        if (parts.length > 1) rel = parts.slice(1).join("/");
      }
      const fakeAbs = `/src/seed/base-conhecimento/${rel}`;
      const p = parseSourcePath(fakeAbs);
      const text = await entry.async("string");
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
      });
    }

    if (data.replaceAll) {
      // Wipe chunks first (FK-safe), then docs.
      await supabaseAdmin.from("knowledge_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabaseAdmin.from("knowledge_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabaseAdmin
        .from("knowledge_documents")
        .upsert(batch, { onConflict: "source_path", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    }

    // For upserts of existing docs, reset chunks so reprocessing re-embeds fresh content.
    // (New docs already have chunk_count=0 and no chunks.)
    return { total: entries.length, inserted: rows.length };
  });

