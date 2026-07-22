// Semantic search over knowledge_chunks. Returns top matches with source metadata.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embedQuery, toPgVector } from "./embeddings.server";

export interface Match {
  content: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  similarity: number;
}

export async function searchKnowledge(query: string, matchCount = 6): Promise<Match[]> {
  const vec = await embedQuery(query);
  const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
    query_embedding: toPgVector(vec) as unknown as number[],
    match_count: matchCount,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Match[];
}
