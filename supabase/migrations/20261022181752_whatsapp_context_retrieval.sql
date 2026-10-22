-- A reset is an explicit privacy boundary, not the timestamp of the last summary.
ALTER TABLE public.whatsapp_followup_profiles ADD COLUMN IF NOT EXISTS context_reset_at TIMESTAMPTZ;
UPDATE public.whatsapp_followup_profiles p SET context_reset_at = (
  SELECT min(t.created_at) FROM public.ai_chat_turns t
  JOIN public.whatsapp_conversations c ON c.phone_number = p.phone_number
  WHERE t.phone_number = p.phone_number AND t.conversation_id = c.conversation_id
    AND c.conversation_id LIKE 'wa:%:reset:%'
) WHERE p.context_reset_at IS NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_context_boundary(p_phone TEXT)
RETURNS TIMESTAMPTZ LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT greatest('2026-10-14T00:00:00Z'::timestamptz,
    (SELECT p.context_reset_at FROM public.whatsapp_followup_profiles p WHERE p.phone_number = p_phone));
$$;
REVOKE ALL ON FUNCTION public.whatsapp_context_boundary(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_context_boundary(TEXT) TO service_role;

-- User statements and assistant replies are searchable, but retain separate provenance.
CREATE INDEX IF NOT EXISTS ai_chat_turns_whatsapp_recall_fts ON public.ai_chat_turns
  USING gin (to_tsvector('portuguese', coalesce(user_text, '') || ' ' || coalesce(assistant_text, '')))
  WHERE channel = 'whatsapp';
CREATE INDEX IF NOT EXISTS ai_chat_turns_whatsapp_owner_time ON public.ai_chat_turns(phone_number, created_at, id)
  WHERE channel = 'whatsapp';

CREATE OR REPLACE FUNCTION public.recall_whatsapp_context(
  p_phone TEXT, p_query TEXT, p_epoch TEXT,
  p_start TIMESTAMPTZ DEFAULT NULL, p_end TIMESTAMPTZ DEFAULT NULL,
  p_before TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  boundary TIMESTAMPTZ := public.whatsapp_context_boundary(p_phone);
  q tsquery := websearch_to_tsquery('portuguese', left(coalesce(p_query, ''), 2000));
  result JSONB;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{6,20}$' OR p_epoch IS DISTINCT FROM 'reset-2026-10-14-duk-a91f'
    OR ((p_start IS NULL) <> (p_end IS NULL)) OR p_end <= p_start THEN
    RAISE EXCEPTION 'invalid_context_request';
  END IF;
  WITH hits AS (
    SELECT t.id, t.created_at,
      ts_rank_cd(to_tsvector('portuguese', coalesce(t.user_text, '') || ' ' || coalesce(t.assistant_text, '')), q) AS score
    FROM public.ai_chat_turns t
    WHERE p_start IS NULL AND t.phone_number = p_phone AND t.channel = 'whatsapp'
      AND t.created_at >= boundary AND t.created_at < p_before
      AND to_tsvector('portuguese', coalesce(t.user_text, '') || ' ' || coalesce(t.assistant_text, '')) @@ q
    ORDER BY score DESC, t.created_at DESC, t.id LIMIT 24
  ), neighbors AS (
    SELECT n.id FROM hits h CROSS JOIN LATERAL (
      (SELECT t.id FROM public.ai_chat_turns t
       WHERE t.phone_number = p_phone AND t.channel = 'whatsapp' AND t.created_at >= boundary
         AND t.created_at < p_before AND (t.created_at, t.id) <= (h.created_at, h.id)
       ORDER BY t.created_at DESC, t.id DESC LIMIT 3)
      UNION
      (SELECT t.id FROM public.ai_chat_turns t
       WHERE t.phone_number = p_phone AND t.channel = 'whatsapp' AND t.created_at >= boundary
         AND t.created_at < p_before AND (t.created_at, t.id) > (h.created_at, h.id)
       ORDER BY t.created_at, t.id LIMIT 2)
    ) n
  ), recent AS (
    SELECT t.id FROM public.ai_chat_turns t
    WHERE p_start IS NULL AND t.phone_number = p_phone AND t.channel = 'whatsapp'
      AND t.created_at >= boundary AND t.created_at < p_before
    ORDER BY t.created_at DESC, t.id DESC LIMIT 16
  ), dated AS (
    SELECT t.id FROM public.ai_chat_turns t
    WHERE p_start IS NOT NULL AND t.phone_number = p_phone AND t.channel = 'whatsapp'
      AND t.created_at >= greatest(boundary, p_start) AND t.created_at < least(p_end, p_before)
    ORDER BY t.created_at, t.id LIMIT 1000
  ), selected AS (
    SELECT id FROM neighbors UNION SELECT id FROM recent UNION SELECT id FROM dated
  ), turns AS (
    SELECT t.id, t.created_at, t.user_text, t.assistant_text,
      coalesce((SELECT h.score FROM hits h WHERE h.id = t.id), 0) AS score
    FROM selected s JOIN public.ai_chat_turns t ON t.id = s.id
    WHERE t.phone_number = p_phone AND t.channel = 'whatsapp'
  ), facts AS (
    SELECT f.id, f.category, f.subject, f.value_text, f.last_seen_at, f.source_excerpt
    FROM public.whatsapp_user_memory_facts f
    WHERE f.phone_number = p_phone AND f.status = 'active'
      AND f.metadata @> jsonb_build_object('memory_epoch', p_epoch)
      AND f.last_seen_at >= boundary AND f.last_seen_at < p_before
    ORDER BY f.importance DESC, f.last_seen_at DESC LIMIT 30
  ) SELECT jsonb_build_object(
    'turns', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.id) FROM turns t), '[]'::jsonb),
    'facts', coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM facts f), '[]'::jsonb),
    'total', CASE WHEN p_start IS NOT NULL THEN (
      SELECT count(*) FROM public.ai_chat_turns t WHERE t.phone_number = p_phone AND t.channel = 'whatsapp'
        AND t.created_at >= greatest(boundary, p_start) AND t.created_at < least(p_end, p_before)
    ) ELSE (SELECT count(*) FROM turns) END,
    'reset_at', boundary
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.recall_whatsapp_context(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recall_whatsapp_context(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

-- Preserve the existing busy-job checks and resets, and record the durable boundary.
CREATE OR REPLACE FUNCTION public.record_whatsapp_context_reset()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     AND NEW.conversation_id LIKE 'wa:%:reset:%' THEN
    INSERT INTO public.whatsapp_followup_profiles(phone_number, context_reset_at)
      VALUES (NEW.phone_number, NEW.updated_at)
      ON CONFLICT (phone_number) DO UPDATE SET context_reset_at = excluded.context_reset_at;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_whatsapp_context_reset() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER whatsapp_context_explicit_reset AFTER UPDATE OF conversation_id ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.record_whatsapp_context_reset();

-- Reset hides prior records from AI context without deleting either books or events.
-- Before reusing an old book's key, retain its full snapshot in a private archive.
CREATE TABLE public.whatsapp_herd_book_archives (
  phone_number TEXT NOT NULL,
  record_date DATE NOT NULL,
  version BIGINT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(phone_number, record_date, version)
);
ALTER TABLE public.whatsapp_herd_book_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_herd_book_archives FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.whatsapp_herd_book_archives TO service_role;
CREATE OR REPLACE FUNCTION public.archive_whatsapp_herd_generation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.updated_at < public.whatsapp_context_boundary(OLD.phone_number) THEN
    INSERT INTO public.whatsapp_herd_book_archives(phone_number, record_date, version, data, updated_at)
      VALUES(OLD.phone_number, OLD.record_date, OLD.version, OLD.data, OLD.updated_at)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_whatsapp_herd_generation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER whatsapp_herd_archive_generation BEFORE UPDATE ON public.whatsapp_herd_books
  FOR EACH ROW EXECUTE FUNCTION public.archive_whatsapp_herd_generation();
CREATE VIEW public.whatsapp_herd_visible_books WITH (security_invoker = true) AS
  SELECT b.phone_number, b.record_date, b.version, b.updated_at,
    CASE WHEN b.updated_at >= public.whatsapp_context_boundary(b.phone_number) THEN b.data
      ELSE '{"schema":1,"active":false,"batch":0,"entries":[],"procedures":[],"lastKey":null,"defaultSeries":null,"defaultSex":null,"reproductiveMode":false,"pending":null}'::jsonb
    END AS data
  FROM public.whatsapp_herd_books b;
CREATE VIEW public.whatsapp_herd_visible_events WITH (security_invoker = true) AS
  SELECT e.* FROM public.whatsapp_herd_events e
  WHERE e.created_at >= public.whatsapp_context_boundary(e.phone_number);
REVOKE ALL ON public.whatsapp_herd_visible_books, public.whatsapp_herd_visible_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.whatsapp_herd_visible_books, public.whatsapp_herd_visible_events TO service_role;
