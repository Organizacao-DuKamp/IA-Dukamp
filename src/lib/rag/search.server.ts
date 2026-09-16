// Semantic + lexical search over knowledge_chunks. Returns top matches with source metadata.

import { logDiagnostic } from "../chat/diagnostics.server.ts";
import { classifyDomainIntent } from "../chat/intent.ts";
import { embeddingProvider, embedQuery, toPgVector } from "./embeddings.server.ts";

export interface Match {
  content: string;
  title: string;
  filename: string;
  category: string;
  subcategory: string | null;
  similarity: number;
  retrieval?: "semantic" | "lexical";
}

function minimumExplicitSimilarity(): number {
  const configured = Number(process.env.TPEC_KNOWLEDGE_MIN_SIMILARITY ?? 0.72);
  if (!Number.isFinite(configured)) return 0.72;
  return Math.min(Math.max(configured, 0.6), 0.95);
}

/**
 * O RPC lexical usa uma escala própria (base 0.55 + ts_rank_cd), portanto não
 * pode compartilhar o limiar de embeddings/cosseno. Sem este limiar separado,
 * fichas RTPI com termos exatos ficam carregadas no banco, mas são descartadas
 * antes de chegar ao modelo quando os embeddings ainda não foram processados.
 */
function minimumLexicalSimilarity(): number {
  const configured = Number(process.env.TPEC_KNOWLEDGE_MIN_LEXICAL_SIMILARITY ?? 0.58);
  if (!Number.isFinite(configured)) return 0.58;
  return Math.min(Math.max(configured, 0.55), 0.8);
}

const RAG_CACHE_TTL_MS = 10 * 60_000;
const RAG_CACHE_MAX_ENTRIES = 128;
const RAG_MAX_PER_DOCUMENT = 2;
const RAG_MAX_CONTEXT_CHARS = 7_500;
const ragCache = new Map<string, { at: number; value: Match[] }>();

function cacheKey(
  query: string,
  matchCount: number,
  semanticThreshold: number,
  lexicalThreshold: number,
): string {
  return `${embeddingProvider()}|sem:${semanticThreshold.toFixed(3)}|lex:${lexicalThreshold.toFixed(3)}|${Math.min(Math.max(matchCount, 1), 8)}|${query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200)}`;
}

function needsExpandedContext(query: string, topSimilarity: number | null): boolean {
  if (topSimilarity === null || topSimilarity < 0.82) return true;
  return /\b(e|ou|versus|compar|diferen[cç]|passo\s+a\s+passo|detalh|formula|dimension|cen[aá]rio|por que|porque)\b/i.test(
    query,
  );
}

function thresholdForMatch(
  match: Match,
  semanticThreshold: number,
  lexicalThreshold?: number,
): number {
  return match.retrieval === "lexical" && lexicalThreshold != null
    ? lexicalThreshold
    : semanticThreshold;
}

/** Seleção determinística: forte relevância, diversidade por documento e teto de contexto. */
export function selectKnowledgeMatches(
  candidates: Match[],
  query: string,
  requestedCount: number,
  semanticThreshold = minimumExplicitSimilarity(),
  lexicalThreshold?: number,
): Match[] {
  const maxRequested = Math.min(Math.max(Math.trunc(requestedCount), 1), 8);
  const topSimilarity =
    candidates.find(
      (match) => match.similarity >= thresholdForMatch(match, semanticThreshold, lexicalThreshold),
    )?.similarity ?? null;
  const target = Math.min(
    maxRequested,
    needsExpandedContext(query, topSimilarity) ? 6 : Math.min(3, maxRequested),
  );
  const selected: Match[] = [];
  const perDocument = new Map<string, number>();
  const seen = new Set<string>();
  let chars = 0;

  for (const match of candidates) {
    const requiredSimilarity = thresholdForMatch(match, semanticThreshold, lexicalThreshold);
    if (match.similarity < requiredSimilarity) continue;
    const contentKey = match.content
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ")
      .trim();
    if (!contentKey || seen.has(contentKey)) continue;
    const documentKey = match.filename || match.title || "unknown-document";
    if ((perDocument.get(documentKey) ?? 0) >= RAG_MAX_PER_DOCUMENT) continue;
    if (selected.length >= target) break;
    if (chars + match.content.length > RAG_MAX_CONTEXT_CHARS && selected.length > 0) continue;
    selected.push(match);
    seen.add(contentKey);
    perDocument.set(documentKey, (perDocument.get(documentKey) ?? 0) + 1);
    chars += match.content.length;
  }
  return selected;
}

