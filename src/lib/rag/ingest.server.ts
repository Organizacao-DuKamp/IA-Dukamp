// Ingestion: takes a document row and its raw text, chunks it, generates
// embeddings, and stores chunks. Idempotent per document (deletes prior chunks first).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chunkText } from "./chunking.server";
import { embedTexts, toPgVector } from "./embeddings.server";

interface DocMeta {
  id: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
}

export async function ingestDocument(doc: DocMeta, rawText: string): Promise<number> {
  const chunks = chunkText(rawText);
  if (chunks.length === 0) throw new Error("Documento vazio.");

  // Clear existing chunks for idempotency
  await supabaseAdmin.from("knowledge_chunks").delete().eq("document_id", doc.id);

  const vectors = await embedTexts(chunks);
  if (vectors.length !== chunks.length) throw new Error("Falha ao alinhar embeddings.");

  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    embedding: toPgVector(vectors[i]),
    category: doc.category,
    subcategory: doc.subcategory,
    filename: doc.filename,
    title: doc.title,
  }));

  // Insert in batches to keep payloads small
  const BATCH = 40;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert(slice);
    if (error) throw new Error(error.message);
  }

  return chunks.length;
}
