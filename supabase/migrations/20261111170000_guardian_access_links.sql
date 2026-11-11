ALTER TABLE public.guardian_members ADD COLUMN access_revoked_at timestamptz;

-- One-use login/invitation links. Only the server can issue or exchange them.
CREATE TABLE public.guardian_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (kind IN ('login','invite')),
  property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  created_by text NOT NULL CHECK (created_by ~ '^[0-9]{6,20}$'),
  message_id text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  consumed_at timestamptz, accepted_by text, accepted_message text, revoked_at timestamptz,
  UNIQUE (created_by,message_id), CHECK (expires_at>created_at)
);
CREATE INDEX guardian_access_links_property ON public.guardian_access_links(property_id,kind,expires_at);
ALTER TABLE public.guardian_access_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_access_links FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guardian_access_links TO service_role;

-- Web and installed sessions both persist and renew. Membership is checked on every request.
ALTER TABLE public.guardian_panel_sessions DROP CONSTRAINT guardian_panel_session_duration;
ALTER TABLE public.guardian_panel_sessions ADD CONSTRAINT guardian_panel_session_duration
  CHECK (expires_at <= last_renewed_at + interval '365 days');
CREATE OR REPLACE FUNCTION public.guardian_panel_exchange_mode(p_code_hash text,p_session_hash text,p_installed boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.guardian_panel_exchange(p_code_hash,p_session_hash) THEN RETURN false; END IF;
  UPDATE public.guardian_panel_sessions SET installed=p_installed,last_renewed_at=now(),expires_at=now()+interval '365 days' WHERE token_hash=p_session_hash;
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.guardian_panel_authorize_mode(p_hash text,p_installed boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity jsonb; renewed timestamptz;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.guardian_panel_sessions WHERE token_hash=p_hash AND installed=p_installed AND revoked_at IS NULL AND expires_at>now()) THEN RETURN NULL; END IF;
  identity:=public.guardian_panel_authorize(p_hash);
  IF identity IS NULL THEN RETURN NULL; END IF;
  UPDATE public.guardian_panel_sessions SET last_renewed_at=now(),expires_at=now()+interval '365 days'
    WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() RETURNING expires_at INTO renewed;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_set(identity,'{expiresAt}',to_jsonb(renewed));
END $$;

CREATE FUNCTION public.guardian_access_issue(p_phone text,p_property uuid,p_message text,p_hash text,p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE prior public.guardian_access_links; n int;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' OR p_message IS NULL OR length(p_message) NOT BETWEEN 1 AND 128 OR p_hash !~ '^[a-f0-9]{64}$' OR p_kind NOT IN ('login','invite') THEN RAISE EXCEPTION 'invalid_guardian_link'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
  PERFORM 1 FROM public.guardian_properties WHERE id=p_property FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=p_property AND phone_number=p_phone AND active AND (p_kind='login' OR role='owner')) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  SELECT * INTO prior FROM public.guardian_access_links WHERE created_by=p_phone AND message_id=p_message;
  IF FOUND THEN RETURN prior.property_id=p_property AND prior.kind=p_kind AND prior.token_hash=p_hash AND prior.revoked_at IS NULL AND prior.consumed_at IS NULL AND prior.expires_at>now(); END IF;
  SELECT count(*) INTO n FROM public.guardian_access_links WHERE created_by=p_phone AND created_at>now()-interval '10 minutes';
  IF n>=5 THEN RAISE EXCEPTION 'guardian_code_rate_limited'; END IF;
  INSERT INTO public.guardian_access_links(token_hash,kind,property_id,created_by,message_id,expires_at)
    VALUES(p_hash,p_kind,p_property,p_phone,p_message,now()+CASE WHEN p_kind='login' THEN interval '10 minutes' ELSE interval '7 days' END);
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES(p_property,p_phone,p_message,'access_link_issued',jsonb_build_object('kind',p_kind));
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_access_exchange(p_hash text,p_session text,p_installed boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE l public.guardian_access_links;
BEGIN
  IF p_hash !~ '^[a-f0-9]{64}$' OR p_session !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT * INTO l FROM public.guardian_access_links WHERE token_hash=p_hash AND kind='login';
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=l.property_id FOR UPDATE;
  SELECT * INTO l FROM public.guardian_access_links WHERE token_hash=p_hash AND kind='login' AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=l.property_id AND phone_number=l.created_by AND active) THEN RETURN false; END IF;
  INSERT INTO public.guardian_panel_sessions(token_hash,phone_number,property_id,installed,last_renewed_at,expires_at)
    VALUES(p_session,l.created_by,l.property_id,p_installed,now(),now()+interval '365 days');
  UPDATE public.guardian_access_links SET consumed_at=now() WHERE id=l.id;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action) VALUES(l.property_id,l.created_by,l.message_id,'panel_session_created');
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_access_accept(p_hash text,p_phone text,p_message text,p_login_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE l public.guardian_access_links; employees jsonb; person jsonb; employee_id text;
BEGIN
  IF p_phone !~ '^[0-9]{10,15}$' OR p_hash !~ '^[a-f0-9]{64}$' OR p_login_hash !~ '^[a-f0-9]{64}$' OR p_message IS NULL OR length(p_message) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'invalid_guardian_link'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
  SELECT * INTO l FROM public.guardian_access_links WHERE token_hash=p_hash AND kind='invite';
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=l.property_id FOR UPDATE;
  SELECT * INTO l FROM public.guardian_access_links WHERE token_hash=p_hash AND kind='invite' AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=l.property_id AND phone_number=l.created_by AND active AND role='owner') THEN RETURN NULL; END IF;
  IF l.consumed_at IS NOT NULL THEN
    IF l.accepted_by=p_phone AND l.accepted_message=p_message AND EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=l.property_id AND phone_number=p_phone AND active)
      AND EXISTS(SELECT 1 FROM public.guardian_access_links WHERE created_by=p_phone AND message_id=p_message AND token_hash=p_login_hash AND revoked_at IS NULL AND consumed_at IS NULL AND expires_at>now()) THEN RETURN l.property_id; END IF;
    RETURN NULL;
  END IF;
  IF EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=l.property_id AND phone_number=p_phone AND (active OR role='owner')) THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=l.property_id AND phone_number=p_phone AND access_revoked_at>=l.created_at) THEN RETURN NULL; END IF;
  INSERT INTO public.guardian_accounts(phone_number) VALUES(p_phone) ON CONFLICT DO NOTHING;
  INSERT INTO public.guardian_members(property_id,phone_number,user_id,role) SELECT l.property_id,p_phone,user_id,'manager' FROM public.guardian_accounts WHERE phone_number=p_phone
    ON CONFLICT(property_id,phone_number) DO UPDATE SET active=true,user_id=EXCLUDED.user_id,role=CASE WHEN guardian_members.role='owner' THEN 'owner' ELSE 'manager' END;
  UPDATE public.guardian_accounts SET active_property_id=l.property_id,version=version+1,pending=NULL,updated_at=now() WHERE phone_number=p_phone;
  SELECT coalesce(book->'employees','[]'::jsonb) INTO employees FROM public.guardian_properties WHERE id=l.property_id;
  SELECT value INTO person FROM jsonb_array_elements(employees) WHERE value->>'phone'=p_phone LIMIT 1;
  employee_id:=coalesce(person->>'id',substr(encode(sha256(convert_to(l.property_id::text||':'||p_phone,'UTF8')),'hex'),1,20));
  person:=coalesce(person,jsonb_build_object('id',employee_id,'name','Funcionário '||right(p_phone,4),'job','Funcionário','phone',p_phone))||'{"active":true}'::jsonb;
  SELECT coalesce(jsonb_agg(value),'[]'::jsonb) INTO employees FROM jsonb_array_elements(employees) WHERE value->>'phone' IS DISTINCT FROM p_phone;
  IF jsonb_array_length(employees)>=1000 THEN RAISE EXCEPTION 'guardian_capacity'; END IF;
  UPDATE public.guardian_properties SET book=jsonb_set(book,'{employees}',employees||jsonb_build_array(person)),version=version+1,updated_at=now() WHERE id=l.property_id;
  INSERT INTO public.guardian_access_links(token_hash,kind,property_id,created_by,message_id,expires_at)
    VALUES(p_login_hash,'login',l.property_id,p_phone,p_message,now()+interval '10 minutes');
  UPDATE public.guardian_access_links SET consumed_at=now(),accepted_by=p_phone,accepted_message=p_message WHERE id=l.id;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES(l.property_id,p_phone,p_message,'invite_link_accepted',jsonb_build_object('invitedBy',l.created_by,'role','manager'));
  RETURN l.property_id;
