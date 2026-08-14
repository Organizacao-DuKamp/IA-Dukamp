import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestPrivilegedClient } from "@/lib/privileged.server";
import { chunkText } from "./chunking.server";
import { embeddingProvider, embedTexts, toPgVector } from "./embeddings.server";

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
): Promise<number> {
  const db = await resolveClient(client);
  const chunks = chunkText(rawText);
  if (chunks.length === 0) throw new Error("Documento vazio.");

  const { error: deleteError } = await db
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", doc.id);
  if (deleteError) throw new Error(deleteError.message);

  const vectors = await embedTexts(chunks);
  if (vectors.length !== chunks.length) throw new Error("Falha ao alinhar embeddings.");

  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    embedding: toPgVector(vectors[i]),
    metadata: { embedding_provider: embeddingProvider() },
    category: doc.category,
    subcategory: doc.subcategory,
    filename: doc.filename,
    title: doc.title,
  }));

  const BATCH = 40;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db.from("knowledge_chunks").insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(error.message);
  }

  return chunks.length;
}
