-- SQL para resetar documentos que falharam por rate limit
UPDATE public.knowledge_documents
SET status = 'aguardando',
    error_message = NULL
WHERE status = 'erro'
  AND (
    error_message ILIKE '%rate limit%'
    OR error_message ILIKE '%429%'
    OR error_message ILIKE '%tokens per min%'
  );
