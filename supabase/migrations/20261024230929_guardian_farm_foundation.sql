-- Additive, opt-in foundation. No production data is copied into a farm implicitly.
CREATE TABLE public.guardian_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  book jsonb NOT NULL CHECK (book->>'schema' = '1' AND jsonb_typeof(book->'animals') = 'array' AND jsonb_typeof(book->'tasks') = 'array' AND jsonb_typeof(book->'ledger') = 'array' AND jsonb_typeof(book->'records') = 'array' AND length(book->>'name') BETWEEN 1 AND 160 AND octet_length(book::text) <= 10000000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guardian_properties ADD CONSTRAINT guardian_book_required_fields CHECK (
  book ?& ARRAY['schema','name','city','uf','profile','animals','tasks','ledger','records']
  AND jsonb_typeof(book->'profile')='object' AND jsonb_typeof(book->'name')='string'
  AND jsonb_typeof(book->'city')='string' AND jsonb_typeof(book->'uf')='string'
  AND length(book->>'city') BETWEEN 1 AND 160 AND book->>'uf' ~ '^[A-Z]{2}$'
);
CREATE TABLE public.guardian_accounts (
  phone_number text PRIMARY KEY CHECK (phone_number ~ '^[0-9]{6,20}$'),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  version bigint NOT NULL DEFAULT 0,
  active_property_id uuid REFERENCES public.guardian_properties(id) ON DELETE SET NULL,
  preferences jsonb NOT NULL DEFAULT '{"enabled":false,"consentAt":null,"consentMessageId":null,"timeZone":"America/Sao_Paulo","startHour":8,"endHour":20,"maxPerDay":2,"minIntervalMinutes":120,"topics":["tasks","weather","health","performance"]}'::jsonb,
  pending jsonb,
  last_calculation jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(preferences::text) < 8000 AND (pending IS NULL OR octet_length(pending::text) < 12000)),
  CHECK (NOT (preferences->>'enabled')::boolean OR (preferences->>'consentAt' IS NOT NULL AND preferences->>'consentMessageId' IS NOT NULL))
);
CREATE TABLE public.guardian_members (
  property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  phone_number text NOT NULL CHECK (phone_number ~ '^[0-9]{6,20}$'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','worker','technician')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(property_id,phone_number)
);
CREATE INDEX guardian_members_user_idx ON public.guardian_members(user_id,property_id) WHERE active;
CREATE INDEX guardian_members_phone_idx ON public.guardian_members(phone_number,property_id) WHERE active;
CREATE INDEX guardian_accounts_property_idx ON public.guardian_accounts(active_property_id) WHERE active_property_id IS NOT NULL;
CREATE TABLE public.guardian_invitations (
  token_hash text PRIMARY KEY, property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  phone_number text NOT NULL, role text NOT NULL CHECK (role IN ('manager','worker','technician')),
  expires_at timestamptz NOT NULL, accepted_at timestamptz,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guardian_web_links (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE INDEX guardian_invitations_property_idx ON public.guardian_invitations(property_id,phone_number);
CREATE INDEX guardian_web_links_user_idx ON public.guardian_web_links(user_id,expires_at);
CREATE TABLE public.guardian_turn_receipts (
  phone_number text NOT NULL, message_id text NOT NULL,
  property_id uuid REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  reply text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(phone_number,message_id)
);
CREATE TABLE public.guardian_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  actor text NOT NULL, message_id text NOT NULL, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_receipts_property_idx ON public.guardian_turn_receipts(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX guardian_audit_property_idx ON public.guardian_audit(property_id,created_at DESC);
CREATE TABLE public.guardian_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  recipient text NOT NULL, type text NOT NULL CHECK(type IN ('task_due','weather_alert','health_followup','performance_change','financial_record','report')),
  topic text NOT NULL CHECK(topic IN ('tasks','weather','health','performance','finance','reports')),
  dedupe_key text NOT NULL CHECK(length(dedupe_key) BETWEEN 1 AND 300),
  evidence jsonb NOT NULL, message text NOT NULL CHECK(length(message) BETWEEN 1 AND 3200),
  priority smallint NOT NULL CHECK(priority BETWEEN 1 AND 5),
  not_before timestamptz NOT NULL, expires_at timestamptz NOT NULL, available_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','dispatching','retry','sent','cancelled','expired','failed','uncertain')),
  attempts integer NOT NULL DEFAULT 0, lock_token uuid, claimed_at timestamptz, sent_at timestamptz, answered_at timestamptz,
  provider_message_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id,recipient,dedupe_key), CHECK(expires_at > not_before)
);
CREATE INDEX guardian_events_due_idx ON public.guardian_events(not_before,available_at,priority DESC) WHERE status IN ('pending','retry');
CREATE INDEX guardian_events_recipient_idx ON public.guardian_events(recipient,sent_at DESC);
CREATE TABLE public.guardian_event_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, event_id uuid NOT NULL REFERENCES public.guardian_events(id) ON DELETE CASCADE,
  status text NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_event_history_event_idx ON public.guardian_event_history(event_id,created_at);

-- All writes go through a server-only, validated sender or authenticated server function.
ALTER TABLE public.guardian_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_web_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_turn_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_event_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_properties,public.guardian_accounts,public.guardian_members,public.guardian_invitations,public.guardian_web_links,public.guardian_turn_receipts,public.guardian_audit,public.guardian_events,public.guardian_event_history FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guardian_properties,public.guardian_accounts,public.guardian_members,public.guardian_invitations,public.guardian_web_links,public.guardian_turn_receipts,public.guardian_audit,public.guardian_events,public.guardian_event_history TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.guardian_event_history_id_seq TO service_role;
GRANT SELECT ON public.guardian_properties,public.guardian_members,public.guardian_accounts,public.guardian_audit,public.guardian_events TO authenticated;
CREATE POLICY guardian_members_read ON public.guardian_members FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR (SELECT public.has_role(auth.uid(),'admin')));
CREATE POLICY guardian_accounts_read ON public.guardian_accounts FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) OR (SELECT public.has_role(auth.uid(),'admin')));
CREATE POLICY guardian_properties_read ON public.guardian_properties FOR SELECT TO authenticated USING (
  (SELECT public.has_role(auth.uid(),'admin')) OR EXISTS(SELECT 1 FROM public.guardian_members m WHERE m.property_id=id AND m.user_id=(SELECT auth.uid()) AND m.active)
);
CREATE POLICY guardian_events_read ON public.guardian_events FOR SELECT TO authenticated USING (
  (SELECT public.has_role(auth.uid(),'admin')) OR EXISTS(SELECT 1 FROM public.guardian_members m WHERE m.property_id=guardian_events.property_id AND m.user_id=(SELECT auth.uid()) AND m.active)
);
CREATE POLICY guardian_audit_read ON public.guardian_audit FOR SELECT TO authenticated USING (
  (SELECT public.has_role(auth.uid(),'admin')) OR EXISTS(SELECT 1 FROM public.guardian_members m WHERE m.property_id=guardian_audit.property_id AND m.user_id=(SELECT auth.uid()) AND m.active)
);

