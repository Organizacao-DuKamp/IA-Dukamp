UPDATE public.knowledge_documents 
SET status = 'aguardando', 
    error_message = NULL 
WHERE status = 'erro';
