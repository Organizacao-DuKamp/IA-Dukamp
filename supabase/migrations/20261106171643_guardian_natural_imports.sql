-- Six digit OTPs are HMAC-bound to the verified WhatsApp number and login purpose.
-- Existing high entropy codes expire naturally; existing authenticated sessions are untouched.
CREATE FUNCTION public.guardian_panel_exchange_otp(p_phone text,p_code_hash text,p_session_hash text,p_origin text,p_installed boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE k text; n int; c public.guardian_panel_codes; allowed boolean:=true;
BEGIN
  -- Global lock serializes distributed attempts, including invalid codes. Counters never roll back on a miss.
  PERFORM pg_advisory_xact_lock(hashtextextended('guardian-otp-attempts',0));
  FOREACH k IN ARRAY ARRAY['otp:global','otp:phone:'||p_phone,'otp:origin:'||p_origin,'otp:code:'||p_code_hash] LOOP
    INSERT INTO public.guardian_panel_limits(key_hash,bucket) VALUES(k,date_trunc('hour',now()))
    ON CONFLICT(key_hash,bucket) DO UPDATE SET attempts=guardian_panel_limits.attempts+1 RETURNING attempts INTO n;
    IF n>(CASE WHEN k='otp:global' THEN 100 ELSE 5 END) THEN allowed:=false; END IF;
  END LOOP;
  IF NOT allowed THEN RETURN false; END IF;
  SELECT * INTO c FROM public.guardian_panel_codes WHERE token_hash=p_code_hash AND phone_number=p_phone AND consumed_at IS NULL AND expires_at>now();
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN public.guardian_panel_exchange_mode(p_code_hash,p_session_hash,p_installed);
END $$;
REVOKE ALL ON FUNCTION public.guardian_panel_exchange_otp(text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_panel_exchange_otp(text,text,text,text,boolean) TO service_role;

CREATE TABLE public.guardian_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone_number text NOT NULL,
 property_id uuid NOT NULL REFERENCES public.guardian_properties(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'collecting' CHECK(status IN ('collecting','reading','review','importing','completed','cancelled')),
 expected_files int, finished_by_user boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 0, instruction text NOT NULL DEFAULT '', view_state jsonb NOT NULL DEFAULT '{}',
 ready_at timestamptz NOT NULL DEFAULT now()+interval '12 seconds',
 lease_token uuid, lease_until timestamptz, final_revision bigint NOT NULL DEFAULT -1,
 report jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_import_owner ON public.guardian_import_batches(phone_number,updated_at DESC);
CREATE TABLE public.guardian_import_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL REFERENCES public.guardian_import_batches(id) ON DELETE CASCADE,
 message_id text NOT NULL UNIQUE, digest text NOT NULL, filename text NOT NULL,mime text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),
 data_base64 text NOT NULL CHECK(length(data_base64)<=35000000),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','reading','complete','error')),
 pages int, completed_pages int NOT NULL DEFAULT 0,error text,attempts int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(batch_id,digest)
);
CREATE TABLE public.guardian_import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL REFERENCES public.guardian_import_batches(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES public.guardian_import_sources(id) ON DELETE CASCADE,page int NOT NULL,ordinal int NOT NULL,
 profile jsonb NOT NULL,issues jsonb NOT NULL DEFAULT '[]',update_fields jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'review' CHECK(status IN ('review','approved','excluded','created','updated','duplicate','error')),
 result text, UNIQUE(source_id,page,ordinal)
);
CREATE INDEX guardian_import_row_batch ON public.guardian_import_rows(batch_id,page,ordinal);
CREATE TABLE public.guardian_import_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,batch_id uuid NOT NULL REFERENCES public.guardian_import_batches(id) ON DELETE CASCADE,
 actor text NOT NULL,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guardian_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_import_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_import_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_import_batches,public.guardian_import_sources,public.guardian_import_rows,public.guardian_import_history FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guardian_import_batches,public.guardian_import_sources,public.guardian_import_rows,public.guardian_import_history TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.guardian_import_history_id_seq TO service_role;

CREATE FUNCTION public.guardian_import_enqueue(p_phone text,p_property uuid,p_message text,p_filename text,p_mime text,p_digest text,p_data text,p_instruction text,p_sent_at timestamptz DEFAULT null) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.guardian_import_batches; source public.guardian_import_sources;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('guardian-import:'||p_phone,0));
 IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=p_property AND phone_number=p_phone AND active AND role IN ('owner','manager','technician')) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
 SELECT * INTO source FROM public.guardian_import_sources WHERE message_id=p_message;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.guardian_import_batches WHERE id=source.batch_id AND phone_number=p_phone AND property_id=p_property) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
  RETURN source.batch_id;
 END IF;
 SELECT * INTO b FROM public.guardian_import_batches WHERE phone_number=p_phone AND property_id=p_property AND status IN ('collecting','reading','review') AND updated_at>now()-interval '24 hours' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.guardian_import_batches(phone_number,property_id,instruction) VALUES(p_phone,p_property,left(p_instruction,8000)) RETURNING * INTO b;
 END IF;
 IF p_data<>'' THEN
  IF length(p_data)+(SELECT coalesce(sum(length(data_base64)),0) FROM public.guardian_import_sources WHERE batch_id=b.id)>140000000 THEN RAISE EXCEPTION 'import_batch_size_limit'; END IF;
  IF (SELECT count(*) FROM public.guardian_import_sources WHERE batch_id=b.id)>=100 THEN RAISE EXCEPTION 'import_file_limit'; END IF;
  INSERT INTO public.guardian_import_sources(batch_id,message_id,digest,filename,mime,data_base64,sent_at) VALUES(b.id,p_message,p_digest,left(p_filename,200),p_mime,p_data,least(coalesce(p_sent_at,now()),now())) ON CONFLICT(batch_id,digest) DO NOTHING;
  IF NOT FOUND THEN RETURN b.id; END IF;
 END IF;
 UPDATE public.guardian_import_batches SET expected_files=greatest(expected_files,substring(lower(p_instruction) from '([0-9]{1,3})[[:space:]]+(?:imagens|fotos|arquivos|paginas)')::int),status='collecting',revision=revision+1,ready_at=now()+interval '12 seconds',updated_at=now(),instruction=left(instruction||E'\n'||p_instruction,8000) WHERE id=b.id;
 INSERT INTO public.guardian_import_history(batch_id,actor,action,details) VALUES(b.id,p_phone,'received',jsonb_build_object('messageId',p_message,'file',p_filename));
 RETURN b.id;
