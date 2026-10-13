-- Entrada aparece no painel antes de chamar qualquer provedor.
ALTER TABLE public.ai_chat_turns DROP CONSTRAINT IF EXISTS ai_chat_turns_status_check;
ALTER TABLE public.ai_chat_turns ADD CONSTRAINT ai_chat_turns_status_check
  CHECK (status IN ('pending', 'completed', 'error'));

-- Recupera entrega sem refazer pesquisa. Leases em processamento aguardam
-- 30 minutos: a Graph pode ter aceitado a mensagem antes de falhar o ACK no banco.
CREATE OR REPLACE FUNCTION public.claim_pending_whatsapp_deliveries(p_limit INTEGER DEFAULT 5)
RETURNS TABLE(message_id TEXT, phone_number TEXT, reply TEXT)
LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$
  WITH candidates AS (
    SELECT w.message_id
    FROM public.whatsapp_processed_messages w
    WHERE w.delivered_at IS NULL AND NULLIF(BTRIM(w.reply), '') IS NOT NULL
      AND ((w.status = 'completed' AND w.updated_at < NOW() - INTERVAL '30 seconds')
        OR (w.status = 'processing' AND w.updated_at < NOW() - INTERVAL '30 minutes'))
    ORDER BY w.updated_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(1, p_limit), 20)
  ), claimed AS (
    UPDATE public.whatsapp_processed_messages w
    SET status = 'processing', updated_at = NOW()
    FROM candidates c WHERE w.message_id = c.message_id
    RETURNING w.message_id, w.phone_number, w.reply
  )
  SELECT * FROM claimed;
$$;
REVOKE ALL ON FUNCTION public.claim_pending_whatsapp_deliveries(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_whatsapp_deliveries(INTEGER) TO service_role;
