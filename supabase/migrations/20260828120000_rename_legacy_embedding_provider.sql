-- Remove the former hosting provider name from legacy embedding metadata.
-- Legacy vectors remain incompatible with the current OpenAI index and are
-- therefore still excluded by the provider filter in match_knowledge_chunks.
UPDATE public.knowledge_chunks
SET metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{embedding_provider}',
  '"legacy:google/gemini-embedding-001:3072"'::jsonb,
  true
)
WHERE metadata->>'embedding_provider' LIKE '%:google/gemini-embedding-001:3072'
  AND metadata->>'embedding_provider' <> 'legacy:google/gemini-embedding-001:3072';
