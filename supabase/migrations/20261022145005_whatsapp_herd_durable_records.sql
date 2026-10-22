-- Private structured records, scoped to a verified WhatsApp sender and local date.
CREATE TABLE IF NOT EXISTS public.whatsapp_herd_books (
  phone_number text NOT NULL CHECK (phone_number ~ '^[0-9]{6,20}$'),
  record_date date NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  data jsonb NOT NULL CHECK (data->>'schema' = '1' AND jsonb_typeof(data->'entries') = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone_number, record_date)
);
CREATE TABLE IF NOT EXISTS public.whatsapp_herd_events (
  phone_number text NOT NULL,
  message_id text NOT NULL,
  record_date date NOT NULL,
  version bigint NOT NULL,
  source_text text NOT NULL,
  reply text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone_number,message_id),
  FOREIGN KEY (phone_number,record_date) REFERENCES public.whatsapp_herd_books(phone_number,record_date)
);
ALTER TABLE public.whatsapp_herd_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_herd_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_herd_books,public.whatsapp_herd_events FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.whatsapp_herd_books TO service_role;
GRANT SELECT,INSERT ON public.whatsapp_herd_events TO service_role;
CREATE OR REPLACE FUNCTION public.commit_whatsapp_herd_turn(
  p_phone text,p_day date,p_version bigint,p_message_id text,p_book jsonb,p_reply text,p_source_text text
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_version bigint; v_reply text;
BEGIN
  IF p_phone !~ '^[0-9]{6,20}$' OR length(p_message_id) NOT BETWEEN 1 AND 128
    OR p_book->>'schema' IS DISTINCT FROM '1' OR jsonb_typeof(p_book->'entries') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_book->'entries') > 5000 OR octet_length(p_book::text) > 10000000
    OR length(p_reply) NOT BETWEEN 1 AND 120000 OR length(p_source_text) > 60000 THEN
    RAISE EXCEPTION 'invalid_herd_turn';
  END IF;
  -- Serializes same-owner turns (including a retry crossing midnight).
  PERFORM pg_advisory_xact_lock(hashtextextended('tpec-herd:' || p_phone,0));
  SELECT reply INTO v_reply FROM public.whatsapp_herd_events WHERE phone_number=p_phone AND message_id=p_message_id;
  IF FOUND THEN RETURN 'replay:' || v_reply; END IF;
  INSERT INTO public.whatsapp_herd_books(phone_number,record_date,data)
    VALUES(p_phone,p_day,'{"schema":1,"entries":[]}'::jsonb) ON CONFLICT DO NOTHING;
  SELECT version INTO v_version FROM public.whatsapp_herd_books WHERE phone_number=p_phone AND record_date=p_day FOR UPDATE;
  IF v_version <> p_version THEN RETURN 'conflict'; END IF;
  UPDATE public.whatsapp_herd_books SET data=p_book,version=version+1,updated_at=now()
    WHERE phone_number=p_phone AND record_date=p_day;
  INSERT INTO public.whatsapp_herd_events(phone_number,message_id,record_date,version,source_text,reply)
    VALUES(p_phone,p_message_id,p_day,v_version+1,p_source_text,p_reply);
  RETURN 'committed';
END;
$$;
REVOKE ALL ON FUNCTION public.commit_whatsapp_herd_turn(text,date,bigint,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_whatsapp_herd_turn(text,date,bigint,text,jsonb,text,text) TO service_role;