END $$;

-- Covers both the existing WhatsApp revocation and panel revocation. Rejoining
-- never resurrects a revoked cookie, personal link, or old invitation.
CREATE FUNCTION public.guardian_access_member_revoked() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF OLD.active AND NOT NEW.active THEN
    UPDATE public.guardian_members SET access_revoked_at=now() WHERE property_id=NEW.property_id AND phone_number=NEW.phone_number;
    UPDATE public.guardian_panel_sessions SET revoked_at=now() WHERE property_id=NEW.property_id AND phone_number=NEW.phone_number AND revoked_at IS NULL;
    UPDATE public.guardian_panel_codes SET consumed_at=now() WHERE property_id=NEW.property_id AND phone_number=NEW.phone_number AND consumed_at IS NULL;
    UPDATE public.guardian_access_links SET revoked_at=now() WHERE property_id=NEW.property_id AND created_by=NEW.phone_number AND revoked_at IS NULL;
    UPDATE public.guardian_invitations SET expires_at=least(expires_at,now()) WHERE property_id=NEW.property_id AND phone_number=NEW.phone_number AND accepted_at IS NULL;
    UPDATE public.guardian_events SET status='cancelled',last_error='access_revoked',updated_at=now() WHERE property_id=NEW.property_id AND recipient=NEW.phone_number AND status IN ('pending','retry','claimed');
    UPDATE public.guardian_properties SET book=jsonb_set(book,'{employees}',coalesce((SELECT jsonb_agg(CASE WHEN e->>'phone'=NEW.phone_number THEN e||'{"active":false}'::jsonb ELSE e END) FROM jsonb_array_elements(coalesce(book->'employees','[]'::jsonb)) e),'[]'::jsonb)),version=version+1,updated_at=now() WHERE id=NEW.property_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardian_access_member_revoked AFTER UPDATE OF active ON public.guardian_members FOR EACH ROW EXECUTE FUNCTION public.guardian_access_member_revoked();

