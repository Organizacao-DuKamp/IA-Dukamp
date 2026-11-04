-- Daily tasks keep one audited schedule. Occurrences have deterministic keys;
-- completion is per occurrence, cancellation/replanning invalidates queued work.
CREATE FUNCTION public.guardian_task_due_on(p_task jsonb,p_day date) RETURNS timestamptz
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT (p_day + ((p_task->>'dueAt')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::time)
    AT TIME ZONE 'America/Sao_Paulo';
$$;
CREATE FUNCTION public.guardian_task_due_valid(p_task jsonb,p_due timestamptz) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT COALESCE(p_task->>'status'='open' AND
    (CASE WHEN p_task->>'recurrence'='daily' THEN
      p_due >= (p_task->>'dueAt')::timestamptz
      AND p_due=public.guardian_task_due_on(p_task,(p_due AT TIME ZONE 'America/Sao_Paulo')::date)
      AND (p_task->>'completedThrough' IS NULL OR p_due>(p_task->>'completedThrough')::timestamptz)
    ELSE p_due=(p_task->>'dueAt')::timestamptz END),false);
$$;
CREATE FUNCTION public.guardian_seed_daily_tasks() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
  SELECT p.id,coalesce(t->>'responsiblePhone',t#>>'{source,actor}'),'task_due','tasks',
    'task:'||(t->>'id')||':'||(t->>'updatedAt')||':'||floor(extract(epoch FROM due)*1000)::bigint::text,
    jsonb_build_object('taskId',t->>'id','dueAt',to_char(due AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt',t->>'updatedAt','sourceMessageId',t#>>'{source,messageId}','requestedBy',t#>>'{source,actor}'),
    coalesce(p.book->>'name','Minha fazenda')||': lembrete diário — '||(t->>'title')||'. Horário: '||
      to_char(due AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' (Brasília). Já concluiu? Pode responder “já fiz”.',
    3,due,due+interval '1 day'
  FROM public.guardian_properties p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.book->'tasks','[]'::jsonb)) t
  CROSS JOIN generate_series(0,1) d
  CROSS JOIN LATERAL (SELECT public.guardian_task_due_on(t,(now() AT TIME ZONE 'America/Sao_Paulo')::date+d) due) occurrence
  WHERE p.book->'tasks' @> '[{"recurrence":"daily","status":"open"}]'::jsonb
    AND t->>'recurrence'='daily' AND t#>>'{source,confirmed}'='true'
    AND public.guardian_task_due_valid(t,due) AND due+interval '1 day'>now()
    AND EXISTS(SELECT 1 FROM public.guardian_members m WHERE m.property_id=p.id
      AND m.phone_number=coalesce(t->>'responsiblePhone',t#>>'{source,actor}') AND m.active)
  ON CONFLICT(property_id,recipient,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION public.guardian_task_due_on(jsonb,date),public.guardian_task_due_valid(jsonb,timestamptz),public.guardian_seed_daily_tasks() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_task_due_on(jsonb,date),public.guardian_task_due_valid(jsonb,timestamptz),public.guardian_seed_daily_tasks() TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_is_requested_reminder(p_event public.guardian_events,p_book jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT COALESCE((p_event).type='task_due' AND (p_event).topic='tasks' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_book->'tasks') t
    WHERE t->>'id'=(p_event).evidence->>'taskId'
      AND t->>'status'='open'
      AND t->>'updatedAt'=(p_event).evidence->>'updatedAt'
      AND public.guardian_task_due_valid(t,(p_event).not_before)
      AND ((p_event).evidence->>'dueAt')::timestamptz=(p_event).not_before
      AND t->'source'->>'confirmed'='true'
      AND COALESCE(t->>'responsiblePhone',t->'source'->>'actor')=(p_event).recipient
      AND (CASE WHEN (p_event).evidence ? 'requestedBy' THEN (p_event).evidence->>'requestedBy'
        -- Legacy events retain the original producer's provenance; never infer consent from a title.
        WHEN (p_event).evidence->>'sourceMessageId'=t->'source'->>'messageId' THEN t->'source'->>'actor'
        ELSE NULL END)=(p_event).recipient
  ),false);
$$;
REVOKE ALL ON FUNCTION public.guardian_is_requested_reminder(public.guardian_events,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_is_requested_reminder(public.guardian_events,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_claim_events(p_limit integer DEFAULT 5) RETURNS SETOF public.guardian_events
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.guardian_events; a public.guardian_accounts; sent_count integer; last_send timestamptz; hour_local integer; requested boolean;
BEGIN
  PERFORM public.guardian_seed_daily_tasks();
  p_limit:=LEAST(GREATEST(p_limit,1),20);
  -- A worker that died BEFORE dispatch can retry. AFTER dispatch, acceptance is unknown: never resend automatically.
  UPDATE public.guardian_events SET status='uncertain',last_error='dispatch_lease_expired',updated_at=now() WHERE status='dispatching' AND claimed_at<now()-interval '5 minutes';
  UPDATE public.guardian_events SET status='retry',last_error='claim_lease_recovered',available_at=now(),updated_at=now() WHERE status='claimed' AND claimed_at<now()-interval '5 minutes';
  UPDATE public.guardian_events SET status='expired',last_error='event_expired',updated_at=now() WHERE status IN ('pending','retry','claimed') AND expires_at<=now();
  FOR e IN SELECT ge.* FROM public.guardian_events ge WHERE ge.status IN ('pending','retry') AND ge.not_before<=now() AND ge.available_at<=now() AND ge.expires_at>now() ORDER BY ge.priority DESC,ge.not_before,ge.id LIMIT LEAST(GREATEST(p_limit,1),20)*20 FOR UPDATE SKIP LOCKED LOOP
    EXIT WHEN p_limit<=0;
    IF NOT pg_try_advisory_xact_lock(hashtextextended('guardian-send:'||e.recipient,0)) THEN CONTINUE; END IF;
    SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=e.recipient;
    IF NOT FOUND OR a.preferences->>'enabled' IS DISTINCT FROM 'true' OR a.preferences->>'consentAt' IS NULL OR NOT (a.preferences->'topics' ? e.topic) THEN CONTINUE; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=e.property_id AND phone_number=e.recipient AND active) THEN
      UPDATE public.guardian_events SET status='cancelled',last_error='access_revoked',updated_at=now() WHERE id=e.id; CONTINUE;
    END IF;
    IF EXISTS(SELECT 1 FROM public.guardian_events WHERE recipient=e.recipient AND status IN ('claimed','dispatching')) THEN CONTINUE; END IF;
    SELECT public.guardian_is_requested_reminder(e,p.book) INTO requested FROM public.guardian_properties p WHERE p.id=e.property_id;
    -- A recipient's own scheduled task is solicited, not a proactive interruption.
    -- Consent, topic, membership, leases, expiry and retry limits still apply.
    IF NOT COALESCE(requested,false) THEN
      hour_local:=extract(hour FROM now() AT TIME ZONE (a.preferences->>'timeZone'));
      IF hour_local < (a.preferences->>'startHour')::int OR hour_local >= (a.preferences->>'endHour')::int THEN
        UPDATE public.guardian_events SET available_at=((now() AT TIME ZONE (a.preferences->>'timeZone'))::date + CASE WHEN hour_local >= (a.preferences->>'endHour')::int THEN 1 ELSE 0 END + make_time((a.preferences->>'startHour')::int,0,0)) AT TIME ZONE (a.preferences->>'timeZone') WHERE id=e.id; CONTINUE;
      END IF;
      SELECT count(*),max(sent_at) INTO sent_count,last_send FROM public.guardian_events WHERE recipient=e.recipient AND status IN ('sent','uncertain') AND COALESCE(sent_at,claimed_at)>=date_trunc('day',now() AT TIME ZONE (a.preferences->>'timeZone')) AT TIME ZONE (a.preferences->>'timeZone');
      IF sent_count >= (a.preferences->>'maxPerDay')::int THEN CONTINUE; END IF;
      IF last_send IS NOT NULL AND last_send>now()-make_interval(mins=>(a.preferences->>'minIntervalMinutes')::int) THEN CONTINUE; END IF;
    END IF;
    IF e.attempts>=4 THEN UPDATE public.guardian_events SET status='failed',last_error='attempt_limit',updated_at=now() WHERE id=e.id; CONTINUE; END IF;
    UPDATE public.guardian_events SET status='claimed',lock_token=gen_random_uuid(),claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=e.id RETURNING * INTO e;
    RETURN NEXT e; p_limit:=p_limit-1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.guardian_claim_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_claim_events(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_begin_delivery(p_id uuid,p_lock uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.guardian_events; a public.guardian_accounts; b jsonb; inbound timestamptz; h integer;
BEGIN
  SELECT * INTO e FROM public.guardian_events WHERE id=p_id AND lock_token=p_lock AND status='claimed';
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Same property -> event lock order as a record edit/cancellation.
  SELECT book INTO b FROM public.guardian_properties WHERE id=e.property_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO e FROM public.guardian_events WHERE id=p_id AND lock_token=p_lock AND status='claimed' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=e.recipient;
  IF e.expires_at<=now() OR a.preferences->>'enabled' IS DISTINCT FROM 'true' OR a.preferences->>'consentAt' IS NULL
    OR NOT(a.preferences->'topics' ? e.topic) OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=e.property_id AND phone_number=e.recipient AND active) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='eligibility_changed',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  IF e.type='task_due' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'tasks') t WHERE t->>'id'=e.evidence->>'taskId' AND t->>'status'='open' AND t->>'updatedAt'=e.evidence->>'updatedAt' AND public.guardian_task_due_valid(t,e.not_before)) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='source_obsolete',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  -- Editing a daily title/revision must not dispatch an occurrence already accepted.
  IF e.type='task_due' AND EXISTS(SELECT 1 FROM jsonb_array_elements(b->'tasks') t
      WHERE t->>'id'=e.evidence->>'taskId' AND t->>'recurrence'='daily')
    AND EXISTS(SELECT 1 FROM public.guardian_events previous WHERE previous.property_id=e.property_id
      AND previous.recipient=e.recipient AND previous.type='task_due' AND previous.id<>e.id
      AND previous.evidence->>'taskId'=e.evidence->>'taskId' AND previous.not_before=e.not_before
      AND previous.status IN ('sent','dispatching','uncertain')) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='occurrence_already_delivered',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  h:=extract(hour FROM now() AT TIME ZONE (a.preferences->>'timeZone'));
  IF NOT public.guardian_is_requested_reminder(e,b) AND (h<(a.preferences->>'startHour')::int OR h>=(a.preferences->>'endHour')::int) THEN
    UPDATE public.guardian_events SET status='retry',available_at=now()+interval '1 hour',last_error='quiet_hours',updated_at=now() WHERE id=e.id;RETURN NULL;
  END IF;
  IF e.type='report' AND (a.preferences->>'reportCadence' IS DISTINCT FROM e.evidence->>'cadence' OR a.active_property_id IS DISTINCT FROM e.property_id) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='report_preference_changed',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  SELECT last_inbound_at INTO inbound FROM public.whatsapp_followup_profiles WHERE phone_number=e.recipient;
  UPDATE public.guardian_events SET status='dispatching',claimed_at=now(),updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('id',e.id,'recipient',e.recipient,'message',e.message,'mode',CASE WHEN inbound<=now() AND inbound>now()-interval '24 hours' THEN 'text' ELSE 'template' END);
END $$;
REVOKE ALL ON FUNCTION public.guardian_begin_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_begin_delivery(uuid,uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.guardian_app_push_valid(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardian_app_push_jobs j
    JOIN public.guardian_app_devices d ON d.id=j.device_id AND d.enabled AND d.fcm_token IS NOT NULL
    JOIN public.guardian_panel_sessions s ON s.token_hash=d.session_hash AND s.installed
      AND s.revoked_at IS NULL AND s.expires_at>now() AND s.phone_number=d.phone_number AND s.property_id=d.property_id
    JOIN public.guardian_members m ON m.property_id=d.property_id AND m.phone_number=d.phone_number AND m.active
    JOIN public.guardian_properties p ON p.id=d.property_id
    WHERE j.id=p_id AND j.expires_at>now() AND (j.kind='sync' OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(p.book->'tasks','[]'::jsonb)) t
      WHERE t->>'id'=j.task_id AND md5(t::text)=j.task_revision AND t->>'status'='open'
        AND coalesce(t->>'responsiblePhone',t#>>'{source,actor}')=d.phone_number
        AND (CASE WHEN t->>'recurrence'='daily' THEN public.guardian_task_due_valid(t,j.not_before)
          AND j.not_before<=now() AND j.not_before>=now()-interval '5 minutes'
        ELSE (t->>'dueAt')::timestamptz<=now() AND (t->>'dueAt')::timestamptz>=now()-interval '5 minutes' END)
    ))
  );
$$;
CREATE OR REPLACE FUNCTION public.guardian_app_claim_pushes(p_limit integer DEFAULT 12)
RETURNS TABLE(id uuid,lock_token uuid,fcm_token text,kind text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  DELETE FROM public.guardian_app_push_jobs j WHERE j.expires_at<now()-interval '7 days';
  INSERT INTO public.guardian_app_push_jobs(device_id,dedupe_key,kind,task_id,task_revision,not_before,expires_at)
    SELECT d.id,'due:'||p.id::text||':'||md5(t::text)||CASE WHEN t->>'recurrence'='daily' THEN ':'||floor(extract(epoch FROM due)*1000)::bigint::text ELSE '' END,
      'reminder',t->>'id',md5(t::text),due,due+interval '5 minutes'
    FROM public.guardian_app_devices d
    JOIN public.guardian_panel_sessions s ON s.token_hash=d.session_hash AND s.installed AND s.revoked_at IS NULL AND s.expires_at>now()
    JOIN public.guardian_members m ON m.property_id=d.property_id AND m.phone_number=d.phone_number AND m.active
    JOIN public.guardian_properties p ON p.id=d.property_id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.book->'tasks','[]'::jsonb)) t
    CROSS JOIN LATERAL (SELECT CASE WHEN t->>'recurrence'='daily' THEN
      public.guardian_task_due_on(t,(now() AT TIME ZONE 'America/Sao_Paulo')::date)
      ELSE (t->>'dueAt')::timestamptz END due) occurrence
    WHERE d.enabled AND d.fcm_token IS NOT NULL AND t->>'status'='open'
      AND coalesce(t->>'responsiblePhone',t#>>'{source,actor}')=d.phone_number
      AND public.guardian_task_due_valid(t,due) AND due<=now() AND due>=now()-interval '5 minutes'
    ON CONFLICT DO NOTHING;
  UPDATE public.guardian_app_push_jobs j SET status='cancelled',locked_until=NULL
    WHERE j.status IN ('pending','leased') AND NOT public.guardian_app_push_valid(j.id);
  RETURN QUERY WITH picked AS (
    SELECT j.id FROM public.guardian_app_push_jobs j
    WHERE (j.status='pending' OR (j.status='leased' AND j.locked_until<now()))
      AND j.not_before<=now() AND j.attempts<5 AND public.guardian_app_push_valid(j.id)
    ORDER BY CASE WHEN j.kind='reminder' THEN 0 ELSE 1 END,j.not_before
    LIMIT least(greatest(p_limit,1),30) FOR UPDATE OF j SKIP LOCKED
  ), claimed AS (
    UPDATE public.guardian_app_push_jobs j SET status='leased',lock_token=gen_random_uuid(),locked_until=now()+interval '2 minutes',attempts=j.attempts+1
    FROM picked WHERE j.id=picked.id RETURNING j.*
  ) SELECT c.id,c.lock_token,d.fcm_token,c.kind FROM claimed c JOIN public.guardian_app_devices d ON d.id=c.device_id;
END $$;
