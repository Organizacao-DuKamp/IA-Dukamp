-- Run after guardian_requested_reminder_times. No WhatsApp/provider calls.
-- All synthetic properties, accounts, events, receipts and history are rolled back.
BEGIN;
DO $$
DECLARE
  test_phone text := '5599'||lpad(floor(random()*1000000000)::bigint::text,9,'0');
  property_id uuid := gen_random_uuid();
  task_id text := gen_random_uuid()::text;
  event_id uuid;
  claimed public.guardian_events;
  payload jsonb;
  task_book jsonb;
  due_text text := to_char((now()-interval '5 seconds') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  updated_text text := to_char((now()-interval '1 hour') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  local_hour integer := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo');
  start_hour integer;
BEGIN
  IF EXISTS(SELECT 1 FROM public.guardian_accounts WHERE phone_number=test_phone) THEN
    RAISE EXCEPTION 'synthetic_phone_collision';
  END IF;
  -- Ensure this trial is outside its synthetic quiet window regardless of execution time.
  start_hour := CASE WHEN local_hour=23 THEN 0 ELSE local_hour+1 END;
  task_book := jsonb_build_object(
    'schema',1,'name','Validação de lembrete solicitado','city','Tanabi','uf','SP',
    'profile','{}'::jsonb,'animals','[]'::jsonb,'ledger','[]'::jsonb,'records','[]'::jsonb,
    'tasks',jsonb_build_array(jsonb_build_object(
      'id',task_id,'title','Lembrete sintético','dueAt',due_text,'status','open',
      'responsiblePhone',test_phone,'updatedAt',updated_text,
      'source',jsonb_build_object('actor',test_phone,'messageId','synthetic-request','confirmed',true,'at',updated_text)
    ))
  );
  INSERT INTO public.guardian_properties(id,book) VALUES(property_id,task_book);
  INSERT INTO public.guardian_accounts(phone_number,active_property_id,preferences)
    VALUES(test_phone,property_id,jsonb_build_object(
      'enabled',true,'consentAt',updated_text,'consentMessageId','synthetic-consent',
      'timeZone','America/Sao_Paulo','startHour',start_hour,'endHour',start_hour+1,
      'maxPerDay',2,'minIntervalMinutes',120,'topics',jsonb_build_array('tasks','weather'),
      'reportCadence','none'
    ));
  INSERT INTO public.guardian_members(property_id,phone_number,role,active)
    VALUES(property_id,test_phone,'owner',true);
  INSERT INTO public.whatsapp_followup_profiles(phone_number,followups_enabled,last_inbound_at)
    VALUES(test_phone,false,now());
  INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at,status,sent_at)
    SELECT property_id,test_phone,'weather_alert','weather','synthetic-earlier-'||n,'{}',
      'Aviso sintético anterior',4,now()-interval '1 minute',now()+interval '1 day','sent',now()-interval '1 minute'
    FROM generate_series(1,2) n;
  -- Use legacy provenance to verify compatibility before the new backend publishes.
  INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
    VALUES(property_id,test_phone,'task_due','tasks','synthetic-reminder',
      jsonb_build_object('taskId',task_id,'dueAt',due_text,'updatedAt',updated_text,'sourceMessageId','synthetic-request'),
      'Lembrete sintético',3,due_text::timestamptz,now()+interval '1 day') RETURNING id INTO event_id;
  SELECT c.* INTO claimed FROM public.guardian_claim_events(20) c WHERE c.id=event_id;
  IF claimed.id IS NULL THEN RAISE EXCEPTION 'requested_reminder_not_claimed'; END IF;
  IF public.guardian_begin_delivery(event_id,gen_random_uuid()) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_lock_accepted';
  END IF;
  payload := public.guardian_begin_delivery(event_id,claimed.lock_token);
  IF payload->>'mode' IS DISTINCT FROM 'text' THEN RAISE EXCEPTION 'requested_delivery_blocked'; END IF;
  IF NOT public.guardian_finish_delivery(event_id,claimed.lock_token,'sent','wamid.synthetic-validation',NULL) THEN
    RAISE EXCEPTION 'receipt_rejected';
  END IF;
  IF EXISTS(SELECT 1 FROM public.guardian_claim_events(20) c WHERE c.id=event_id) THEN
    RAISE EXCEPTION 'duplicate_reminder_claimed';
  END IF;
  -- Neither the quiet-window exception nor a valid old claim can revive a completed task.
  UPDATE public.guardian_events SET status='claimed',lock_token=gen_random_uuid(),claimed_at=now()
    WHERE id=event_id RETURNING * INTO claimed;
  UPDATE public.guardian_properties SET book=jsonb_set(book,'{tasks,0,status}','"done"') WHERE id=property_id;
  IF public.guardian_begin_delivery(event_id,claimed.lock_token) IS NOT NULL THEN
    RAISE EXCEPTION 'completed_task_delivered';
  END IF;
  IF (SELECT status FROM public.guardian_events WHERE id=event_id) IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'completed_event_not_cancelled';
  END IF;
END $$;
ROLLBACK;
SELECT 'requested_reminder_validation_passed_and_rolled_back' AS result;
