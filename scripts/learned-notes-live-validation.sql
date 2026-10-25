-- Synthetic, reversible validation of the existing private-memory storage contract.
-- No real producer data, shared farms, notifications or schema changes.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  p text := '000000000000098';
  at timestamptz := clock_timestamp();
  epoch text := 'reset-2026-10-14-duk-a91f';
  recovered jsonb;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.whatsapp_user_memory_facts WHERE phone_number=p), 'synthetic phone already in use';
  ASSERT NOT EXISTS (SELECT 1 FROM public.whatsapp_followup_profiles WHERE phone_number=p), 'synthetic profile already in use';
  ASSERT NOT has_table_privilege('anon', 'public.whatsapp_user_memory_facts', 'SELECT'), 'anonymous memory access';
  ASSERT NOT has_table_privilege('authenticated', 'public.whatsapp_user_memory_facts', 'SELECT'), 'client memory access';

  INSERT INTO public.whatsapp_user_memory_facts
    (phone_number,fact_key,category,subject,value_text,importance,follow_up_relevant,
     source_message_id,source_excerpt,first_seen_at,last_seen_at,metadata)
  VALUES (p,'learned:synthetic-sale','sale','Venda relatada','Hoje vendi 10 bois por R$ 30.000.',3,false,
    'validation:learned:1','Hoje vendi 10 bois por R$ 30.000.',at,at,
    jsonb_build_object('memory_epoch',epoch,'capture','conversation_v1','kind','reported'));
  INSERT INTO public.whatsapp_user_memory_facts
    (phone_number,fact_key,category,subject,value_text,metadata)
  VALUES (p,'learned:synthetic-sale','sale','Must not replace','Duplicate retry', '{}'::jsonb)
  ON CONFLICT (phone_number,fact_key) DO NOTHING;
  ASSERT (SELECT count(*) FROM public.whatsapp_user_memory_facts WHERE phone_number=p)=1, 'duplicate note';
  ASSERT (SELECT value_text FROM public.whatsapp_user_memory_facts WHERE phone_number=p)='Hoje vendi 10 bois por R$ 30.000.', 'retry overwrote source';
  INSERT INTO public.whatsapp_user_memory_facts
    (phone_number,fact_key,category,subject,value_text,follow_up_relevant,source_message_id,first_seen_at,last_seen_at,metadata)
  VALUES (p,'learned:synthetic-plan','sale','Venda planejada','Vou vender 5 bois amanhã.',false,'validation:learned:2',at,at,
    jsonb_build_object('memory_epoch',epoch,'capture','conversation_v1','kind','plan')),
    (p,'learned:synthetic-correction','sale','Correção relatada','Na verdade, vendi 8 bois, não 10.',false,'validation:learned:3',at,at,
    jsonb_build_object('memory_epoch',epoch,'capture','conversation_v1','kind','correction'));

  recovered := public.recall_whatsapp_context(p,'venda',epoch,NULL,NULL,clock_timestamp());
  ASSERT jsonb_array_length(recovered->'facts')=3, 'private notes not recalled';
  ASSERT (SELECT count(*) FROM public.whatsapp_user_memory_facts WHERE phone_number=p AND follow_up_relevant)=0, 'notes enabled notifications';
  recovered := public.recall_whatsapp_context('000000000000097','venda',epoch,NULL,NULL,clock_timestamp());
  ASSERT jsonb_array_length(recovered->'facts')=0, 'notes leaked to another phone';
  INSERT INTO public.whatsapp_followup_profiles(phone_number,followups_enabled,context_reset_at)
    VALUES(p,false,at+interval '1 second');
  recovered := public.recall_whatsapp_context(p,'venda',epoch,NULL,NULL,clock_timestamp());
  ASSERT jsonb_array_length(recovered->'facts')=0, 'reset restored old notes';
END;
$$;
RESET ROLE;
ROLLBACK;
SELECT 'learned_notes_live_validation_passed_and_rolled_back' AS validation;
