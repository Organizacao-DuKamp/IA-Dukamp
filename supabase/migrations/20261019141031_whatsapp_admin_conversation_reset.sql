-- Called only by the authenticated admin server function using service_role.
-- Keep analytics and delivery idempotency records; reset only AI context.
CREATE OR REPLACE FUNCTION public.reset_whatsapp_conversation(p_phone TEXT, p_epoch TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  reset_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{6,20}$'
     OR p_epoch IS NULL OR length(p_epoch) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_reset_input';
  END IF;

  -- Hold pending jobs while deciding whether the reset can proceed. Claims use
  -- FOR UPDATE too, so a pending job cannot start between this check and reset.
  PERFORM 1 FROM public.whatsapp_proactive_queue WHERE phone_number = p_phone FOR UPDATE;
  PERFORM 1 FROM public.whatsapp_memory_inbox WHERE phone_number = p_phone FOR UPDATE;
  PERFORM 1 FROM public.whatsapp_processed_messages WHERE phone_number = p_phone FOR UPDATE;
  PERFORM 1 FROM public.whatsapp_conversations
    WHERE phone_number = p_phone FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation_not_found';
  END IF;

  -- Never let an already running response or memory extractor restore old context.
  IF EXISTS (SELECT 1 FROM public.whatsapp_processed_messages
      WHERE phone_number = p_phone AND delivered_at IS NULL AND (
        NULLIF(btrim(reply), '') IS NOT NULL
        OR (status = 'processing' AND (
          updated_at > reset_at - INTERVAL '10 minutes'
          OR (request_payload IS NOT NULL AND retry_count < 3)))))
    OR EXISTS (SELECT 1 FROM public.whatsapp_memory_inbox
      WHERE phone_number = p_phone AND status = 'processing')
    OR EXISTS (SELECT 1 FROM public.whatsapp_proactive_queue
      WHERE phone_number = p_phone AND status = 'processing') THEN
    RAISE EXCEPTION 'conversation_busy';
  END IF;

  UPDATE public.whatsapp_conversations
    SET conversation_id = 'wa:' || p_phone || ':reset:' || gen_random_uuid()::TEXT,
        history = '[]'::JSONB,
        state = jsonb_build_object('memory_reset', jsonb_build_object(
          'epoch', p_epoch, 'started_at', reset_at, 'history', '[]'::JSONB)),
        updated_at = reset_at
    WHERE phone_number = p_phone;

  UPDATE public.whatsapp_user_memory_facts
    SET status = 'resolved', resolved_at = reset_at, updated_at = reset_at
    WHERE phone_number = p_phone AND status = 'active';
  UPDATE public.whatsapp_memory_inbox
    SET status = 'dead', processed_at = reset_at, last_error = 'conversation_memory_reset',
        updated_at = reset_at
    WHERE phone_number = p_phone AND status IN ('pending', 'error');
  UPDATE public.whatsapp_proactive_queue
    SET status = 'skipped', last_error = 'conversation_memory_reset', updated_at = reset_at
    WHERE phone_number = p_phone AND status IN ('pending', 'failed');
  UPDATE public.whatsapp_followup_profiles
    SET memory_count = 0, last_memory_at = NULL, updated_at = reset_at
    WHERE phone_number = p_phone;

  RETURN reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_whatsapp_conversation(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_whatsapp_conversation(TEXT, TEXT) TO service_role;
