-- Identifica o espaço vetorial de cada chunk para nunca comparar embeddings
-- gerados por provedores/modelos incompatíveis.
UPDATE public.knowledge_chunks
SET metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{embedding_provider}',
  '"legacy:google/gemini-embedding-001:3072"'::jsonb,
  true
)
WHERE coalesce(metadata->>'embedding_provider', '') = '';

-- A busca semântica usa somente vetores produzidos pelo mesmo modelo OpenAI
-- usado para a consulta. A busca lexical continua disponível durante a
-- reindexação gradual dos documentos legados.
DROP FUNCTION IF EXISTS public.match_knowledge_chunks(vector, integer);

CREATE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(3072),
  match_count integer DEFAULT 6,
  embedding_provider text DEFAULT 'openai:text-embedding-3-large:3072'
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  title text,
  filename text,
  category text,
  subcategory text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.title,
    kc.filename,
    kc.category,
    kc.subcategory,
    1 - (kc.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.embedding IS NOT NULL
    AND kc.metadata->>'embedding_provider' = match_knowledge_chunks.embedding_provider
    AND kd.status IN ('concluido', 'aguardando', 'processando')
    AND kd.requires_review = false
    AND kd.is_duplicate_of IS NULL
  ORDER BY kc.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT greatest(1, least(coalesce(match_count, 6), 30));
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.search_knowledge_lexical(
  search_query text,
  match_count integer DEFAULT 12
)
RETURNS TABLE (
  content text,
  title text,
  filename text,
  category text,
  subcategory text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH query AS (
    SELECT websearch_to_tsquery('portuguese', left(trim(search_query), 500)) AS value
  )
  SELECT
    kc.content,
    kc.title,
    kc.filename,
    kc.category,
    kc.subcategory,
    least(0.95, 0.55 + ts_rank_cd(
      to_tsvector('portuguese', coalesce(kc.title, '') || ' ' || coalesce(kc.content, '')),
      query.value,
      32
    )::double precision) AS similarity
  FROM public.knowledge_chunks kc
  CROSS JOIN query
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE query.value @@ to_tsvector(
      'portuguese',
      coalesce(kc.title, '') || ' ' || coalesce(kc.content, '')
    )
    AND kd.status IN ('concluido', 'aguardando', 'processando')
    AND kd.requires_review = false
    AND kd.is_duplicate_of IS NULL
  ORDER BY similarity DESC, kc.chunk_index ASC
  LIMIT greatest(1, least(coalesce(match_count, 12), 30));
$$;

REVOKE ALL ON FUNCTION public.search_knowledge_lexical(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge_lexical(text, integer)
  TO service_role;

-- Coloca documentos com vetores legados na fila, sem apagar os chunks atuais:
-- enquanto não forem reprocessados, eles ainda podem ser encontrados pela
-- busca lexical acima.
UPDATE public.knowledge_documents kd
SET status = 'aguardando',
    chunk_count = 0,
    error_message = NULL
WHERE kd.status = 'concluido'
  AND EXISTS (
    SELECT 1
    FROM public.knowledge_chunks kc
    WHERE kc.document_id = kd.id
      AND kc.metadata->>'embedding_provider' <> 'openai:text-embedding-3-large:3072'
  );
