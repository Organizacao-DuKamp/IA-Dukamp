-- Private conversational vectors are separate from the shared technical corpus.
-- pgvector is already enabled by the existing knowledge migrations in public.
CREATE TABLE public.whatsapp_context_vectors (
  turn_id uuid PRIMARY KEY REFERENCES public.ai_chat_turns(id) ON DELETE CASCADE,
  phone_number text NOT NULL CHECK(phone_number ~ '^[0-9]{6,20}$'),
  source_hash text NOT NULL, embedding_provider text NOT NULL,
  embedding public.vector(3072),
  status text NOT NULL CHECK(status IN ('claimed','ready','error','dead')),
  attempts integer NOT NULL DEFAULT 1 CHECK(attempts BETWEEN 1 AND 4),
  lock_token uuid NOT NULL DEFAULT gen_random_uuid(), claimed_at timestamptz NOT NULL DEFAULT now(),
  retry_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'ready' OR embedding IS NOT NULL)
);
CREATE INDEX whatsapp_context_vectors_owner_idx ON public.whatsapp_context_vectors(phone_number,embedding_provider) WHERE status='ready';
CREATE TABLE public.whatsapp_semantic_budget (
  day date PRIMARY KEY, claimed integer NOT NULL DEFAULT 0 CHECK(claimed>=0)
);
ALTER TABLE public.whatsapp_context_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_semantic_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_context_vectors,public.whatsapp_semantic_budget FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.whatsapp_context_vectors,public.whatsapp_semantic_budget TO service_role;

CREATE FUNCTION public.claim_whatsapp_semantic_memory(p_provider text,p_epoch text,p_limit integer DEFAULT 4,p_daily_budget integer DEFAULT 200)
RETURNS TABLE(turn_id uuid,phone_number text,user_text text,source_hash text,lock_token uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t record; v public.whatsapp_context_vectors; available integer; today date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_epoch IS DISTINCT FROM 'reset-2026-10-14-duk-a91f' OR p_provider IS NULL OR length(p_provider) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'invalid_semantic_claim'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('tpec-private-semantic-claim',0)) THEN RETURN; END IF;
  UPDATE public.whatsapp_context_vectors SET status='dead',updated_at=now()
    WHERE status='claimed' AND attempts>=4 AND claimed_at<now()-interval '10 minutes';
  DELETE FROM public.whatsapp_semantic_budget b WHERE b.day<today-30;
  INSERT INTO public.whatsapp_semantic_budget(day) VALUES(today) ON CONFLICT DO NOTHING;
  SELECT LEAST(LEAST(GREATEST(p_daily_budget,1),10000)-b.claimed,LEAST(GREATEST(p_limit,1),8)) INTO available
    FROM public.whatsapp_semantic_budget b WHERE b.day=today FOR UPDATE;
  IF available<=0 THEN RETURN; END IF;
  FOR t IN SELECT a.id,a.phone_number,a.user_text,encode(sha256(convert_to(a.user_text,'UTF8')),'hex') hash
    FROM public.ai_chat_turns a LEFT JOIN public.whatsapp_context_vectors c ON c.turn_id=a.id
    WHERE a.channel='whatsapp' AND a.status='completed' AND a.phone_number ~ '^[0-9]{6,20}$'
      AND length(a.user_text) BETWEEN 4 AND 6000
      AND a.created_at>=greatest(public.whatsapp_context_boundary(a.phone_number),now()-interval '180 days')
      AND a.created_at<now()-interval '30 seconds'
      AND (c.turn_id IS NULL OR c.source_hash<>encode(sha256(convert_to(a.user_text,'UTF8')),'hex')
        OR c.embedding_provider<>p_provider
        OR (c.status='error' AND c.attempts<4 AND c.retry_at<=now())
        OR (c.status='claimed' AND c.claimed_at<now()-interval '10 minutes' AND c.attempts<4))
    ORDER BY a.created_at DESC,a.id LIMIT available
  LOOP
    INSERT INTO public.whatsapp_context_vectors AS current(turn_id,phone_number,source_hash,embedding_provider,status)
      VALUES(t.id,t.phone_number,t.hash,p_provider,'claimed')
      ON CONFLICT ON CONSTRAINT whatsapp_context_vectors_pkey DO UPDATE SET
        phone_number=excluded.phone_number,source_hash=excluded.source_hash,embedding_provider=p_provider,
        embedding=NULL,status='claimed',lock_token=gen_random_uuid(),claimed_at=now(),updated_at=now(),
        attempts=CASE WHEN current.source_hash<>excluded.source_hash OR current.embedding_provider<>p_provider THEN 1 ELSE current.attempts+1 END
      RETURNING * INTO v;
    UPDATE public.whatsapp_semantic_budget b SET claimed=b.claimed+1 WHERE b.day=today;
    turn_id:=t.id;phone_number:=t.phone_number;user_text:=t.user_text;source_hash:=t.hash;lock_token:=v.lock_token;
    RETURN NEXT;
  END LOOP;
END $$;

