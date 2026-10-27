-- Additive evolution: existing farm books and memberships remain authoritative.
ALTER TABLE public.guardian_properties DROP CONSTRAINT guardian_properties_book_check;
ALTER TABLE public.guardian_properties DROP CONSTRAINT guardian_book_required_fields;
ALTER TABLE public.guardian_properties ADD CONSTRAINT guardian_book_required_fields CHECK (
  book ?& ARRAY['schema','name','city','uf','profile','animals','tasks','ledger','records']
  AND book->>'schema'='1' AND jsonb_typeof(book->'profile')='object'
  AND jsonb_typeof(book->'animals')='array' AND jsonb_typeof(book->'tasks')='array'
  AND jsonb_typeof(book->'ledger')='array' AND jsonb_typeof(book->'records')='array'
  AND (book->'name'='null'::jsonb OR (jsonb_typeof(book->'name')='string' AND length(book->>'name') BETWEEN 1 AND 160))
  AND (book->'city'='null'::jsonb OR (jsonb_typeof(book->'city')='string' AND length(book->>'city') BETWEEN 1 AND 160))
  AND (book->'uf'='null'::jsonb OR (jsonb_typeof(book->'uf')='string' AND book->>'uf' ~ '^[A-Z]{2}$'))
  AND octet_length(book::text)<=10000000
);

