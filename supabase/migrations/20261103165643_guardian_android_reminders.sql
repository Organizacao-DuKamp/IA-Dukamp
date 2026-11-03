-- Additive device opt-in, independent of WhatsApp delivery preferences.
CREATE TABLE public.guardian_app_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  session_hash text NOT NULL REFERENCES public.guardian_panel_sessions(token_hash) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  fcm_token text CHECK (length(fcm_token) BETWEEN 20 AND 4096),
  mode text NOT NULL CHECK (mode IN ('notification','alarm')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_app_devices_session_idx ON public.guardian_app_devices(session_hash);
CREATE INDEX guardian_app_devices_property_idx ON public.guardian_app_devices(property_id);
CREATE TABLE public.guardian_app_push_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.guardian_app_devices(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sync','reminder')),
  task_id text, task_revision text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','sent','cancelled')),
  not_before timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
  attempts integer NOT NULL DEFAULT 0,
  lock_token uuid, locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(device_id,dedupe_key)
);
CREATE INDEX guardian_app_push_pending_idx ON public.guardian_app_push_jobs(not_before) WHERE status IN ('pending','leased');
ALTER TABLE public.guardian_app_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_app_push_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_app_devices,public.guardian_app_push_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.guardian_app_devices,public.guardian_app_push_jobs TO service_role;

CREATE FUNCTION public.guardian_app_register(p_token_hash text,p_session_hash text,p_fcm_token text,p_mode text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity jsonb; device uuid;
BEGIN
  identity := public.guardian_panel_authorize_mode(p_session_hash,true);
  IF identity IS NULL THEN RAISE EXCEPTION 'guardian_app_access_denied'; END IF;
  DELETE FROM public.guardian_app_devices WHERE token_hash=p_token_hash
    AND (session_hash<>p_session_hash OR property_id<>(identity->>'propertyId')::uuid);
  INSERT INTO public.guardian_app_devices(token_hash,session_hash,property_id,phone_number,fcm_token,mode)
    VALUES(p_token_hash,p_session_hash,(identity->>'propertyId')::uuid,identity->>'phone',p_fcm_token,p_mode)
    ON CONFLICT(token_hash) DO UPDATE SET fcm_token=excluded.fcm_token,mode=excluded.mode,enabled=true RETURNING id INTO device;
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_app_tasks_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.book->'tasks' IS DISTINCT FROM OLD.book->'tasks' THEN
    INSERT INTO public.guardian_app_push_jobs(device_id,dedupe_key,kind)
      SELECT d.id,'sync:'||NEW.version::text,'sync' FROM public.guardian_app_devices d
      WHERE d.property_id=NEW.id AND d.enabled AND d.fcm_token IS NOT NULL ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guardian_app_tasks_changed AFTER UPDATE OF book ON public.guardian_properties
  FOR EACH ROW EXECUTE FUNCTION public.guardian_app_tasks_changed();
CREATE FUNCTION public.guardian_app_push_valid(p_id uuid) RETURNS boolean
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
        AND (t->>'dueAt')::timestamptz<=now() AND (t->>'dueAt')::timestamptz>=now()-interval '5 minutes'
    ))
  );
$$;
CREATE FUNCTION public.guardian_app_claim_pushes(p_limit integer DEFAULT 12)
RETURNS TABLE(id uuid,lock_token uuid,fcm_token text,kind text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  DELETE FROM public.guardian_app_push_jobs j WHERE j.expires_at<now()-interval '7 days';
  INSERT INTO public.guardian_app_push_jobs(device_id,dedupe_key,kind,task_id,task_revision,expires_at)
    SELECT d.id,'due:'||p.id::text||':'||md5(t::text),'reminder',t->>'id',md5(t::text),(t->>'dueAt')::timestamptz+interval '5 minutes'
    FROM public.guardian_app_devices d
    JOIN public.guardian_panel_sessions s ON s.token_hash=d.session_hash AND s.installed AND s.revoked_at IS NULL AND s.expires_at>now()
    JOIN public.guardian_members m ON m.property_id=d.property_id AND m.phone_number=d.phone_number AND m.active
    JOIN public.guardian_properties p ON p.id=d.property_id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.book->'tasks','[]'::jsonb)) t
    WHERE d.enabled AND d.fcm_token IS NOT NULL AND t->>'status'='open'
      AND coalesce(t->>'responsiblePhone',t#>>'{source,actor}')=d.phone_number
      AND (t->>'dueAt')::timestamptz<=now() AND (t->>'dueAt')::timestamptz>=now()-interval '5 minutes'
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
CREATE FUNCTION public.guardian_app_begin_push(p_id uuid,p_lock uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.guardian_app_push_jobs j WHERE j.id=p_id AND j.lock_token=p_lock AND j.status='leased' AND j.locked_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT public.guardian_app_push_valid(p_id) THEN
    UPDATE public.guardian_app_push_jobs SET status='cancelled' WHERE id=p_id; RETURN false;
  END IF;
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_app_finish_push(p_id uuid,p_lock uuid,p_result text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE device uuid;
BEGIN
  UPDATE public.guardian_app_push_jobs j SET
    status=CASE WHEN p_result='sent' THEN 'sent' WHEN p_result='unregistered' OR j.attempts>=5 THEN 'cancelled' ELSE 'pending' END,
    not_before=now()+make_interval(secs=>least(600,30*(2^j.attempts)::integer)),locked_until=NULL
    WHERE j.id=p_id AND j.lock_token=p_lock AND j.status='leased' RETURNING j.device_id INTO device;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_result='unregistered' THEN UPDATE public.guardian_app_devices SET fcm_token=NULL WHERE id=device; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_app_register(text,text,text,text),public.guardian_app_tasks_changed(),
  public.guardian_app_push_valid(uuid),public.guardian_app_claim_pushes(integer),public.guardian_app_begin_push(uuid,uuid),
  public.guardian_app_finish_push(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_app_register(text,text,text,text),public.guardian_app_tasks_changed(),
  public.guardian_app_push_valid(uuid),public.guardian_app_claim_pushes(integer),public.guardian_app_begin_push(uuid,uuid),
  public.guardian_app_finish_push(uuid,uuid,text) TO service_role;
