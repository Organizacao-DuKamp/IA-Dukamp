// Semantic search over knowledge_chunks. Returns top matches with source metadata.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embeddingProvider, embedQuery, toPgVector } from "./embeddings.server";

export interface Match {
  content: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  similarity: number;
}

export async function searchKnowledge(query: string, matchCount = 6): Promise<Match[]> {
  const byKey = new Map<string, Match>();
  const errors: string[] = [];

  // Busca semântica continua sendo a principal: entende intenção e sinônimos.
  try {
    const vec = await embedQuery(query);
    const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
      query_embedding: toPgVector(vec),
      match_count: matchCount * 2,
      embedding_provider: embeddingProvider(),
    } as never);
    if (error) throw error;
    for (const match of (data ?? []) as Match[]) {
      byKey.set(`${match.filename}:${match.content}`, match);
    }
  } catch (error) {
    errors.push(`semântica: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Busca lexical recupera nomes, códigos, siglas e números exatos, nos quais
  // embeddings costumam ser menos confiáveis. Também mantém a base disponível
  // se o provedor de embeddings estiver temporariamente fora do ar.
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "search_knowledge_lexical" as never,
      {
        search_query: query,
        match_count: matchCount * 2,
      } as never,
    );

    if (error) throw error;
    for (const match of (data ?? []) as Match[]) {
      const key = `${match.filename}:${match.content}`;
      const previous = byKey.get(key);
      if (!previous || match.similarity > previous.similarity) byKey.set(key, match);
    }
  } catch (error) {
    errors.push(`lexical: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (byKey.size === 0 && errors.length === 2) {
    throw new Error(`buscas da base indisponíveis (${errors.join("; ")})`);
  }
  return [...byKey.values()].sort((a, b) => b.similarity - a.similarity).slice(0, matchCount);
}