function remember(key: string, value: Match[]): void {
  ragCache.set(key, { at: Date.now(), value });
  while (ragCache.size > RAG_CACHE_MAX_ENTRIES) {
    const first = ragCache.keys().next().value;
    if (typeof first !== "string") break;
    ragCache.delete(first);
  }
}

export async function searchKnowledge(query: string, matchCount = 6): Promise<Match[]> {
  // Perguntas cujo objetivo é informação atual e que não pedem pesquisa interna
  // devem ir direto para a pesquisa web. Além de poupar uma geração de
  // embedding + RPCs no Supabase, isso evita material histórico concorrendo
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
  // públicos onde essa chave deliberadamente não existe, a TPEC-IA segue com
  // os demais contextos e pesquisa externa quando necessário.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    logDiagnostic("warn", "rag.search.skipped", {
      reason: "service_role_unavailable",
      query_chars: query.length,
      requested_matches: matchCount,
    });
    return [];
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const semanticThreshold = minimumExplicitSimilarity();
  const lexicalThreshold = minimumLexicalSimilarity();
  const key = cacheKey(query, matchCount, semanticThreshold, lexicalThreshold);
  const cached = ragCache.get(key);
  if (cached && Date.now() - cached.at < RAG_CACHE_TTL_MS) {
    logDiagnostic("info", "rag.search.cache_hit", {
      requested_matches: matchCount,
      returned_matches: cached.value.length,
    });
    return cached.value;
  }
  if (cached) ragCache.delete(key);

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
      byKey.set(`${match.filename}:${match.content}`, { ...match, retrieval: "semantic" });
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
  // também como fallback quando os embeddings das fichas ainda não existem.
  const lexicalStarted = Date.now();
  try {
    const { data, error } = await supabaseAdmin.rpc("search_knowledge_lexical", {
      search_query: query,
      match_count: matchCount * 2,
    });

    if (error) throw error;
    for (const match of (data ?? []) as Match[]) {
      const key = `${match.filename}:${match.content}`;
      const lexicalMatch: Match = { ...match, retrieval: "lexical" };
      const previous = byKey.get(key);
      if (!previous || match.similarity > previous.similarity) byKey.set(key, lexicalMatch);
    }
    logDiagnostic("info", "rag.search.lexical.success", {
      duration_ms: Date.now() - lexicalStarted,
      result_count: (data ?? []).length,
      similarity_threshold: lexicalThreshold,
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

  // A busca semântica mantém um limiar alto; a lexical usa sua escala nativa.
  // Assim, um termo exato de ficha técnica pode ser usado sem rebaixar a
  // segurança do limiar de cosseno aplicado aos embeddings.
  const candidates = [...byKey.values()].sort((a, b) => b.similarity - a.similarity);
  const matches = selectKnowledgeMatches(
    candidates,
    query,
    matchCount,
    semanticThreshold,
    lexicalThreshold,
  );

  logDiagnostic("info", "rag.search.finish", {
    duration_ms: Date.now() - totalStarted,
    query_chars: query.length,
    requested_matches: matchCount,
    returned_matches: matches.length,
    semantic_similarity_threshold: semanticThreshold,
    lexical_similarity_threshold: lexicalThreshold,
    top_similarity: matches[0]?.similarity ?? null,
    retrieval_modes: [...new Set(matches.map((match) => match.retrieval).filter(Boolean))],
    partial_errors: errors,
  });

  remember(key, matches);
  return matches;
}
