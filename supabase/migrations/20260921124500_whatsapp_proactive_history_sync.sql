-- Mantém mensagens proativas no mesmo histórico usado pelo chat do WhatsApp.
CREATE OR REPLACE FUNCTION public.append_whatsapp_assistant_history(
  p_phone_number TEXT,
  p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_history JSONB;
  next_history JSONB;
BEGIN
  SELECT COALESCE(c.history, '[]'::jsonb)
    INTO current_history
  FROM public.whatsapp_conversations AS c
  WHERE c.phone_number = p_phone_number
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.whatsapp_conversations (
      phone_number,
      conversation_id,
      state,
      history,
      created_at,
      updated_at
    )
    VALUES (
      p_phone_number,
      'wa:' || p_phone_number,
      NULL,
      jsonb_build_array(jsonb_build_object('role', 'assistant', 'content', LEFT(p_content, 8000))),
      NOW(),
      NOW()
    )
    ON CONFLICT (phone_number) DO NOTHING;
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(item.value ORDER BY item.ord), '[]'::jsonb)
    INTO next_history
  FROM jsonb_array_elements(
    current_history || jsonb_build_array(
      jsonb_build_object('role', 'assistant', 'content', LEFT(p_content, 8000))
    )
  ) WITH ORDINALITY AS item(value, ord)
  WHERE item.ord > GREATEST(
    jsonb_array_length(
      current_history || jsonb_build_array(
        jsonb_build_object('role', 'assistant', 'content', LEFT(p_content, 8000))
      )
    ) - 40,
    0
  );

  UPDATE public.whatsapp_conversations
  SET history = next_history,
      updated_at = NOW()
  WHERE phone_number = p_phone_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_whatsapp_assistant_history(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_whatsapp_assistant_history(TEXT, TEXT)
  TO service_role;