ALTER TABLE public.guardian_observed_properties ADD COLUMN guardian_property_id uuid REFERENCES public.guardian_properties(id) ON DELETE SET NULL;
CREATE INDEX guardian_observed_operational_link ON public.guardian_observed_properties(guardian_property_id) WHERE guardian_property_id IS NOT NULL;
CREATE FUNCTION public.guardian_project_operational_farm() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE profile public.guardian_observed_properties; farm public.guardian_properties; b jsonb; current_fact public.guardian_observed_facts; new_id uuid; op jsonb; matches int;
BEGIN
  -- A late retry from a reset generation must never restore old state.
  IF NEW.generation_start<>public.whatsapp_context_boundary(NEW.phone_number) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||NEW.phone_number,0));
  SELECT * INTO profile FROM public.guardian_observed_properties WHERE id=NEW.property_id FOR UPDATE;
  INSERT INTO public.guardian_accounts(phone_number) VALUES(NEW.phone_number) ON CONFLICT DO NOTHING;
  IF profile.guardian_property_id IS NULL THEN
    -- Reuse one unambiguous existing owner book; do not create a parallel farm
    -- merely because the producer switched from explicit commands to conversation.
    SELECT count(*),(array_agg(p.id))[1] INTO matches,new_id
    FROM public.guardian_properties p JOIN public.guardian_members m ON m.property_id=p.id
    WHERE m.phone_number=NEW.phone_number AND m.active AND m.role='owner'
      AND NOT EXISTS(SELECT 1 FROM public.guardian_observed_properties other WHERE other.guardian_property_id=p.id AND other.phone_number=NEW.phone_number AND other.generation_start=NEW.generation_start)
      AND (
        (profile.identity_key LIKE 'name:%' AND profile.identity_key='name:'||regexp_replace(translate(lower(btrim(p.book->>'name')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+',' ','g'))
        OR (profile.identity_key='default' AND (SELECT count(*) FROM public.guardian_members WHERE phone_number=NEW.phone_number AND active)=1
          AND (NEW.field<>'city' OR p.book->>'city' IS NULL OR lower(p.book->>'city')=lower(NEW.value#>>'{}')))
      );
    IF matches=1 THEN
      UPDATE public.guardian_observed_properties SET guardian_property_id=new_id WHERE id=profile.id;
      profile.guardian_property_id:=new_id;
    END IF;
  END IF;
  IF profile.guardian_property_id IS NULL AND profile.identity_key='default' AND (SELECT count(*) FROM public.guardian_members WHERE phone_number=NEW.phone_number AND active)>1 THEN
    -- Legacy private facts with an ambiguous farm stay private during backfill.
    RETURN NEW;
  END IF;
  IF profile.guardian_property_id IS NULL THEN
    IF (SELECT count(*) FROM public.guardian_members WHERE phone_number=NEW.phone_number AND active AND role='owner')>=100 THEN RAISE EXCEPTION 'guardian_capacity'; END IF;
    b:=jsonb_build_object('schema',1,'name',NULL,'city',NULL,'uf',NULL,'profile','{}'::jsonb,'animals','[]'::jsonb,'tasks','[]'::jsonb,'ledger','[]'::jsonb,'records','[]'::jsonb,
      'operations',jsonb_build_object('counts','[]'::jsonb,'movements','[]'::jsonb,'lots','[]'::jsonb));
    INSERT INTO public.guardian_properties(book) VALUES(b) RETURNING id INTO new_id;
    UPDATE public.guardian_observed_properties SET guardian_property_id=new_id WHERE id=profile.id;
    INSERT INTO public.guardian_members(property_id,phone_number,user_id,role)
      SELECT new_id,NEW.phone_number,user_id,'owner' FROM public.guardian_accounts WHERE phone_number=NEW.phone_number;
    -- Multiple farms never silently replace the conversational selection.
    UPDATE public.guardian_accounts SET active_property_id=new_id,version=version+1
      WHERE phone_number=NEW.phone_number AND active_property_id IS NULL
      AND (SELECT count(*) FROM public.guardian_members WHERE phone_number=NEW.phone_number AND active)=1;
    profile.guardian_property_id:=new_id;
  END IF;
  SELECT * INTO farm FROM public.guardian_properties WHERE id=profile.guardian_property_id FOR UPDATE;
  b:=farm.book;
  IF NOT b ? 'operations' THEN b:=b||jsonb_build_object('operations',jsonb_build_object('counts','[]'::jsonb,'movements','[]'::jsonb,'lots','[]'::jsonb)); END IF;
  SELECT * INTO current_fact FROM public.guardian_observed_current WHERE property_id=NEW.property_id AND field=NEW.field;
  IF current_fact.id=NEW.id THEN
    IF NEW.field IN ('name','city','uf') THEN b:=jsonb_set(b,ARRAY[NEW.field],NEW.value);
    ELSIF NEW.field IN ('feeding','activity') THEN b:=jsonb_set(b,ARRAY['profile',NEW.field],NEW.value);
    ELSIF NEW.field='breed' THEN b:=jsonb_set(b,'{profile,breeds}',jsonb_build_array(NEW.value));
    ELSIF NEW.field='areaHa' AND (NEW.value::text)::numeric>0 THEN b:=jsonb_set(b,'{operations,areaHa}',NEW.value);
    END IF;
  END IF;
  IF NEW.field='herdTotal' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(b#>'{operations,counts}','[]')) c WHERE c->>'id'=NEW.id::text) THEN
    op:=jsonb_build_object('id',NEW.id,'count',NEW.value,'date',NEW.effective_date,
      'source',jsonb_build_object('actor',NEW.phone_number,'messageId',NEW.source_message_id,'at',to_char(NEW.source_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'confirmed',true));
    b:=jsonb_set(b,'{operations,counts}',coalesce(b#>'{operations,counts}','[]'::jsonb)||jsonb_build_array(op));
  END IF;
  IF NEW.field IN ('cows','oxen','calves','heifers') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(b#>'{operations,categoryCounts}','[]')) c WHERE c->>'id'=NEW.id::text) THEN
    op:=jsonb_build_object('id',NEW.id,'category',NEW.field,'count',NEW.value,'date',NEW.effective_date,
      'source',jsonb_build_object('actor',NEW.phone_number,'messageId',NEW.source_message_id,'at',to_char(NEW.source_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'confirmed',true));
    b:=jsonb_set(b,'{operations,categoryCounts}',coalesce(b#>'{operations,categoryCounts}','[]'::jsonb)||jsonb_build_array(op));
  END IF;
  UPDATE public.guardian_properties SET book=b,version=version+1,updated_at=greatest(updated_at,NEW.source_at) WHERE id=farm.id;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details)
    VALUES(farm.id,NEW.phone_number,NEW.source_message_id,'observed_fact',jsonb_build_object('field',NEW.field,'factId',NEW.id,'classification','declared','effectiveDate',NEW.effective_date));
  RETURN NEW;
END $$;
CREATE TRIGGER guardian_operational_projection AFTER INSERT ON public.guardian_observed_facts
FOR EACH ROW EXECUTE FUNCTION public.guardian_project_operational_farm();
CREATE TRIGGER guardian_operational_backfill AFTER UPDATE ON public.guardian_observed_facts
FOR EACH ROW EXECUTE FUNCTION public.guardian_project_operational_farm();
UPDATE public.guardian_observed_facts f SET field=f.field FROM public.guardian_observed_properties p
WHERE f.property_id=p.id AND p.generation_start=public.whatsapp_context_boundary(p.phone_number);
DROP TRIGGER guardian_operational_backfill ON public.guardian_observed_facts;
REVOKE ALL ON FUNCTION public.guardian_project_operational_farm() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_project_operational_farm() TO service_role;

CREATE TABLE public.guardian_panel_codes (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  phone_number text NOT NULL, property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  message_id text NOT NULL CHECK(length(message_id) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', consumed_at timestamptz,
  UNIQUE(phone_number,message_id), CHECK(expires_at<=created_at+interval '10 minutes')
);
CREATE TABLE public.guardian_panel_sessions (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  phone_number text NOT NULL, property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '12 hours', revoked_at timestamptz,
  CHECK(expires_at<=created_at+interval '12 hours')
);
CREATE TABLE public.guardian_panel_requests (
  phone_number text NOT NULL, request_id uuid NOT NULL, property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(phone_number,request_id)
);
CREATE TABLE public.guardian_panel_limits (key_hash text NOT NULL, bucket timestamptz NOT NULL, attempts int NOT NULL DEFAULT 1, PRIMARY KEY(key_hash,bucket));
CREATE TABLE public.guardian_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone_number text NOT NULL, message_id text NOT NULL,
  property_id uuid REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(reason IN ('ambiguous_property','ambiguous_date','conflict','persistence_failure')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','rejected')),
  details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), resolved_by uuid REFERENCES auth.users(id), resolved_at timestamptz,
  UNIQUE(phone_number,message_id,reason)
);
CREATE INDEX guardian_panel_codes_phone ON public.guardian_panel_codes(phone_number,created_at DESC);
CREATE INDEX guardian_panel_sessions_phone ON public.guardian_panel_sessions(phone_number,property_id,expires_at);
CREATE INDEX guardian_review_pending ON public.guardian_review_queue(created_at) WHERE status='pending';
ALTER TABLE public.guardian_panel_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_panel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_panel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_panel_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_review_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_panel_codes,public.guardian_panel_sessions,public.guardian_panel_requests,public.guardian_panel_limits,public.guardian_review_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guardian_panel_codes,public.guardian_panel_sessions,public.guardian_panel_requests,public.guardian_panel_limits,public.guardian_review_queue TO service_role;
GRANT SELECT ON public.guardian_review_queue TO authenticated;
CREATE POLICY guardian_review_admin ON public.guardian_review_queue FOR SELECT TO authenticated USING ((SELECT public.has_role(auth.uid(),'admin')));

CREATE FUNCTION public.guardian_panel_issue(p_phone text,p_property uuid,p_message text,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
  PERFORM 1 FROM public.guardian_properties WHERE id=p_property FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=p_property AND phone_number=p_phone AND active) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  IF EXISTS(SELECT 1 FROM public.guardian_panel_codes WHERE phone_number=p_phone AND message_id=p_message) THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.guardian_panel_codes WHERE phone_number=p_phone AND created_at>now()-interval '10 minutes')>=5 THEN RAISE EXCEPTION 'guardian_code_rate_limited'; END IF;
  UPDATE public.guardian_panel_codes SET consumed_at=now() WHERE phone_number=p_phone AND property_id=p_property AND consumed_at IS NULL;
  INSERT INTO public.guardian_panel_codes(token_hash,phone_number,property_id,message_id) VALUES(p_hash,p_phone,p_property,p_message);
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action) VALUES(p_property,p_phone,p_message,'panel_code_issued');
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_panel_exchange(p_code_hash text,p_session_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.guardian_panel_codes;
BEGIN
  SELECT * INTO c FROM public.guardian_panel_codes WHERE token_hash=p_code_hash;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=c.property_id FOR UPDATE;
  SELECT * INTO c FROM public.guardian_panel_codes WHERE token_hash=p_code_hash AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=c.property_id AND phone_number=c.phone_number AND active) THEN RETURN false; END IF;
  INSERT INTO public.guardian_panel_sessions(token_hash,phone_number,property_id) VALUES(p_session_hash,c.phone_number,c.property_id);
  UPDATE public.guardian_panel_codes SET consumed_at=now() WHERE token_hash=p_code_hash;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action) VALUES(c.property_id,c.phone_number,c.message_id,'panel_session_created');
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_panel_authorize(p_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('phone',s.phone_number,'propertyId',p.id,'version',p.version,'book',p.book,'role',m.role,'expiresAt',s.expires_at,
    'events',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT id,type,topic,status,message,not_before,expires_at,attempts,last_error,sent_at,created_at,evidence FROM public.guardian_events WHERE property_id=p.id ORDER BY created_at DESC LIMIT 50) e),'[]'::jsonb),
    'audit',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id,action,created_at,jsonb_build_object('kind',details->>'kind','field',details->>'field','classification',details->>'classification') details FROM public.guardian_audit WHERE property_id=p.id ORDER BY created_at DESC LIMIT 50) a),'[]'::jsonb))
  FROM public.guardian_panel_sessions s JOIN public.guardian_properties p ON p.id=s.property_id
  JOIN public.guardian_members m ON m.property_id=s.property_id AND m.phone_number=s.phone_number AND m.active
  WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now();
$$;
CREATE FUNCTION public.guardian_panel_attempt(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.guardian_panel_limits(key_hash,bucket) VALUES(p_key,date_trunc('minute',now()))
    ON CONFLICT(key_hash,bucket) DO UPDATE SET attempts=guardian_panel_limits.attempts+1 RETURNING attempts INTO n;
  DELETE FROM public.guardian_panel_limits WHERE bucket<now()-interval '1 day';
  RETURN n<=20;
END $$;
CREATE FUNCTION public.guardian_panel_replay(p_hash text,p_request uuid,p_digest text) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE WHEN r.request_hash=p_digest AND r.property_id=s.property_id THEN 'replay' ELSE 'mismatch' END
  FROM public.guardian_panel_sessions s JOIN public.guardian_members m ON m.property_id=s.property_id AND m.phone_number=s.phone_number AND m.active
  JOIN public.guardian_panel_requests r ON r.phone_number=s.phone_number AND r.request_id=p_request
  WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>now();
$$;
REVOKE ALL ON FUNCTION public.guardian_panel_replay(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_panel_replay(text,uuid,text) TO service_role;
CREATE FUNCTION public.guardian_panel_commit(p_hash text,p_version bigint,p_request uuid,p_digest text,p_kind text,p_book jsonb,p_events jsonb) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s public.guardian_panel_sessions; role text; prior public.guardian_panel_requests; v bigint; e jsonb; previous_book jsonb;
BEGIN
  SELECT * INTO s FROM public.guardian_panel_sessions WHERE token_hash=p_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||s.phone_number,0));
  SELECT version,book INTO v,previous_book FROM public.guardian_properties WHERE id=s.property_id FOR UPDATE;
  IF s.expires_at<=now() OR s.revoked_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.guardian_panel_sessions WHERE token_hash=p_hash AND revoked_at IS NULL) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  SELECT m.role INTO role FROM public.guardian_members m WHERE property_id=s.property_id AND phone_number=s.phone_number AND active FOR UPDATE;
  IF role IS NULL THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  IF p_kind NOT IN ('profile','feed_consumption','alert_rules','property_update','herd_count','herd_event','lot_transfer','lot_update','ledger','record','animal','weighing','move','task_create','task_update','delete_record')
    OR (role NOT IN ('owner','manager') AND p_kind NOT IN ('record','animal','weighing','move','task_create','task_update')) THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
  SELECT * INTO prior FROM public.guardian_panel_requests WHERE phone_number=s.phone_number AND request_id=p_request;
  IF FOUND THEN
    IF prior.property_id<>s.property_id OR prior.request_hash<>p_digest THEN RAISE EXCEPTION 'guardian_request_mismatch'; END IF;
    RETURN 'replay';
  END IF;
  IF v<>p_version THEN RETURN 'conflict'; END IF;
  UPDATE public.guardian_properties SET book=p_book,version=version+1,updated_at=now() WHERE id=s.property_id;
  UPDATE public.guardian_events ge SET status='cancelled',last_error='source_obsolete',updated_at=now()
    WHERE ge.property_id=s.property_id AND ge.type='task_due' AND ge.status IN ('pending','retry','claimed') AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_book->'tasks') t WHERE t->>'id'=ge.evidence->>'taskId' AND t->>'status'='open' AND t->>'updatedAt'=ge.evidence->>'updatedAt');
  FOR e IN SELECT value FROM jsonb_array_elements(coalesce(p_events,'[]')) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=s.property_id AND phone_number=e->>'recipient' AND active) THEN RAISE EXCEPTION 'guardian_recipient_not_member'; END IF;
    INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
    VALUES(s.property_id,e->>'recipient',e->>'type',e->>'topic',e->>'key',e->'evidence',e->>'message',(e->>'priority')::smallint,(e->>'notBefore')::timestamptz,(e->>'expiresAt')::timestamptz) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.guardian_panel_requests(phone_number,request_id,property_id,request_hash) VALUES(s.phone_number,p_request,s.property_id,p_digest);
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details)
    VALUES(s.property_id,s.phone_number,'panel:'||p_request,'panel_update',jsonb_build_object('kind',p_kind,'previousVersion',p_version,'requestId',p_request,
      'previousProfile',CASE WHEN p_kind IN ('profile','property_update') THEN previous_book->'profile' ELSE NULL END,
      'previousIdentity',CASE WHEN p_kind='property_update' THEN jsonb_build_object('name',previous_book->'name','city',previous_book->'city','uf',previous_book->'uf') ELSE NULL END,
      'removedRecords',CASE WHEN p_kind='delete_record' THEN (SELECT jsonb_agg(r) FROM jsonb_array_elements((previous_book->'records')||(previous_book->'ledger')) r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements((p_book->'records')||(p_book->'ledger')) n WHERE n->>'id'=r->>'id')) ELSE NULL END));
  RETURN 'committed';
