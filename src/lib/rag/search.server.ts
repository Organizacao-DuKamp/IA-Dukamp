// Semantic search over knowledge_chunks. Returns top matches with source metadata.

import { logDiagnostic } from "../chat/diagnostics.server.ts";
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
  // A base RAG é privada e suas RPCs aceitam apenas service_role. Em runtimes
  // públicos como a Netlify, onde essa chave deliberadamente não existe, não
  // tente inicializar o cliente privilegiado. O orquestrador continuará com
  // as demais fontes disponíveis (catálogo/site/Perplexity/OpenAI).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    logDiagnostic("warn", "rag.search.skipped", {
      reason: "service_role_unavailable",
      query_chars: query.length,
      requested_matches: matchCount,
    });
    return [];
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const byKey = new Map<string, Match>();
  const errors: string[] = [];
  const totalStarted = Date.now();

  // Busca semântica continua sendo a principal: entende intenção e sinônimos.
  const semanticStarted = Date.now();
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
    logDiagnostic("info", "rag.search.semantic.success", {
      provider: embeddingProvider(),
      duration_ms: Date.now() - semanticStarted,
      result_count: (data ?? []).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`semântica: ${message}`);
    logDiagnostic("warn", "rag.search.semantic.error", {
      provider: embeddingProvider(),
      duration_ms: Date.now() - semanticStarted,
      error_name: error instanceof Error ? error.name : "unknown",
      error_message: message,
    });
  }

  // Busca lexical recupera nomes, códigos, siglas e números exatos, nos quais
  // embeddings costumam ser menos confiáveis. Também mantém a base disponível
  // se o provedor de embeddings estiver temporariamente fora do ar.
  const lexicalStarted = Date.now();
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
    logDiagnostic("info", "rag.search.lexical.success", {
      duration_ms: Date.now() - lexicalStarted,
      result_count: (data ?? []).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`lexical: ${message}`);
    logDiagnostic("warn", "rag.search.lexical.error", {
      duration_ms: Date.now() - lexicalStarted,
      error_name: error instanceof Error ? error.name : "unknown",
      error_message: message,
    });
  }

  if (byKey.size === 0 && errors.length === 2) {
    logDiagnostic("error", "rag.search.failed", {
      duration_ms: Date.now() - totalStarted,
      errors,
      query_chars: query.length,
      requested_matches: matchCount,
    });
    throw new Error(`buscas da base indisponíveis (${errors.join("; ")})`);
  }

  const matches = [...byKey.values()].sort((a, b) => b.similarity - a.similarity).slice(0, matchCount);
  logDiagnostic("info", "rag.search.finish", {
    duration_ms: Date.now() - totalStarted,
    query_chars: query.length,
    requested_matches: matchCount,
    returned_matches: matches.length,
    top_similarity: matches[0]?.similarity ?? null,
    partial_errors: errors,
  });
  return matches;
}
