-- Review decisions do not silently rewrite the original producer evidence.
CREATE FUNCTION public.guardian_resolve_review(p_id uuid,p_actor uuid,p_status text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.guardian_review_queue;
BEGIN
  IF public.has_role(p_actor,'admin') IS DISTINCT FROM true OR p_status NOT IN ('resolved','rejected') THEN RAISE EXCEPTION 'guardian_review_denied'; END IF;
  SELECT * INTO r FROM public.guardian_review_queue WHERE id=p_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.guardian_review_queue SET status=p_status,resolved_by=p_actor,resolved_at=now() WHERE id=p_id;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details)
    VALUES(r.property_id,'admin:'||p_actor,r.message_id,'review_'||p_status,jsonb_build_object('reviewId',p_id,'reason',r.reason));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_resolve_review(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_resolve_review(uuid,uuid,text) TO service_role;

ALTER TABLE public.guardian_members ADD COLUMN rules_checked_at timestamptz;
CREATE INDEX guardian_members_rules_due ON public.guardian_members(rules_checked_at NULLS FIRST,property_id) WHERE active;
CREATE FUNCTION public.guardian_claim_rules(p_limit int DEFAULT 5) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  WITH due AS (
    SELECT m.property_id,m.phone_number FROM public.guardian_members m JOIN public.guardian_accounts a ON a.phone_number=m.phone_number
    JOIN public.guardian_properties p ON p.id=m.property_id
    WHERE m.active AND a.preferences->>'enabled'='true' AND a.preferences->>'consentAt' IS NOT NULL
      AND p.book#>>'{operations,alertRules,enabled}'='true' AND (m.rules_checked_at IS NULL OR m.rules_checked_at<now()-interval '10 minutes')
    ORDER BY m.rules_checked_at NULLS FIRST,m.property_id,m.phone_number LIMIT least(10,greatest(1,p_limit)) FOR UPDATE OF m SKIP LOCKED
  ), claimed AS (
    UPDATE public.guardian_members m SET rules_checked_at=now() FROM due WHERE m.property_id=due.property_id AND m.phone_number=due.phone_number RETURNING m.property_id,m.phone_number
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('propertyId',p.id,'phone',c.phone_number,'version',p.version,'book',p.book)),'[]'::jsonb)
    INTO result FROM claimed c JOIN public.guardian_properties p ON p.id=c.property_id;
  RETURN result;
END $$;
CREATE FUNCTION public.guardian_queue_rule_events(p_property uuid,p_phone text,p_version bigint,p_events jsonb) RETURNS int
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v bigint; e jsonb; n int:=0;
BEGIN
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' OR jsonb_array_length(p_events)>20 THEN RAISE EXCEPTION 'invalid_guardian_rules'; END IF;
  SELECT version INTO v FROM public.guardian_properties WHERE id=p_property FOR UPDATE;
  IF NOT FOUND OR v<>p_version THEN RETURN 0; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.guardian_members m JOIN public.guardian_accounts a ON a.phone_number=m.phone_number WHERE m.property_id=p_property AND m.phone_number=p_phone AND m.active AND a.preferences->>'enabled'='true' AND a.preferences->>'consentAt' IS NOT NULL) THEN RETURN 0; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF e->>'recipient' IS DISTINCT FROM p_phone OR e#>>'{evidence,ruleVersion}' IS DISTINCT FROM 'guardian-rules-v1'
      OR (e#>>'{evidence,sourceVersion}')::bigint IS DISTINCT FROM p_version OR e->>'type' NOT IN ('health_followup','performance_change') THEN RAISE EXCEPTION 'invalid_guardian_rule_event'; END IF;
    INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
      VALUES(p_property,p_phone,e->>'type',e->>'topic',e->>'key',e->'evidence',e->>'message',(e->>'priority')::smallint,(e->>'notBefore')::timestamptz,(e->>'expiresAt')::timestamptz)
      ON CONFLICT(property_id,recipient,dedupe_key) DO UPDATE SET status='pending',last_error=NULL,available_at=now(),evidence=EXCLUDED.evidence,message=EXCLUDED.message,not_before=EXCLUDED.not_before,expires_at=EXCLUDED.expires_at,updated_at=now()
      WHERE guardian_events.status='cancelled' AND guardian_events.last_error='rule_source_changed';
    IF FOUND THEN n:=n+1; END IF;
  END LOOP;
  RETURN n;
END $$;
CREATE FUNCTION public.guardian_cancel_obsolete_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE public.guardian_events SET status='cancelled',last_error='rule_source_changed',updated_at=now()
    WHERE property_id=NEW.id AND status IN ('pending','retry','claimed') AND evidence->>'ruleVersion'='guardian-rules-v1'
      AND (evidence->>'sourceVersion')::bigint<>NEW.version;
  RETURN NEW;
END $$;
CREATE TRIGGER guardian_rule_source_changed AFTER UPDATE OF book ON public.guardian_properties
FOR EACH ROW EXECUTE FUNCTION public.guardian_cancel_obsolete_rules();
REVOKE ALL ON FUNCTION public.guardian_claim_rules(int),public.guardian_queue_rule_events(uuid,text,bigint,jsonb),public.guardian_cancel_obsolete_rules() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_claim_rules(int),public.guardian_queue_rule_events(uuid,text,bigint,jsonb),public.guardian_cancel_obsolete_rules() TO service_role;
NOTIFY pgrst,'reload schema';