END $$;
REVOKE ALL ON FUNCTION public.guardian_panel_issue(text,uuid,text,text),public.guardian_panel_exchange(text,text),public.guardian_panel_authorize(text),public.guardian_panel_attempt(text),public.guardian_panel_commit(text,bigint,uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_panel_issue(text,uuid,text,text),public.guardian_panel_exchange(text,text),public.guardian_panel_authorize(text),public.guardian_panel_attempt(text),public.guardian_panel_commit(text,bigint,uuid,text,text,jsonb,jsonb) TO service_role;
-- The stored official name remains nullable; only the choice label uses a provisional name.
CREATE OR REPLACE FUNCTION public.guardian_snapshot(p_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.guardian_accounts; p public.guardian_properties; r text; properties jsonb; notification jsonb;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' THEN RAISE EXCEPTION 'invalid_guardian_sender'; END IF;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=p_phone;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',coalesce(g.book->>'name','Propriedade sem nome'||CASE WHEN g.book->>'city' IS NOT NULL THEN ' — '||(g.book->>'city') ELSE '' END),'role',m.role) ORDER BY g.created_at),'[]') INTO properties
    FROM public.guardian_members m JOIN public.guardian_properties g ON g.id=m.property_id WHERE m.phone_number=p_phone AND m.active;
  SELECT m.role INTO r FROM public.guardian_members m WHERE m.property_id=a.active_property_id AND m.phone_number=p_phone AND m.active;
  IF FOUND THEN SELECT * INTO p FROM public.guardian_properties WHERE id=a.active_property_id; END IF;
  SELECT jsonb_build_object('id',e.id,'taskId',e.evidence->>'taskId','sentAt',e.sent_at) INTO notification FROM public.guardian_events e
    WHERE e.recipient=p_phone AND e.property_id=p.id AND e.status='sent' AND e.answered_at IS NULL AND e.sent_at>now()-interval '24 hours' ORDER BY e.sent_at DESC LIMIT 1;
  RETURN jsonb_build_object('accountVersion',COALESCE(a.version,0),'preferences',a.preferences,'pending',CASE WHEN r IS NOT NULL OR a.pending->'action'->>'kind'='property_create' THEN a.pending ELSE NULL END,
    'properties',properties,'active',CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'version',p.version,'role',r,'book',p.book) ELSE NULL END,'lastNotification',notification,'lastCalculation',a.last_calculation);