CREATE FUNCTION public.finish_whatsapp_semantic_memory(p_turn_id uuid,p_lock uuid,p_provider text,p_embedding public.vector DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.whatsapp_context_vectors; t public.ai_chat_turns;
BEGIN
  SELECT * INTO v FROM public.whatsapp_context_vectors WHERE turn_id=p_turn_id AND lock_token=p_lock AND status='claimed' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO t FROM public.ai_chat_turns WHERE id=p_turn_id AND channel='whatsapp' AND status='completed';
  IF NOT FOUND OR t.phone_number<>v.phone_number OR t.created_at<public.whatsapp_context_boundary(v.phone_number)
    OR v.source_hash<>encode(sha256(convert_to(t.user_text,'UTF8')),'hex') OR p_provider<>v.embedding_provider THEN
    DELETE FROM public.whatsapp_context_vectors WHERE turn_id=p_turn_id; RETURN false;
  END IF;
  IF p_embedding IS NOT NULL AND (public.vector_dims(p_embedding)<>3072 OR public.vector_norm(p_embedding)=0) THEN RAISE EXCEPTION 'invalid_private_vector'; END IF;
  UPDATE public.whatsapp_context_vectors SET embedding=p_embedding,
    status=CASE WHEN p_embedding IS NOT NULL THEN 'ready' WHEN attempts>=4 THEN 'dead' ELSE 'error' END,
    retry_at=now()+make_interval(mins=>10*attempts),updated_at=now() WHERE turn_id=p_turn_id;
  RETURN true;
END $$;

CREATE FUNCTION public.recall_whatsapp_semantic(p_phone text,p_provider text,p_embedding public.vector,p_epoch text,p_before timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE boundary timestamptz:=public.whatsapp_context_boundary(p_phone); result jsonb;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{6,20}$' OR p_epoch IS DISTINCT FROM 'reset-2026-10-14-duk-a91f'
    OR p_provider IS NULL OR p_embedding IS NULL OR public.vector_dims(p_embedding)<>3072 OR public.vector_norm(p_embedding)=0 THEN RAISE EXCEPTION 'invalid_private_recall'; END IF;
  WITH eligible AS MATERIALIZED (
    SELECT a.id,a.created_at,a.user_text,a.assistant_text,v.embedding
    FROM public.whatsapp_context_vectors v JOIN public.ai_chat_turns a ON a.id=v.turn_id
    WHERE v.phone_number=p_phone AND a.phone_number=p_phone AND a.channel='whatsapp' AND a.status='completed'
      AND v.status='ready' AND v.embedding_provider=p_provider
      AND v.source_hash=encode(sha256(convert_to(a.user_text,'UTF8')),'hex')
      AND a.created_at>=boundary AND a.created_at<p_before
    ORDER BY a.created_at DESC,a.id LIMIT 2000
  ), hits AS MATERIALIZED (
    SELECT e.id,e.created_at,1-(e.embedding OPERATOR(public.<=>) p_embedding) AS score FROM eligible e
    WHERE 1-(e.embedding OPERATOR(public.<=>) p_embedding)>=0.3
    ORDER BY e.embedding OPERATOR(public.<=>) p_embedding,e.created_at DESC,e.id LIMIT 12
  ), neighbors AS (
    SELECT n.id FROM hits h CROSS JOIN LATERAL (
      (SELECT a.id FROM public.ai_chat_turns a WHERE a.phone_number=p_phone AND a.channel='whatsapp'
        AND a.created_at>=boundary AND a.created_at<p_before AND (a.created_at,a.id)<=(h.created_at,h.id)
        ORDER BY a.created_at DESC,a.id DESC LIMIT 3)
      UNION
      (SELECT a.id FROM public.ai_chat_turns a WHERE a.phone_number=p_phone AND a.channel='whatsapp'
        AND a.created_at>=boundary AND a.created_at<p_before AND (a.created_at,a.id)>(h.created_at,h.id)
        ORDER BY a.created_at,a.id LIMIT 2)
    ) n
  ), selected AS (SELECT id FROM hits UNION SELECT id FROM neighbors), turns AS (
    SELECT a.id,a.created_at,a.user_text,a.assistant_text,coalesce(h.score,0) score
    FROM selected s JOIN public.ai_chat_turns a ON a.id=s.id LEFT JOIN hits h ON h.id=a.id
    WHERE a.phone_number=p_phone AND a.channel='whatsapp' AND a.created_at>=boundary AND a.created_at<p_before
  ) SELECT jsonb_build_object('turns',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at,t.id) FROM turns t),'[]'::jsonb),
    'facts','[]'::jsonb,'total',(SELECT count(*) FROM turns),'reset_at',boundary,
    'indexed_scanned',(SELECT count(*) FROM eligible)) INTO result;
  RETURN result;
END $$;

-- Reset and source deletion also remove derived vectors. A worker finishing an old
-- claim cannot restore them: completion rechecks the current privacy boundary.
CREATE FUNCTION public.purge_reset_whatsapp_vectors() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.context_reset_at IS NOT NULL AND (TG_OP='INSERT' OR NEW.context_reset_at IS DISTINCT FROM OLD.context_reset_at) THEN
    DELETE FROM public.whatsapp_context_vectors v USING public.ai_chat_turns a
      WHERE v.turn_id=a.id AND v.phone_number=NEW.phone_number AND a.created_at<NEW.context_reset_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER whatsapp_vectors_reset AFTER INSERT OR UPDATE OF context_reset_at ON public.whatsapp_followup_profiles
  FOR EACH ROW EXECUTE FUNCTION public.purge_reset_whatsapp_vectors();

REVOKE ALL ON FUNCTION public.claim_whatsapp_semantic_memory(text,text,integer,integer),public.finish_whatsapp_semantic_memory(uuid,uuid,text,public.vector),public.recall_whatsapp_semantic(text,text,public.vector,text,timestamptz),public.purge_reset_whatsapp_vectors() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_semantic_memory(text,text,integer,integer),public.finish_whatsapp_semantic_memory(uuid,uuid,text,public.vector),public.recall_whatsapp_semantic(text,text,public.vector,text,timestamptz),public.purge_reset_whatsapp_vectors() TO service_role;
