-- Private profiles derived only from affirmative producer statements.
-- Shared farm books, membership and notification consent remain separate.
CREATE TABLE public.guardian_observed_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL CHECK (phone_number ~ '^[0-9]{6,20}$'),
  generation_start timestamptz NOT NULL,
  identity_key text NOT NULL CHECK (length(identity_key) BETWEEN 1 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number, generation_start, identity_key),
  UNIQUE (id, phone_number, generation_start)
);
CREATE INDEX guardian_observed_properties_recent ON public.guardian_observed_properties(updated_at DESC,id);
CREATE TABLE public.guardian_observed_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  phone_number text NOT NULL,
  generation_start timestamptz NOT NULL,
  field text NOT NULL CHECK (field IN ('name','city','uf','areaHa','activity','breed','herdTotal','cows','oxen','calves','heifers','feeding')),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) IN ('string','number')),
  source_message_id text NOT NULL CHECK (length(source_message_id) BETWEEN 1 AND 128),
  source_excerpt text NOT NULL CHECK (length(source_excerpt) BETWEEN 1 AND 1500),
  source_question text CHECK (length(source_question)<=300),
  source_at timestamptz NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (property_id,phone_number,generation_start) REFERENCES public.guardian_observed_properties(id,phone_number,generation_start) ON DELETE CASCADE,
  UNIQUE (phone_number,generation_start,source_message_id,field),
  CHECK (source_at>=generation_start AND effective_date <= (source_at AT TIME ZONE 'America/Sao_Paulo')::date),
  CHECK (CASE WHEN field IN ('areaHa','herdTotal','cows','oxen','calves','heifers')
    THEN jsonb_typeof(value)='number' AND (value::text)::numeric BETWEEN 0 AND 10000000
      AND (field='areaHa' OR (value::text)::numeric=trunc((value::text)::numeric))
    ELSE jsonb_typeof(value)='string' AND length(value#>>'{}') BETWEEN 1 AND 500 END)
);
CREATE INDEX guardian_observed_facts_current ON public.guardian_observed_facts(property_id,field,effective_date DESC,source_at DESC,id DESC);
CREATE INDEX guardian_observed_facts_history ON public.guardian_observed_facts(property_id,source_at DESC,id DESC);
ALTER TABLE public.guardian_observed_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_observed_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_observed_properties,public.guardian_observed_facts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.guardian_observed_properties TO service_role;
GRANT SELECT,INSERT ON public.guardian_observed_facts TO service_role;

CREATE VIEW public.guardian_observed_current WITH (security_invoker=true) AS
  SELECT DISTINCT ON (f.property_id,f.field) f.*
  FROM public.guardian_observed_facts f JOIN public.guardian_observed_properties p ON p.id=f.property_id
  WHERE p.generation_start=public.whatsapp_context_boundary(p.phone_number)
  ORDER BY f.property_id,f.field,f.effective_date DESC,f.source_at DESC,f.id DESC;
REVOKE ALL ON public.guardian_observed_current FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.guardian_observed_current TO service_role;

CREATE FUNCTION public.guardian_observe_property(p_phone text,p_message_id text,p_source_at timestamptz,p_source_text text,p_name text,p_another boolean,p_facts jsonb)
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

CREATE FUNCTION public.guardian_observed_profiles(p_limit int DEFAULT 100) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH candidates AS (
    SELECT p.* FROM public.guardian_observed_properties p
    WHERE p.generation_start=public.whatsapp_context_boundary(p.phone_number)
      AND EXISTS (SELECT 1 FROM public.guardian_observed_current f WHERE f.property_id=p.id)
    ORDER BY p.updated_at DESC,p.id LIMIT least(100,greatest(1,p_limit))+1
  ), shown AS (SELECT * FROM candidates ORDER BY updated_at DESC,id LIMIT least(100,greatest(1,p_limit))),
  rows AS (
    SELECT p.id,p.phone_number AS phone,p.updated_at AS "updatedAt",
      coalesce((a.facts->'name'->>'value'),'Propriedade de '||p.phone_number) AS name,
      coalesce(a.facts,'{}'::jsonb) AS facts
    FROM shown p CROSS JOIN LATERAL (
      SELECT jsonb_object_agg(f.field,jsonb_build_object('value',f.value,'effectiveDate',f.effective_date,'sourceAt',f.source_at)) facts
      FROM public.guardian_observed_current f WHERE f.property_id=p.id
    ) a
  ) SELECT jsonb_build_object('profiles',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r."updatedAt" DESC,r.id) FROM rows r),'[]'::jsonb),
    'partial',(SELECT count(*) FROM candidates)>least(100,greatest(1,p_limit)));
$$;
CREATE FUNCTION public.guardian_observed_profile(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH p AS (SELECT * FROM public.guardian_observed_properties WHERE id=p_id AND generation_start=public.whatsapp_context_boundary(phone_number)),
  history AS (SELECT f.* FROM public.guardian_observed_facts f JOIN p ON p.id=f.property_id ORDER BY f.source_at DESC,f.id DESC LIMIT 201)
  SELECT (SELECT jsonb_build_object('id',p.id,'phone',p.phone_number,'updatedAt',p.updated_at,
    'current',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.field) FROM public.guardian_observed_current f WHERE f.property_id=p.id),'[]'::jsonb),
    'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.source_at DESC,h.id DESC) FROM (SELECT * FROM history LIMIT 200) h),'[]'::jsonb),
    'partial',(SELECT count(*) FROM history)>200) FROM p);
$$;

-- Reconcile already captured, literal notes without another AI call. Parallel runs
-- may select the same note; the per-message/field constraint makes this harmless.
CREATE INDEX guardian_observed_notes_pending ON public.whatsapp_user_memory_facts(first_seen_at,id)
  WHERE status='active' AND metadata->>'capture'='conversation_v1' AND metadata->>'guardian_property_projection_v1' IS NULL;
CREATE FUNCTION public.guardian_pending_property_notes(p_limit int DEFAULT 8) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(n)),'[]'::jsonb) FROM (
    SELECT f.id,f.phone_number,f.source_message_id,f.value_text,f.last_seen_at,f.metadata
    FROM public.whatsapp_user_memory_facts f
    WHERE f.status='active' AND f.metadata->>'capture'='conversation_v1'
      AND f.metadata->>'guardian_property_projection_v1' IS NULL
      AND f.metadata->>'memory_epoch'='reset-2026-10-14-duk-a91f'
      AND f.last_seen_at>=public.whatsapp_context_boundary(f.phone_number)
    ORDER BY f.first_seen_at,f.id LIMIT least(32,greatest(1,p_limit))
  ) n;
$$;
CREATE FUNCTION public.guardian_finish_property_note(p_id uuid,p_outcome text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF p_outcome NOT IN ('saved','no_facts','ambiguous_property','reset') THEN RAISE EXCEPTION 'invalid_projection_outcome'; END IF;
  UPDATE public.whatsapp_user_memory_facts SET metadata=metadata||jsonb_build_object('guardian_property_projection_v1',p_outcome)
    WHERE id=p_id AND metadata->>'capture'='conversation_v1' AND metadata->>'guardian_property_projection_v1' IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.guardian_observe_property(text,text,timestamptz,text,text,boolean,jsonb),public.guardian_observed_profiles(int),public.guardian_observed_profile(uuid),public.guardian_pending_property_notes(int),public.guardian_finish_property_note(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_observe_property(text,text,timestamptz,text,text,boolean,jsonb),public.guardian_observed_profiles(int),public.guardian_observed_profile(uuid),public.guardian_pending_property_notes(int),public.guardian_finish_property_note(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