CREATE FUNCTION public.guardian_access_team(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i jsonb; property uuid;
BEGIN
  i:=public.guardian_panel_authorize(p_session);
  IF i IS NULL OR i->>'role'<>'owner' THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  property:=(i->>'propertyId')::uuid;
  RETURN jsonb_build_object('members',coalesce((SELECT jsonb_agg(jsonb_build_object('phone',m.phone_number,'role',m.role,'active',m.active,'name',(SELECT e->>'name' FROM jsonb_array_elements(coalesce(i->'book'->'employees','[]'::jsonb)) e WHERE e->>'phone'=m.phone_number LIMIT 1)) ORDER BY m.created_at) FROM public.guardian_members m WHERE m.property_id=property),'[]'::jsonb),
    'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'expiresAt',expires_at) ORDER BY created_at) FROM public.guardian_access_links WHERE property_id=property AND kind='invite' AND revoked_at IS NULL AND consumed_at IS NULL AND expires_at>now()),'[]'::jsonb));
END $$;
CREATE FUNCTION public.guardian_access_revoke(p_session text,p_phone text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i jsonb; property uuid;
BEGIN
  SELECT property_id INTO property FROM public.guardian_panel_sessions WHERE token_hash=p_session;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=property FOR UPDATE;
  i:=public.guardian_panel_authorize(p_session);
  IF i IS NULL OR i->>'role'<>'owner' OR p_phone=i->>'phone' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=property AND phone_number=p_phone AND role='owner') THEN RETURN false; END IF;
  UPDATE public.guardian_members SET active=false WHERE property_id=property AND phone_number=p_phone AND active;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES(property,i->>'phone',gen_random_uuid()::text,'revoke',jsonb_build_object('phone',p_phone,'source','panel'));
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_access_cancel(p_session text,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i jsonb; property uuid;
BEGIN
  SELECT property_id INTO property FROM public.guardian_panel_sessions WHERE token_hash=p_session;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=property FOR UPDATE;
  i:=public.guardian_panel_authorize(p_session);
  IF i IS NULL OR i->>'role'<>'owner' THEN RETURN false; END IF;
  UPDATE public.guardian_access_links SET revoked_at=now() WHERE id=p_id AND property_id=property AND kind='invite' AND consumed_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action) VALUES(property,i->>'phone',gen_random_uuid()::text,'invite_link_cancelled');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_access_issue(text,uuid,text,text,text),public.guardian_access_exchange(text,text,boolean),public.guardian_access_accept(text,text,text,text),public.guardian_access_member_revoked(),public.guardian_access_team(text),public.guardian_access_revoke(text,text),public.guardian_access_cancel(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_access_issue(text,uuid,text,text,text),public.guardian_access_exchange(text,text,boolean),public.guardian_access_accept(text,text,text,text),public.guardian_access_member_revoked(),public.guardian_access_team(text),public.guardian_access_revoke(text,text),public.guardian_access_cancel(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_panel_revoke_sessions(p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity jsonb;
BEGIN
  identity:=public.guardian_panel_authorize(p_hash);
  IF identity IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=(identity->>'propertyId')::uuid FOR UPDATE;
  UPDATE public.guardian_panel_codes SET consumed_at=now() WHERE phone_number=identity->>'phone' AND property_id=(identity->>'propertyId')::uuid AND consumed_at IS NULL;
  UPDATE public.guardian_access_links SET revoked_at=now() WHERE created_by=identity->>'phone' AND property_id=(identity->>'propertyId')::uuid AND kind='login' AND revoked_at IS NULL;
  UPDATE public.guardian_panel_sessions SET revoked_at=now() WHERE phone_number=identity->>'phone' AND property_id=(identity->>'propertyId')::uuid AND revoked_at IS NULL;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details) VALUES((identity->>'propertyId')::uuid,identity->>'phone',gen_random_uuid()::text,'panel_sessions_revoked','{"kind":"logout_all"}'::jsonb);
  RETURN true;
END $$;

-- Reopening a previously used personal link is allowed only in its own already
-- authenticated session. An anonymous bearer of a consumed link still cannot enter.
CREATE FUNCTION public.guardian_access_matches(p_link text,p_session text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.guardian_access_links l
    JOIN public.guardian_panel_sessions s ON s.property_id=l.property_id AND s.phone_number=l.created_by
    JOIN public.guardian_members m ON m.property_id=s.property_id AND m.phone_number=s.phone_number AND m.active
    WHERE l.token_hash=p_link AND l.kind='login' AND l.consumed_at IS NOT NULL AND l.revoked_at IS NULL
      AND s.token_hash=p_session AND s.revoked_at IS NULL AND s.expires_at>now());
$$;
REVOKE ALL ON FUNCTION public.guardian_access_matches(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_access_matches(text,text) TO service_role;