END $$;
REVOKE ALL ON FUNCTION public.guardian_snapshot(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_snapshot(text) TO service_role;

-- Resolve unnamed observations against all authorized operational farms, including after a context reset.
CREATE OR REPLACE FUNCTION public.guardian_observe_property(p_phone text,p_message_id text,p_source_at timestamptz,p_source_text text,p_name text,p_another boolean,p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  boundary timestamptz;
  profile uuid;
  profile_count int;
  key text;
  fact jsonb;
  added int := 0;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{6,20}$' OR length(p_message_id) NOT BETWEEN 1 AND 128
    OR p_source_at IS NULL OR p_source_at>clock_timestamp()+interval '1 minute'
    OR length(p_source_text) NOT BETWEEN 1 AND 16000 OR jsonb_typeof(p_facts) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_facts) NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'invalid_observed_property_input'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('guardian-observed:'||p_phone,0));
  boundary := public.whatsapp_context_boundary(p_phone);
  IF p_source_at<boundary THEN RETURN jsonb_build_object('status','reset','added',0); END IF;
  IF (SELECT count(DISTINCT f->>'field') FROM jsonb_array_elements(p_facts) f)<>jsonb_array_length(p_facts)
    THEN RAISE EXCEPTION 'conflicting_observed_fields'; END IF;
  FOR fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    IF fact->>'field' IS NULL OR fact->'value' IS NULL OR fact->>'quote' IS NULL
      OR position(fact->>'quote' IN p_source_text)=0 OR position('?' IN fact->>'quote')>0
      OR fact->>'effectiveDate' IS NULL OR (fact->>'effectiveDate')::date>(p_source_at AT TIME ZONE 'America/Sao_Paulo')::date
      THEN RAISE EXCEPTION 'unsupported_observed_evidence'; END IF;
  END LOOP;
  -- A retry must remain attached to its original property even if later profiles appeared.
  SELECT f.property_id INTO profile FROM public.guardian_observed_facts f
    WHERE f.phone_number=p_phone AND f.generation_start=boundary AND f.source_message_id=p_message_id LIMIT 1;
  IF profile IS NULL THEN
    IF p_name IS NULL AND (SELECT count(*) FROM public.guardian_members WHERE phone_number=p_phone AND active)>1 THEN
      RETURN jsonb_build_object('status','ambiguous_property','added',0);
    END IF;
    SELECT count(*) INTO profile_count FROM public.guardian_observed_properties p WHERE p.phone_number=p_phone AND p.generation_start=boundary;
    IF p_name IS NOT NULL THEN
      IF length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_facts) f WHERE f->>'field'='name' AND f->>'value'=p_name)
        THEN RAISE EXCEPTION 'unsupported_observed_name'; END IF;
      key := 'name:'||regexp_replace(translate(lower(btrim(p_name)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),'[^a-z0-9]+',' ','g');
      SELECT p.id INTO profile FROM public.guardian_observed_properties p WHERE p.phone_number=p_phone AND p.generation_start=boundary AND p.identity_key=key;
      IF profile IS NOT NULL AND coalesce(p_another,false) THEN RETURN jsonb_build_object('status','ambiguous_property','added',0); END IF;
      IF profile IS NULL AND profile_count=1 AND NOT coalesce(p_another,false) THEN
        SELECT p.id INTO profile FROM public.guardian_observed_properties p WHERE p.phone_number=p_phone AND p.generation_start=boundary AND p.identity_key='default';
        IF profile IS NOT NULL THEN UPDATE public.guardian_observed_properties SET identity_key=key WHERE id=profile; END IF;
      END IF;
    ELSE
      IF coalesce(p_another,false) OR profile_count>1 THEN RETURN jsonb_build_object('status','ambiguous_property','added',0); END IF;
      key := 'default';
      IF profile_count=1 THEN SELECT p.id INTO profile FROM public.guardian_observed_properties p WHERE p.phone_number=p_phone AND p.generation_start=boundary; END IF;
    END IF;
    IF profile IS NULL THEN
      INSERT INTO public.guardian_observed_properties(phone_number,generation_start,identity_key,updated_at)
        VALUES(p_phone,boundary,key,p_source_at) RETURNING id INTO profile;
    END IF;
  END IF;
  FOR fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    INSERT INTO public.guardian_observed_facts(property_id,phone_number,generation_start,field,value,source_message_id,source_excerpt,source_question,source_at,effective_date)
      VALUES(profile,p_phone,boundary,fact->>'field',fact->'value',p_message_id,fact->>'quote',fact->>'question',p_source_at,(fact->>'effectiveDate')::date)
      ON CONFLICT (phone_number,generation_start,source_message_id,field) DO NOTHING;
    IF FOUND THEN added := added+1; END IF;
  END LOOP;
  IF added>0 THEN UPDATE public.guardian_observed_properties SET updated_at=greatest(updated_at,p_source_at) WHERE id=profile; END IF;
  RETURN jsonb_build_object('status','saved','propertyId',profile,'added',added);
END;
$$;

NOTIFY pgrst,'reload schema';
