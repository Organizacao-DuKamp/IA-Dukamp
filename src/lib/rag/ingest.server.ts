import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestPrivilegedClient } from "../privileged.server.ts";
import { chunkText } from "./chunking.server.ts";
import { embeddingProvider, embedTexts, toPgVector } from "./embeddings.server.ts";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DocMeta {
  id: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
}

type KnowledgeDbClient = typeof SupabaseAdmin;

async function resolveClient(client?: KnowledgeDbClient): Promise<KnowledgeDbClient> {
  if (client) return client;
  const requestScoped = getRequestPrivilegedClient();
  if (requestScoped) return requestScoped;
  // Fallback to client.server only if no context is provided
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function ingestDocument(
  doc: DocMeta,
  rawText: string,
  client?: KnowledgeDbClient,
  deps: { embed?: typeof embedTexts } = {},
): Promise<number> {
  const db = await resolveClient(client);
  const chunks = chunkText(rawText);
  if (chunks.length === 0) throw new Error("Documento vazio.");

  const { data: source, error: sourceError } = await db
    .from("knowledge_documents")
    .select("version,content_hash")
    .eq("id", doc.id)
    .single();
  if (sourceError || !source) throw new Error("Documento indisponível para indexação.");
  const vectors = await (deps.embed ?? embedTexts)(chunks);
  if (vectors.length !== chunks.length) throw new Error("Falha ao alinhar embeddings.");
  if (
    vectors.some(
      (v) => v.length !== 3072 || v.some((n) => !Number.isFinite(n)) || !v.some((n) => n !== 0),
    )
  )
    throw new Error("Embeddings inválidos; a geração anterior foi preservada.");
  const textHash = createHash("sha256").update(rawText).digest("hex");

  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    embedding: toPgVector(vectors[i]),
    metadata: {
      embedding_provider: embeddingProvider(),
      provenance: {
        document_version: source.version,
        source_hash: source.content_hash,
        text_sha256: textHash,
        indexed_at: new Date().toISOString(),
        origin: "administrator_supplied_document",
      },
    },
    category: doc.category,
    subcategory: doc.subcategory,
    filename: doc.filename,
    title: doc.title,
  }));

  const { data: count, error } = await (db as unknown as SupabaseClient).rpc(
    "replace_knowledge_document_chunks",
    {
      p_document_id: doc.id,
      p_expected_version: source.version,
      p_expected_hash: source.content_hash,
      p_chunks: rows,
    },
  );
  if (error?.code === "PGRST202" || error?.code === "42883")
    throw new Error(
      "A migração de indexação transacional ainda não está disponível. Aplique a migração de conhecimento e atualize o schema do PostgREST antes de reindexar. Os trechos anteriores foram preservados.",
    );
  if (error || count !== chunks.length)
    throw new Error(
      "Não foi possível substituir a indexação com segurança. A transação preservou os trechos anteriores.",
    );
  return count;
}