CREATE FUNCTION public.guardian_snapshot(p_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.guardian_accounts; p public.guardian_properties; r text; properties jsonb; notification jsonb;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' THEN RAISE EXCEPTION 'invalid_guardian_sender'; END IF;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=p_phone;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',g.book->>'name','role',m.role) ORDER BY g.created_at),'[]') INTO properties
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

CREATE FUNCTION public.guardian_commit_turn(
  p_phone text,p_message_id text,p_account_version bigint,p_property_id uuid,p_property_version bigint,
  p_operation text,p_book jsonb,p_pending jsonb,p_preferences jsonb,p_details jsonb,p_reply text,p_events jsonb
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.guardian_accounts; prior public.guardian_turn_receipts; r text; v bigint; active_id uuid; inv public.guardian_invitations; link public.guardian_web_links; e jsonb; task jsonb;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' OR length(p_message_id) NOT BETWEEN 1 AND 128 OR length(p_reply) NOT BETWEEN 1 AND 120000
    OR p_operation NOT IN ('noop','pending','clear','create','update','select','preferences','invite','accept','revoke','delete','link','calculation')
    OR jsonb_array_length(COALESCE(p_events,'[]'))>100 OR octet_length(COALESCE(p_details,'{}')::text)>20000 THEN RAISE EXCEPTION 'invalid_guardian_turn'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
  SELECT * INTO prior FROM public.guardian_turn_receipts WHERE phone_number=p_phone AND message_id=p_message_id;
  IF FOUND THEN
    IF prior.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=prior.property_id AND phone_number=p_phone AND active) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
    RETURN 'replay:'||prior.reply;
  END IF;
  INSERT INTO public.guardian_accounts(phone_number) VALUES(p_phone) ON CONFLICT DO NOTHING;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=p_phone FOR UPDATE;
  IF a.version<>p_account_version THEN RETURN 'conflict'; END IF;
  active_id:=a.active_property_id;
  IF p_operation NOT IN ('create','accept','preferences','link') AND p_property_id IS NOT NULL THEN
    -- Lock the property before membership so shared edits/revocations use one lock order.
    SELECT version INTO v FROM public.guardian_properties WHERE id=p_property_id FOR UPDATE;
    SELECT role INTO r FROM public.guardian_members WHERE property_id=p_property_id AND phone_number=p_phone AND active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
    IF p_property_version IS NOT NULL AND v<>p_property_version THEN RETURN 'conflict'; END IF;
  END IF;
  IF p_operation='create' THEN
    IF (SELECT count(*) FROM public.guardian_members WHERE phone_number=p_phone AND active AND role='owner')>=100 THEN RAISE EXCEPTION 'guardian_capacity'; END IF;
    INSERT INTO public.guardian_properties(id,book) VALUES(p_property_id,p_book);
    INSERT INTO public.guardian_members(property_id,phone_number,user_id,role) VALUES(p_property_id,p_phone,a.user_id,'owner'); active_id:=p_property_id;
  ELSIF p_operation='update' THEN
    IF r IS NULL OR (r NOT IN ('owner','manager') AND p_details->>'kind' NOT IN ('record','animal','weighing','move','task_create','task_update')) THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
    UPDATE public.guardian_properties SET book=p_book,version=version+1,updated_at=now() WHERE id=p_property_id;
    -- Cancel tasks completed/replanned since this evidence was generated, including already claimed work.
    UPDATE public.guardian_events ge SET status='cancelled',last_error='source_obsolete',updated_at=now() WHERE ge.property_id=p_property_id AND ge.type='task_due' AND ge.status IN ('pending','retry','claimed') AND NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_book->'tasks') t WHERE t->>'id'=ge.evidence->>'taskId' AND t->>'status'='open' AND t->>'updatedAt'=ge.evidence->>'updatedAt'
    );
  ELSIF p_operation='select' THEN active_id:=p_property_id;
  ELSIF p_operation='preferences' THEN
    IF p_preferences IS NULL OR jsonb_typeof(p_preferences->'topics')<>'array' OR (p_preferences->>'startHour')::int NOT BETWEEN 0 AND 23
      OR (p_preferences->>'endHour')::int NOT BETWEEN 1 AND 24 OR (p_preferences->>'startHour')::int >= (p_preferences->>'endHour')::int
      OR (p_preferences->>'maxPerDay')::int NOT BETWEEN 1 AND 10 OR (p_preferences->>'minIntervalMinutes')::int NOT BETWEEN 30 AND 1440
      OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_preferences->>'timeZone') THEN RAISE EXCEPTION 'invalid_guardian_preferences'; END IF;
    UPDATE public.guardian_accounts SET preferences=p_preferences WHERE phone_number=p_phone;
    IF NOT (p_preferences->>'enabled')::boolean THEN UPDATE public.guardian_events SET status='cancelled',last_error='consent_revoked',updated_at=now() WHERE recipient=p_phone AND status IN ('pending','retry','claimed'); END IF;
  ELSIF p_operation='invite' THEN
    IF r NOT IN ('owner','manager') OR r IS NULL THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
    IF p_details->>'phone' !~ '^[0-9]{10,15}$' OR p_details->>'role' NOT IN ('manager','worker','technician') OR p_details->>'token' !~ '^[a-f0-9]{32}$' THEN RAISE EXCEPTION 'invalid_guardian_invitation'; END IF;
    INSERT INTO public.guardian_invitations(token_hash,property_id,phone_number,role,expires_at,created_by)
      VALUES(encode(sha256(convert_to(p_details->>'token','UTF8')),'hex'),p_property_id,p_details->>'phone',p_details->>'role',now()+interval '7 days',p_phone);
  ELSIF p_operation='accept' THEN
    SELECT * INTO inv FROM public.guardian_invitations WHERE token_hash=encode(sha256(convert_to(p_details->>'token','UTF8')),'hex') AND phone_number=p_phone AND accepted_at IS NULL AND expires_at>now();
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_guardian_invitation'; END IF;
    PERFORM 1 FROM public.guardian_properties WHERE id=inv.property_id FOR UPDATE;
    SELECT * INTO inv FROM public.guardian_invitations WHERE token_hash=inv.token_hash AND phone_number=p_phone AND accepted_at IS NULL AND expires_at>now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_guardian_invitation'; END IF;
    INSERT INTO public.guardian_members(property_id,phone_number,user_id,role) VALUES(inv.property_id,p_phone,a.user_id,inv.role)
      ON CONFLICT(property_id,phone_number) DO UPDATE SET active=true,user_id=EXCLUDED.user_id,role=CASE WHEN guardian_members.role='owner' THEN 'owner' ELSE EXCLUDED.role END;
    UPDATE public.guardian_invitations SET accepted_at=now() WHERE token_hash=inv.token_hash; active_id:=inv.property_id;
  ELSIF p_operation='revoke' THEN
    IF r IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
    IF EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=p_property_id AND phone_number=p_details->>'phone' AND role='owner') THEN RAISE EXCEPTION 'cannot_revoke_owner'; END IF;
    UPDATE public.guardian_members SET active=false WHERE property_id=p_property_id AND phone_number=p_details->>'phone';
    DELETE FROM public.guardian_invitations WHERE property_id=p_property_id AND phone_number=p_details->>'phone' AND accepted_at IS NULL;
    UPDATE public.guardian_events SET status='cancelled',last_error='access_revoked',updated_at=now() WHERE property_id=p_property_id AND recipient=p_details->>'phone' AND status IN ('pending','retry','claimed');
  ELSIF p_operation='delete' THEN
    IF r IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
    DELETE FROM public.guardian_properties WHERE id=p_property_id; active_id:=NULL;
  ELSIF p_operation='link' THEN
    SELECT * INTO link FROM public.guardian_web_links WHERE token_hash=encode(sha256(convert_to(p_details->>'token','UTF8')),'hex') AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_guardian_web_link'; END IF;
    IF a.user_id IS NOT NULL AND a.user_id<>link.user_id THEN RAISE EXCEPTION 'guardian_already_linked'; END IF;
    UPDATE public.guardian_accounts SET user_id=link.user_id WHERE phone_number=p_phone;
    UPDATE public.guardian_members SET user_id=link.user_id WHERE phone_number=p_phone;
    UPDATE public.guardian_web_links SET consumed_at=now() WHERE token_hash=link.token_hash;
  ELSIF p_operation='calculation' THEN
    UPDATE public.guardian_accounts SET last_calculation=p_details->'calculation' WHERE phone_number=p_phone;
  END IF;
  IF p_operation IN ('update','create') THEN
    FOR e IN SELECT value FROM jsonb_array_elements(COALESCE(p_events,'[]')) LOOP
      IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=p_property_id AND phone_number=e->>'recipient' AND active) THEN RAISE EXCEPTION 'guardian_recipient_not_member'; END IF;
      INSERT INTO public.guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at)
        VALUES(p_property_id,e->>'recipient',e->>'type',e->>'topic',e->>'key',e->'evidence',e->>'message',(e->>'priority')::smallint,(e->>'notBefore')::timestamptz,(e->>'expiresAt')::timestamptz) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  UPDATE public.guardian_accounts SET active_property_id=active_id,pending=p_pending,version=version+1,updated_at=now() WHERE phone_number=p_phone;
  IF p_details->>'replyToEventId' IS NOT NULL THEN UPDATE public.guardian_events SET answered_at=now() WHERE id=(p_details->>'replyToEventId')::uuid AND recipient=p_phone; END IF;
  IF p_operation NOT IN ('noop','pending','clear','delete') THEN INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES(CASE WHEN p_operation IN ('preferences','link') THEN NULL ELSE active_id END,p_phone,p_message_id,p_operation,COALESCE(p_details,'{}')-'token'); END IF;
  INSERT INTO public.guardian_turn_receipts(phone_number,message_id,property_id,reply) VALUES(p_phone,p_message_id,CASE WHEN p_operation='delete' THEN NULL ELSE active_id END,p_reply);
  RETURN 'committed';
END $$;
REVOKE ALL ON FUNCTION public.guardian_commit_turn(text,text,bigint,uuid,bigint,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_commit_turn(text,text,bigint,uuid,bigint,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) TO service_role;

-- Legacy daily slots have no verifiable event/consent. Keep history, stop their delivery.
ALTER TABLE public.whatsapp_followup_profiles ALTER COLUMN followups_enabled SET DEFAULT false;
UPDATE public.whatsapp_followup_profiles SET followups_enabled=false;
UPDATE public.whatsapp_proactive_queue SET status='skipped',last_error='replaced_by_opt_in_guardian_events',updated_at=now() WHERE status IN ('pending','processing','failed');
