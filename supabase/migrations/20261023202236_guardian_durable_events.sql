CREATE FUNCTION public.guardian_record_event_history() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.guardian_event_history(event_id,status,reason) VALUES(NEW.id,NEW.status,NEW.last_error);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guardian_record_event_history() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_record_event_history() TO service_role;
CREATE TRIGGER guardian_event_status_history AFTER INSERT OR UPDATE OF status ON public.guardian_events FOR EACH ROW EXECUTE FUNCTION public.guardian_record_event_history();

CREATE FUNCTION public.guardian_claim_events(p_limit integer DEFAULT 5) RETURNS SETOF public.guardian_events
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.guardian_events; a public.guardian_accounts; sent_count integer; last_send timestamptz; hour_local integer;
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
    hour_local:=extract(hour FROM now() AT TIME ZONE (a.preferences->>'timeZone'));
    IF hour_local < (a.preferences->>'startHour')::int OR hour_local >= (a.preferences->>'endHour')::int THEN
      UPDATE public.guardian_events SET available_at=((now() AT TIME ZONE (a.preferences->>'timeZone'))::date + CASE WHEN hour_local >= (a.preferences->>'endHour')::int THEN 1 ELSE 0 END + make_time((a.preferences->>'startHour')::int,0,0)) AT TIME ZONE (a.preferences->>'timeZone') WHERE id=e.id; CONTINUE;
    END IF;
    SELECT count(*),max(sent_at) INTO sent_count,last_send FROM public.guardian_events WHERE recipient=e.recipient AND status IN ('sent','uncertain') AND COALESCE(sent_at,claimed_at)>=date_trunc('day',now() AT TIME ZONE (a.preferences->>'timeZone')) AT TIME ZONE (a.preferences->>'timeZone');
    IF sent_count >= (a.preferences->>'maxPerDay')::int THEN CONTINUE; END IF;
    IF last_send IS NOT NULL AND last_send>now()-make_interval(mins=>(a.preferences->>'minIntervalMinutes')::int) THEN CONTINUE; END IF;
    IF e.attempts>=4 THEN UPDATE public.guardian_events SET status='failed',last_error='attempt_limit',updated_at=now() WHERE id=e.id; CONTINUE; END IF;
    UPDATE public.guardian_events SET status='claimed',lock_token=gen_random_uuid(),claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=e.id RETURNING * INTO e;
    RETURN NEXT e; p_limit:=p_limit-1;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.guardian_claim_events(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_claim_events(integer) TO service_role;

CREATE FUNCTION public.guardian_begin_delivery(p_id uuid,p_lock uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.guardian_events; a public.guardian_accounts; b jsonb; inbound timestamptz; h integer;
BEGIN
  SELECT * INTO e FROM public.guardian_events WHERE id=p_id AND lock_token=p_lock AND status='claimed' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=e.recipient;
  IF e.expires_at<=now() OR a.preferences->>'enabled' IS DISTINCT FROM 'true' OR a.preferences->>'consentAt' IS NULL
    OR NOT(a.preferences->'topics' ? e.topic) OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=e.property_id AND phone_number=e.recipient AND active) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='eligibility_changed',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  h:=extract(hour FROM now() AT TIME ZONE (a.preferences->>'timeZone'));
  IF h<(a.preferences->>'startHour')::int OR h>=(a.preferences->>'endHour')::int THEN
    UPDATE public.guardian_events SET status='retry',available_at=now()+interval '1 hour',last_error='quiet_hours',updated_at=now() WHERE id=e.id;RETURN NULL;
  END IF;
  SELECT book INTO b FROM public.guardian_properties WHERE id=e.property_id;
  IF e.type='report' AND (a.preferences->>'reportCadence' IS DISTINCT FROM e.evidence->>'cadence' OR a.active_property_id IS DISTINCT FROM e.property_id) THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='report_preference_changed',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  IF e.type='task_due' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'tasks') t WHERE t->>'id'=e.evidence->>'taskId' AND t->>'status'='open' AND t->>'updatedAt'=e.evidence->>'updatedAt') THEN
    UPDATE public.guardian_events SET status='cancelled',last_error='source_obsolete',updated_at=now() WHERE id=e.id; RETURN NULL;
  END IF;
  SELECT last_inbound_at INTO inbound FROM public.whatsapp_followup_profiles WHERE phone_number=e.recipient;
  UPDATE public.guardian_events SET status='dispatching',claimed_at=now(),updated_at=now() WHERE id=e.id;
  RETURN jsonb_build_object('id',e.id,'recipient',e.recipient,'message',e.message,'mode',CASE WHEN inbound<=now() AND inbound>now()-interval '24 hours' THEN 'text' ELSE 'template' END);
END $$;
REVOKE ALL ON FUNCTION public.guardian_begin_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_begin_delivery(uuid,uuid) TO service_role;

CREATE FUNCTION public.guardian_finish_delivery(p_id uuid,p_lock uuid,p_status text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.guardian_events;
BEGIN
  IF p_status NOT IN ('sent','uncertain','failed','retry') OR length(COALESCE(p_error,''))>160 THEN RAISE EXCEPTION 'invalid_delivery_result'; END IF;
  IF p_status='sent' AND (p_provider_id IS NULL OR length(p_provider_id) NOT BETWEEN 1 AND 256) THEN RAISE EXCEPTION 'provider_receipt_required'; END IF;
  SELECT * INTO e FROM public.guardian_events WHERE id=p_id AND lock_token=p_lock AND status='dispatching' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.guardian_events SET status=CASE WHEN p_status='retry' AND attempts>=4 THEN 'failed' ELSE p_status END,
    provider_message_id=p_provider_id,last_error=p_error,sent_at=CASE WHEN p_status='sent' THEN now() ELSE NULL END,
    available_at=now()+make_interval(secs=>LEAST(3600,60*(2^LEAST(e.attempts,6))::int)),updated_at=now() WHERE id=p_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_finish_delivery(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_finish_delivery(uuid,uuid,text,text,text) TO service_role;

ALTER TABLE public.guardian_properties ADD COLUMN weather_checked_at timestamptz;
CREATE INDEX guardian_properties_weather_idx ON public.guardian_properties(weather_checked_at NULLS FIRST);
CREATE FUNCTION public.guardian_claim_weather(p_limit integer DEFAULT 3) RETURNS SETOF public.guardian_properties
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  RETURN QUERY WITH due AS (SELECT p.id FROM public.guardian_properties p WHERE (p.weather_checked_at IS NULL OR p.weather_checked_at<now()-interval '3 hours')
    AND EXISTS(SELECT 1 FROM public.guardian_members m JOIN public.guardian_accounts a ON a.phone_number=m.phone_number WHERE m.property_id=p.id AND m.active AND a.preferences->>'enabled'='true' AND a.preferences->>'consentAt' IS NOT NULL AND a.preferences->'topics' ? 'weather')
    ORDER BY p.weather_checked_at NULLS FIRST,p.id LIMIT LEAST(GREATEST(p_limit,1),10) FOR UPDATE SKIP LOCKED)
    UPDATE public.guardian_properties p SET weather_checked_at=now() FROM due WHERE p.id=due.id RETURNING p.*;
END $$;
REVOKE ALL ON FUNCTION public.guardian_claim_weather(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_claim_weather(integer) TO service_role;
