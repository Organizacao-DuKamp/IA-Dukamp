-- Existing properties remain accessible; new observed books are provisional until registration.
ALTER TABLE public.guardian_properties ADD COLUMN registration_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.guardian_properties ALTER COLUMN registration_required SET DEFAULT true;

CREATE TABLE public.guardian_farm_registrations (
  property_id uuid PRIMARY KEY REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  producer_name text NOT NULL CHECK(length(trim(producer_name)) BETWEEN 2 AND 160),
  property_name text NOT NULL CHECK(length(trim(property_name)) BETWEEN 2 AND 160),
  tax_document text NOT NULL CHECK(tax_document ~ '^([0-9]{11}|[A-Z0-9]{12}[0-9]{2})$'),
  state_registration text NOT NULL CHECK(state_registration ~ '^[A-Z0-9]{2,20}$' AND state_registration ~ '[0-9]'),
  municipality text NOT NULL CHECK(length(trim(municipality)) BETWEEN 2 AND 160),
  uf text NOT NULL CHECK(uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  municipality_id integer NOT NULL CHECK(municipality_id BETWEEN 1100000 AND 5399999),
  email text NOT NULL CHECK(length(email)<=254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  annual_revenue_cents bigint NOT NULL CHECK(annual_revenue_cents BETWEEN 0 AND 100000000000000),
  producer_size text GENERATED ALWAYS AS (CASE WHEN annual_revenue_cents<=50000000 THEN 'small' WHEN annual_revenue_cents<=350000000 THEN 'medium' ELSE 'large' END) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guardian_farm_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_farm_registrations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.guardian_farm_registrations TO service_role;

-- The same transaction creates/completes a property and its restricted registration.
-- Keep cross-property writes, audits and replay authorization on the edited property.
-- Preserve the selected property, transaction locks, version checks, RLS and all grants.
CREATE OR REPLACE FUNCTION public.guardian_commit_turn(
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
  IF p_details ? 'registration' THEN
    IF p_operation NOT IN ('create','select') OR (p_operation='select' AND (r IS DISTINCT FROM 'owner' OR NOT EXISTS(SELECT 1 FROM public.guardian_properties WHERE id=p_property_id AND registration_required))) THEN
      RAISE EXCEPTION 'guardian_registration_denied';
    END IF;
    INSERT INTO public.guardian_farm_registrations(property_id,producer_name,property_name,tax_document,state_registration,municipality,uf,municipality_id,email,annual_revenue_cents)
    SELECT p_property_id,j->>'producer',j->>'name',j->>'document',j->>'stateRegistration',j->>'city',j->>'uf',(j->>'municipalityId')::integer,j->>'email',(j->>'annualRevenueCents')::bigint FROM (SELECT p_details->'registration' j) d;
    UPDATE public.guardian_properties SET registration_required=false,
      book=book||jsonb_build_object('name',p_details->'registration'->>'name','city',p_details->'registration'->>'city','uf',p_details->'registration'->>'uf'),
      version=version+CASE WHEN p_operation='select' THEN 1 ELSE 0 END,updated_at=now()
      WHERE id=p_property_id;
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
  IF p_operation NOT IN ('noop','pending','clear','delete') THEN INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES(CASE WHEN p_operation IN ('preferences','link') THEN NULL WHEN p_operation='update' THEN p_property_id ELSE active_id END,p_phone,p_message_id,p_operation,COALESCE(p_details,'{}')-'token'-'registration'); END IF;
  INSERT INTO public.guardian_turn_receipts(phone_number,message_id,property_id,reply) VALUES(p_phone,p_message_id,CASE WHEN p_operation='delete' THEN NULL WHEN p_operation='update' THEN p_property_id ELSE active_id END,p_reply);
  RETURN 'committed';
END $$;
REVOKE ALL ON FUNCTION public.guardian_commit_turn(text,text,bigint,uuid,bigint,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_commit_turn(text,text,bigint,uuid,bigint,text,jsonb,jsonb,jsonb,jsonb,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_snapshot(p_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.guardian_accounts; p public.guardian_properties; r text; properties jsonb; notification jsonb;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' THEN RAISE EXCEPTION 'invalid_guardian_sender'; END IF;
  SELECT * INTO a FROM public.guardian_accounts WHERE phone_number=p_phone;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',coalesce(g.book->>'name','Propriedade sem nome'||CASE WHEN g.book->>'city' IS NOT NULL THEN ' — '||(g.book->>'city') ELSE '' END),'role',m.role,'registrationRequired',g.registration_required) ORDER BY g.created_at),'[]') INTO properties
    FROM public.guardian_members m JOIN public.guardian_properties g ON g.id=m.property_id WHERE m.phone_number=p_phone AND m.active;
  SELECT m.role INTO r FROM public.guardian_members m WHERE m.property_id=a.active_property_id AND m.phone_number=p_phone AND m.active;
  IF FOUND THEN SELECT * INTO p FROM public.guardian_properties WHERE id=a.active_property_id; END IF;
  SELECT jsonb_build_object('id',e.id,'taskId',e.evidence->>'taskId','sentAt',e.sent_at) INTO notification FROM public.guardian_events e
    WHERE e.recipient=p_phone AND e.property_id=p.id AND e.status='sent' AND e.answered_at IS NULL AND e.sent_at>now()-interval '24 hours' ORDER BY e.sent_at DESC LIMIT 1;
  RETURN jsonb_build_object('accountVersion',COALESCE(a.version,0),'preferences',a.preferences,'pending',CASE WHEN r IS NOT NULL OR a.pending->'action'->>'kind'='property_create' OR a.pending ? 'farmDraft' THEN a.pending ELSE NULL END,
    'properties',properties,'active',CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'version',p.version,'role',r,'book',p.book) ELSE NULL END,'lastNotification',notification,'lastCalculation',a.last_calculation);
END $$;

-- Protect every route that issues access, including legacy codes, invites and sessions.
CREATE FUNCTION public.guardian_require_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.guardian_properties WHERE id=NEW.property_id AND registration_required) THEN
    RAISE EXCEPTION 'guardian_registration_required';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guardian_require_registration() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_require_registration() TO service_role;
CREATE TRIGGER guardian_registration_link BEFORE INSERT ON public.guardian_access_links FOR EACH ROW EXECUTE FUNCTION public.guardian_require_registration();
CREATE TRIGGER guardian_registration_code BEFORE INSERT ON public.guardian_panel_codes FOR EACH ROW EXECUTE FUNCTION public.guardian_require_registration();
CREATE TRIGGER guardian_registration_session BEFORE INSERT ON public.guardian_panel_sessions FOR EACH ROW EXECUTE FUNCTION public.guardian_require_registration();
