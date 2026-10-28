-- Additive: existing codes, session hashes, membership checks and RLS are preserved.
ALTER TABLE public.guardian_panel_sessions ADD COLUMN installed boolean NOT NULL DEFAULT false,
  ADD COLUMN last_renewed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.guardian_panel_sessions DROP CONSTRAINT guardian_panel_sessions_check;
ALTER TABLE public.guardian_panel_sessions ADD CONSTRAINT guardian_panel_session_duration CHECK (
  (NOT installed AND expires_at<=created_at+interval '24 hours') OR
  (installed AND expires_at<=last_renewed_at+interval '365 days')
);
CREATE FUNCTION public.guardian_panel_exchange_mode(p_code_hash text,p_session_hash text,p_installed boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.guardian_panel_exchange(p_code_hash,p_session_hash) THEN RETURN false; END IF;
  UPDATE public.guardian_panel_sessions SET installed=p_installed,
    expires_at=CASE WHEN p_installed THEN now()+interval '365 days'
      ELSE ((now() AT TIME ZONE 'America/Sao_Paulo')::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo' END
    WHERE token_hash=p_session_hash;
  RETURN true;
END $$;
CREATE FUNCTION public.guardian_panel_authorize_mode(p_hash text,p_installed boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity jsonb; renewed timestamptz;
BEGIN
  -- Installation is a persistence preference, never proof of identity.
  IF NOT EXISTS (SELECT 1 FROM public.guardian_panel_sessions s WHERE s.token_hash=p_hash
    AND s.installed=p_installed AND s.revoked_at IS NULL AND s.expires_at>now()
    AND (p_installed OR (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date)) THEN RETURN NULL; END IF;
  identity := public.guardian_panel_authorize(p_hash);
  IF identity IS NULL THEN RETURN NULL; END IF;
  IF p_installed THEN
    UPDATE public.guardian_panel_sessions SET last_renewed_at=now(),expires_at=now()+interval '365 days'
      WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() RETURNING expires_at INTO renewed;
    IF NOT FOUND THEN RETURN NULL; END IF;
    identity := jsonb_set(identity,'{expiresAt}',to_jsonb(renewed));
  END IF;
  RETURN identity;
END $$;
REVOKE ALL ON FUNCTION public.guardian_panel_exchange_mode(text,text,boolean), public.guardian_panel_authorize_mode(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_panel_exchange_mode(text,text,boolean), public.guardian_panel_authorize_mode(text,boolean) TO service_role;
CREATE FUNCTION public.guardian_panel_revoke_sessions(p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity jsonb;
BEGIN
  identity := public.guardian_panel_authorize(p_hash);
  IF identity IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.guardian_properties WHERE id=(identity->>'propertyId')::uuid FOR UPDATE;
  UPDATE public.guardian_panel_codes SET consumed_at=now() WHERE phone_number=identity->>'phone' AND property_id=(identity->>'propertyId')::uuid AND consumed_at IS NULL;
  UPDATE public.guardian_panel_sessions SET revoked_at=now()
    WHERE phone_number=identity->>'phone' AND property_id=(identity->>'propertyId')::uuid AND revoked_at IS NULL;
  INSERT INTO public.guardian_audit(property_id,actor,message_id,action,details)
    VALUES((identity->>'propertyId')::uuid,identity->>'phone',gen_random_uuid()::text,'panel_sessions_revoked','{"kind":"logout_all"}'::jsonb);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_panel_revoke_sessions(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_panel_revoke_sessions(text) TO service_role;