END $$;
CREATE FUNCTION public.guardian_import_claim() RETURNS SETOF public.guardian_import_batches
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN QUERY WITH candidate AS (
 SELECT id FROM public.guardian_import_batches b WHERE b.status IN ('collecting','reading','importing') AND ready_at<=now() AND (lease_until IS NULL OR lease_until<now())
 AND (b.status='importing' OR EXISTS(SELECT 1 FROM public.guardian_import_sources s WHERE s.batch_id=b.id)) ORDER BY ready_at FOR UPDATE SKIP LOCKED LIMIT 2
 ) UPDATE public.guardian_import_batches b SET lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',status=CASE WHEN status='importing' THEN status ELSE 'reading' END FROM candidate WHERE b.id=candidate.id RETURNING b.*;
END $$;
CREATE FUNCTION public.guardian_import_review(p_phone text,p_batch uuid,p_revision bigint,p_kind text,p_data jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.guardian_import_batches; r jsonb; previous_profile jsonb;
BEGIN
 SELECT * INTO b FROM public.guardian_import_batches WHERE id=p_batch AND phone_number=p_phone FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=b.property_id AND phone_number=p_phone AND active AND role IN ('owner','manager','technician')) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
 IF b.revision<>p_revision THEN RETURN false; END IF;
 IF b.status NOT IN ('review','collecting') THEN RAISE EXCEPTION 'import_busy'; END IF;
 IF p_kind='approve' THEN
  IF b.status<>'review' THEN RAISE EXCEPTION 'import_not_ready'; END IF;
  UPDATE public.guardian_import_rows SET status='approved' WHERE batch_id=b.id AND status='review' AND issues='[]'::jsonb AND (p_data->'ids' IS NULL OR p_data->'ids'='null'::jsonb OR id::text IN(SELECT jsonb_array_elements_text(p_data->'ids')));
  IF NOT FOUND THEN RAISE EXCEPTION 'import_no_approved_rows'; END IF;
  UPDATE public.guardian_import_batches SET status='importing',last_error=null,revision=revision+1,ready_at=now(),lease_until=null WHERE id=b.id;
 ELSIF p_kind='edit' THEN
  SELECT profile INTO previous_profile FROM public.guardian_import_rows WHERE id=(p_data->>'id')::uuid AND batch_id=b.id;
  UPDATE public.guardian_import_rows SET profile=p_data->'profile',issues=coalesce(p_data->'issues','[]'),update_fields=coalesce(p_data->'updateFields','[]'),status='review',result=null WHERE batch_id=b.id AND id=(p_data->>'id')::uuid AND status IN('review','error','excluded','duplicate');
  IF NOT FOUND THEN RAISE EXCEPTION 'import_row_unavailable'; END IF;
  UPDATE public.guardian_import_batches SET revision=revision+1 WHERE id=b.id;
 ELSIF p_kind='fields' THEN
  UPDATE public.guardian_import_rows SET update_fields=p_data->'fields' WHERE batch_id=b.id AND status='review';
  UPDATE public.guardian_import_batches SET revision=revision+1 WHERE id=b.id;
 ELSIF p_kind='exclude' THEN
  UPDATE public.guardian_import_rows SET status='excluded' WHERE batch_id=b.id AND id=(p_data->>'id')::uuid AND status IN('review','error','duplicate');
  IF NOT FOUND THEN RAISE EXCEPTION 'import_row_unavailable'; END IF;
  UPDATE public.guardian_import_batches SET revision=revision+1 WHERE id=b.id;
 ELSIF p_kind='cancel' THEN UPDATE public.guardian_import_batches SET status='cancelled',revision=revision+1,lease_until=null WHERE id=b.id;
 ELSIF p_kind='view' THEN UPDATE public.guardian_import_batches SET view_state=p_data WHERE id=b.id;
 ELSIF p_kind='finish' THEN UPDATE public.guardian_import_batches SET finished_by_user=true,ready_at=now() WHERE id=b.id;
 ELSIF p_kind='retry' THEN
  UPDATE public.guardian_import_sources SET status='queued',error=null,attempts=0,completed_pages=0 WHERE batch_id=b.id AND status='error';
  UPDATE public.guardian_import_batches SET expected_files=greatest(expected_files,substring(lower(p_instruction) from '([0-9]{1,3})[[:space:]]+(?:imagens|fotos|arquivos|paginas)')::int),status='collecting',revision=revision+1,ready_at=now(),lease_until=null WHERE id=b.id;
 ELSE RAISE EXCEPTION 'import_invalid_operation'; END IF;
 INSERT INTO public.guardian_import_history(batch_id,actor,action,details) VALUES(b.id,p_phone,p_kind,CASE WHEN p_kind='edit' THEN p_data||jsonb_build_object('before',previous_profile) ELSE p_data END);
 RETURN true;
