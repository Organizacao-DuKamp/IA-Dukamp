-- Honor a recipient's own scheduled reminders without opening the proactive window.
-- Evidence is server-written; verify it against the current task before granting the exception.
CREATE OR REPLACE FUNCTION public.guardian_is_requested_reminder(p_event public.guardian_events,p_book jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT COALESCE((p_event).type='task_due' AND (p_event).topic='tasks' AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(p_book->'tasks') t
    WHERE t->>'id'=(p_event).evidence->>'taskId'
      AND t->>'status'='open'
      AND t->>'updatedAt'=(p_event).evidence->>'updatedAt'
      AND t->>'dueAt'=(p_event).evidence->>'dueAt'
      AND (t->>'dueAt')::timestamptz=(p_event).not_before
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
  IF e.type='task_due' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'tasks') t WHERE t->>'id'=e.evidence->>'taskId' AND t->>'status'='open' AND t->>'updatedAt'=e.evidence->>'updatedAt') THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='source_obsolete',updated_at=now() WHERE id=e.id; RETURN NULL;
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

-- Release only still-valid self-requested reminders deferred by the previous quiet-hours rule.
-- Preserve transport retry backoff and never resurrect expired/sent/uncertain/cancelled events.
UPDATE public.guardian_events e SET available_at=now(),last_error=NULL,updated_at=now()
FROM public.guardian_properties p
WHERE p.id=e.property_id AND e.not_before<=now() AND e.expires_at>now() AND e.available_at>now()
  AND ((e.status='pending' AND e.attempts=0) OR (e.status='retry' AND e.last_error='quiet_hours'))
  AND public.guardian_is_requested_reminder(e,p.book);
