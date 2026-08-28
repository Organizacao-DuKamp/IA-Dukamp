-- Complementa a busca vetorial com full-text search em português. Isso melhora
-- a recuperação de nomes de produtos, códigos, siglas e valores exatos e serve
-- como fallback quando a API de embeddings estiver indisponível.
CREATE INDEX IF NOT EXISTS knowledge_chunks_content_fts_idx
  ON public.knowledge_chunks
  USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '')));

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
    AND kd.requires_review = false
    AND kd.is_duplicate_of IS NULL
  ORDER BY similarity DESC, kc.chunk_index ASC
  LIMIT greatest(1, least(coalesce(match_count, 12), 30));
$$;

REVOKE ALL ON FUNCTION public.search_knowledge_lexical(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_knowledge_lexical(text, integer) TO service_role;
