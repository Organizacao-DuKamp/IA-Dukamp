-- Garante que mensagens proativas enviadas pela TPEC-IA entrem no mesmo
-- histórico usado para interpretar a próxima resposta do usuário.

ALTER TABLE public.whatsapp_proactive_queue
  ADD COLUMN IF NOT EXISTS history_synced_at TIMESTAMPTZ;

-- Envios feitos antes desta correção já podem ter respostas posteriores no
-- histórico; não os acrescente no final fora de ordem. Casos pontuais podem
-- ser reconciliados preservando a posição real da conversa.
UPDATE public.whatsapp_proactive_queue
SET history_synced_at = COALESCE(sent_at, NOW())
WHERE status = 'sent'
  AND history_synced_at IS NULL;

CREATE INDEX IF NOT EXISTS whatsapp_proactive_history_sync_idx
  ON public.whatsapp_proactive_queue (phone_number, sent_at)
  WHERE status = 'sent' AND history_synced_at IS NULL;

CREATE OR REPLACE FUNCTION public.sync_whatsapp_proactive_history(p_queue_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_phone TEXT;
  v_message TEXT;
  v_history JSONB;
BEGIN
  SELECT q.phone_number, q.message_text
  INTO v_phone, v_message
  FROM public.whatsapp_proactive_queue AS q
  WHERE q.id = p_queue_id
    AND q.status = 'sent'
    AND q.history_synced_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(BTRIM(v_message), '') = '' THEN
    UPDATE public.whatsapp_proactive_queue
    SET history_synced_at = NOW(), updated_at = NOW()
    WHERE id = p_queue_id;
    RETURN FALSE;
  END IF;

  INSERT INTO public.whatsapp_conversations (
    phone_number,
    conversation_id,
    state,
    history,
    updated_at
  )
  VALUES (
    v_phone,
    'wa:' || v_phone,
    NULL,
    '[]'::JSONB,
    NOW()
  )
  ON CONFLICT (phone_number) DO NOTHING;

  SELECT COALESCE(c.history, '[]'::JSONB)
  INTO v_history
  FROM public.whatsapp_conversations AS c
  WHERE c.phone_number = v_phone
  FOR UPDATE;

  v_history :=
    v_history ||
    JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT(
        'role', 'assistant',
        'content', LEFT(v_message, 8000)
      )
    );

  IF JSONB_ARRAY_LENGTH(v_history) > 40 THEN
    SELECT COALESCE(JSONB_AGG(items.value ORDER BY items.ordinality), '[]'::JSONB)
    INTO v_history
    FROM (
      SELECT value, ordinality
      FROM JSONB_ARRAY_ELEMENTS(v_history) WITH ORDINALITY
      ORDER BY ordinality DESC
      LIMIT 40
    ) AS items;
  END IF;

  UPDATE public.whatsapp_conversations
  SET history = v_history, updated_at = NOW()
  WHERE phone_number = v_phone;

  UPDATE public.whatsapp_proactive_queue
  SET history_synced_at = NOW(), updated_at = NOW()
  WHERE id = p_queue_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_whatsapp_proactive_history(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_whatsapp_proactive_history(UUID)
  TO service_role;
