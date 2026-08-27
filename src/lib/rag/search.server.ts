// Semantic search over knowledge_chunks. Returns top matches with source metadata.

import { logDiagnostic } from "../chat/diagnostics.server.ts";
import { classifyDomainIntent } from "../chat/intent";
import { embeddingProvider, embedQuery, toPgVector } from "./embeddings.server";

export interface Match {
  content: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  similarity: number;
}

function minimumExplicitSimilarity(): number {
  const configured = Number(process.env.TPEC_KNOWLEDGE_MIN_SIMILARITY ?? 0.72);
  if (!Number.isFinite(configured)) return 0.72;
  return Math.min(Math.max(configured, 0.6), 0.95);
}

export async function searchKnowledge(query: string, matchCount = 6): Promise<Match[]> {
  // Perguntas cujo objetivo é informação atual e que não pedem pesquisa interna
  // devem ir direto para a pesquisa web do ChatGPT. Além de poupar uma geração
  // de embedding + RPCs no Supabase, isso evita material histórico concorrendo
  // com evidência atual.
  const domainIntent = classifyDomainIntent(query);
  if (
    !domainIntent.needs_internal_search &&
    (domainIntent.intent === "current_research" || domainIntent.intent === "market_quote")
  ) {
    logDiagnostic("info", "rag.search.skipped", {
      reason: "current_web_research_only",
      intent: domainIntent.intent,
      query_chars: query.length,
      requested_matches: matchCount,
    });
    return [];
  }

  // A base RAG é privada e suas RPCs aceitam apenas service_role. Em runtimes
  // públicos onde essa chave deliberadamente não existe, o ChatGPT segue com
  // seu próprio conhecimento e Web Search.
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

  // Busca semântica: entende intenção e sinônimos.
  const semanticStarted = Date.now();
  try {
    const vec = await embedQuery(query);
    const { data, error } = await supabaseAdmin.rpc("match_knowledge_chunks", {
      query_embedding: toPgVector(vec),
      match_count: matchCount * 2,
      embedding_provider: embeddingProvider(),
    });
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

  // Busca lexical: recupera nomes, códigos, siglas e números exatos e funciona
  // também como fallback quando o provedor de embeddings estiver indisponível.
  const lexicalStarted = Date.now();
  try {
    const { data, error } = await supabaseAdmin.rpc("search_knowledge_lexical", {
      search_query: query,
      match_count: matchCount * 2,
    });

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

  // ChatGPT-first: a base privada só é considerada "evidência explícita" com
  // correspondência forte. Se nenhum trecho atingir o limiar, devolvemos [] e
  // o modelo fica livre para usar Web Search em vez de forçar um RAG parecido.
  const minimumSimilarity = minimumExplicitSimilarity();
  const matches = [...byKey.values()]
    .filter((match) => match.similarity >= minimumSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  logDiagnostic("info", "rag.search.finish", {
    duration_ms: Date.now() - totalStarted,
    query_chars: query.length,
    requested_matches: matchCount,
    returned_matches: matches.length,
    explicit_similarity_threshold: minimumSimilarity,
    top_similarity: matches[0]?.similarity ?? null,
    partial_errors: errors,
  });

  return matches;
}
