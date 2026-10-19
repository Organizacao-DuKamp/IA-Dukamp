-- Integration assertions with synthetic numbers. Always rolls back fixture data.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  target TEXT := '00000000000000000001';
  other TEXT := '00000000000000000002';
  epoch TEXT := 'reset-test';
BEGIN
  IF EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE phone_number IN (target, other)) THEN
    RAISE EXCEPTION 'Fixture numbers already exist; refusing to touch them';
  END IF;
  IF has_function_privilege('anon', 'public.reset_whatsapp_conversation(text,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.reset_whatsapp_conversation(text,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.reset_whatsapp_conversation(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Incorrect reset permissions';
  END IF;

  INSERT INTO public.whatsapp_conversations(phone_number, conversation_id, history, state)
    VALUES (target, 'reset-test-target', '[{"role":"user","content":"synthetic"}]', '{"summary":"old"}'),
           (other, 'reset-test-other', '[{"role":"user","content":"keep"}]', '{"summary":"keep"}');
  INSERT INTO public.whatsapp_user_memory_facts(phone_number, fact_key, subject, value_text)
    VALUES (target, 'test', 'fixture', 'old'), (other, 'test', 'fixture', 'keep');
  INSERT INTO public.whatsapp_followup_profiles(phone_number, memory_count, followups_enabled)
    VALUES (target, 1, false);
  INSERT INTO public.whatsapp_memory_inbox(phone_number, message_id, user_text)
    VALUES (target, 'reset-integration-target', 'synthetic');
  INSERT INTO public.whatsapp_proactive_queue(phone_number, local_date, scheduled_for)
    VALUES (target, current_date, now() + INTERVAL '1 day');
  INSERT INTO public.whatsapp_processed_messages(message_id, phone_number, status)
    VALUES ('reset-integration-delivery', target, 'processing');

  BEGIN
    PERFORM public.reset_whatsapp_conversation(target, epoch);
    RAISE EXCEPTION 'Expected busy rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'conversation_busy' THEN RAISE; END IF;
  END;
  IF (SELECT jsonb_array_length(history) FROM public.whatsapp_conversations WHERE phone_number=target) <> 1 THEN
    RAISE EXCEPTION 'Busy reset changed history';
  END IF;
  UPDATE public.whatsapp_processed_messages SET status='completed', delivered_at=now()
    WHERE message_id='reset-integration-delivery';

  PERFORM public.reset_whatsapp_conversation(target, epoch);
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE phone_number=target
    AND history='[]'::JSONB AND state->'memory_reset'->>'epoch'=epoch
    AND state->'memory_reset'->'history'='[]'::JSONB AND NOT state ? 'summary'
    AND conversation_id <> 'reset-test-target') THEN
    RAISE EXCEPTION 'Context was not fully reset';
  END IF;
  IF EXISTS (SELECT 1 FROM public.whatsapp_user_memory_facts WHERE phone_number=target AND status='active')
    OR EXISTS (SELECT 1 FROM public.whatsapp_memory_inbox WHERE phone_number=target AND status='pending')
    OR EXISTS (SELECT 1 FROM public.whatsapp_proactive_queue WHERE phone_number=target AND status='pending') THEN
    RAISE EXCEPTION 'Old memory can still run';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_followup_profiles WHERE phone_number=target
    AND memory_count=0 AND followups_enabled=false) THEN
    RAISE EXCEPTION 'Profile preference or count is incorrect';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_conversations WHERE phone_number=other
    AND conversation_id='reset-test-other' AND jsonb_array_length(history)=1)
    OR NOT EXISTS (SELECT 1 FROM public.whatsapp_user_memory_facts WHERE phone_number=other AND status='active') THEN
    RAISE EXCEPTION 'Other number was changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_processed_messages WHERE message_id='reset-integration-delivery'
    AND delivered_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Delivery idempotency was lost';
  END IF;
END;
$$;
ROLLBACK;