END $$;
CREATE FUNCTION public.guardian_import_commit(p_phone text,p_batch uuid,p_revision bigint,p_account_version bigint,p_property_version bigint,p_message text,p_book jsonb,p_results jsonb,p_reply text,p_pending jsonb) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.guardian_import_batches; answer text; row_result jsonb;
BEGIN
 -- Same order as normal Guardian commits: account, property, batch.
 PERFORM pg_advisory_xact_lock(hashtextextended('tpec-guardian-account:'||p_phone,0));
 SELECT * INTO b FROM public.guardian_import_batches WHERE id=p_batch AND phone_number=p_phone;
 IF NOT FOUND THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
 PERFORM 1 FROM public.guardian_properties WHERE id=b.property_id FOR UPDATE;
 SELECT * INTO b FROM public.guardian_import_batches WHERE id=p_batch FOR UPDATE;
 IF b.status<>'importing' OR b.revision<>p_revision THEN RETURN 'conflict'; END IF;
 IF jsonb_array_length(p_results)<1 OR jsonb_array_length(p_results)>20 THEN RAISE EXCEPTION 'import_chunk_limit'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=b.property_id AND phone_number=p_phone AND active AND role IN('owner','manager','technician')) THEN RAISE EXCEPTION 'guardian_write_denied'; END IF;
 FOR row_result IN SELECT value FROM jsonb_array_elements(p_results) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.guardian_import_rows WHERE id=(row_result->>'id')::uuid AND batch_id=b.id AND status='approved') THEN RETURN 'conflict'; END IF;
 END LOOP;
 answer:=public.guardian_commit_turn(p_phone,p_message,p_account_version,b.property_id,p_property_version,'update',p_book,p_pending,null,jsonb_build_object('kind','animal','importBatch',b.id),p_reply,'[]');
 IF answer<>'committed' AND answer NOT LIKE 'replay:%' THEN RETURN answer; END IF;
 FOR row_result IN SELECT value FROM jsonb_array_elements(p_results) LOOP
  UPDATE public.guardian_import_rows SET status=row_result->>'status',result=row_result->>'result' WHERE id=(row_result->>'id')::uuid AND batch_id=b.id;
 END LOOP;
 INSERT INTO public.guardian_import_history(batch_id,actor,action,details) VALUES(b.id,p_phone,'chunk_committed',p_results);
 UPDATE public.guardian_import_batches SET updated_at=now() WHERE id=b.id;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.guardian_import_enqueue(text,uuid,text,text,text,text,text,text,timestamptz),public.guardian_import_claim(),public.guardian_import_review(text,uuid,bigint,text,jsonb),public.guardian_import_commit(text,uuid,bigint,bigint,bigint,text,jsonb,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_import_enqueue(text,uuid,text,text,text,text,text,text,timestamptz),public.guardian_import_claim(),public.guardian_import_review(text,uuid,bigint,text,jsonb),public.guardian_import_commit(text,uuid,bigint,bigint,bigint,text,jsonb,jsonb,text,jsonb) TO service_role;

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
  RETURN jsonb_build_object('accountVersion',COALESCE(a.version,0),'preferences',a.preferences,'pending',CASE WHEN r IS NOT NULL OR a.pending->'action'->>'kind'='property_create' OR a.pending ? 'farmDraft' THEN a.pending ELSE NULL END,
    'properties',properties,'active',CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'version',p.version,'role',r,'book',p.book) ELSE NULL END,'lastNotification',notification,'lastCalculation',a.last_calculation);
