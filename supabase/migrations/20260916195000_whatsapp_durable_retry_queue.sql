ALTER TABLE public.whatsapp_processed_messages
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE INDEX IF NOT EXISTS whatsapp_processed_messages_stale_retry_idx
  ON public.whatsapp_processed_messages(updated_at)
  WHERE status = 'processing'
    AND reply IS NULL
    AND delivered_at IS NULL
    AND request_payload IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_stale_whatsapp_messages(
  p_limit INTEGER DEFAULT 5,
  p_stale_seconds INTEGER DEFAULT 105,
  p_max_retries INTEGER DEFAULT 3
)
RETURNS TABLE(
  message_id TEXT,
  phone_number TEXT,
  request_payload JSONB,
  retry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT w.message_id
    FROM public.whatsapp_processed_messages AS w
    WHERE w.status = 'processing'
      AND w.reply IS NULL
      AND w.delivered_at IS NULL
      AND w.request_payload IS NOT NULL
      AND w.retry_count < GREATEST(1, p_max_retries)
      AND w.updated_at < NOW() - make_interval(secs => GREATEST(30, p_stale_seconds))
    ORDER BY w.updated_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(1, p_limit), 20)
  ), claimed AS (
    UPDATE public.whatsapp_processed_messages AS w
    SET retry_count = w.retry_count + 1,
        presence_claimed_at = NULL,
        updated_at = NOW()
    FROM candidates AS c
    WHERE w.message_id = c.message_id
    RETURNING w.message_id, w.phone_number, w.request_payload, w.retry_count
  )
  SELECT c.message_id, c.phone_number, c.request_payload, c.retry_count
  FROM claimed AS c;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stale_whatsapp_messages(INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stale_whatsapp_messages(INTEGER, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.claim_stale_whatsapp_messages(INTEGER, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stale_whatsapp_messages(INTEGER, INTEGER, INTEGER) TO service_role;

COMMENT ON COLUMN public.whatsapp_processed_messages.request_payload IS
  'Entrada WhatsApp normalizada e suficiente para reprocessar uma execução órfã.';
COMMENT ON COLUMN public.whatsapp_processed_messages.retry_count IS
  'Quantidade de recuperações automáticas já reservadas após a execução inicial.';
COMMENT ON COLUMN public.whatsapp_processed_messages.last_error IS
  'Último erro conhecido durante recuperação automática; não contém segredos.';
COMMENT ON FUNCTION public.claim_stale_whatsapp_messages(INTEGER, INTEGER, INTEGER) IS
  'Reserva atomicamente mensagens WhatsApp órfãs para recuperação em background.';