END $$;

CREATE TABLE public.guardian_import_pages (
 source_id uuid NOT NULL REFERENCES public.guardian_import_sources(id) ON DELETE CASCADE,page int NOT NULL,issues jsonb NOT NULL DEFAULT '[]',PRIMARY KEY(source_id,page)
);
ALTER TABLE public.guardian_import_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guardian_import_pages FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.guardian_import_pages TO service_role;
CREATE FUNCTION public.guardian_import_finish(p_batch uuid,p_token uuid,p_revision bigint,p_report jsonb,p_reply text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b public.guardian_import_batches; msg text;
BEGIN
 SELECT * INTO b FROM public.guardian_import_batches WHERE id=p_batch AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND OR b.revision<>p_revision OR b.ready_at>now() THEN RETURN false; END IF;
 IF NOT b.finished_by_user AND b.expected_files IS NOT NULL AND b.expected_files>(SELECT count(*) FROM public.guardian_import_sources WHERE batch_id=b.id) THEN RETURN false; END IF;
 IF b.status='importing' THEN
  IF EXISTS(SELECT 1 FROM public.guardian_import_rows WHERE batch_id=b.id AND status='approved') THEN RETURN false; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.guardian_import_sources WHERE batch_id=b.id AND status IN ('queued','reading')) THEN RETURN false; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.guardian_members WHERE property_id=b.property_id AND phone_number=b.phone_number AND active AND role IN('owner','manager','technician')) THEN RAISE EXCEPTION 'guardian_access_denied'; END IF;
 UPDATE public.guardian_import_batches SET status=CASE WHEN status='importing' AND NOT EXISTS(SELECT 1 FROM public.guardian_import_rows WHERE batch_id=b.id AND status IN('review','error')) THEN 'completed' ELSE 'review' END,report=p_report,final_revision=revision,lease_until=null,updated_at=now() WHERE id=b.id;
 -- Final reply is queued in the existing durable delivery mechanism in the same transaction.
 -- UI uploads do not cause WhatsApp notifications.
 IF NOT EXISTS(SELECT 1 FROM public.guardian_import_sources WHERE batch_id=b.id AND message_id LIKE 'panel:%') THEN
  msg:='import:'||b.id||':'||b.revision;
  INSERT INTO public.whatsapp_processed_messages(message_id,phone_number,status,reply,request_payload)
   VALUES(msg,b.phone_number,'completed',p_reply,jsonb_build_object('phone',b.phone_number,'messageId',msg,'text','Resultado do lote de importação','sentAt',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
   ON CONFLICT(message_id) DO NOTHING;
 END IF;
 INSERT INTO public.guardian_import_history(batch_id,actor,action,details) VALUES(b.id,b.phone_number,'finished',p_report);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_import_finish(uuid,uuid,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_import_finish(uuid,uuid,bigint,jsonb,text) TO service_role;

ALTER TABLE public.guardian_import_batches ADD COLUMN last_error text;
CREATE FUNCTION public.guardian_import_fail(p_batch uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.guardian_import_batches WHERE id=p_batch AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.guardian_import_rows SET status='review' WHERE batch_id=p_batch AND status='approved';
 UPDATE public.guardian_import_batches SET status='review',last_error='Não foi possível concluir esta etapa. Os registros já gravados foram preservados. Confira o relatório e autorize novamente somente os pendentes.',lease_until=null WHERE id=p_batch;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guardian_import_fail(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_import_fail(uuid,uuid) TO service_role;
