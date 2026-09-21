-- Memória durável e acompanhamento proativo por usuário do WhatsApp.
-- Todo acesso ocorre no backend com service_role.

CREATE TABLE IF NOT EXISTS public.whatsapp_followup_profiles (
  phone_number TEXT PRIMARY KEY,
  followups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  opted_out_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  last_inbound_at TIMESTAMPTZ,
  last_memory_at TIMESTAMPTZ,
  last_proactive_at TIMESTAMPTZ,
  memory_count INTEGER NOT NULL DEFAULT 0 CHECK (memory_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_memory_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  user_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'error', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  claimed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_user_memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  value_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved')),
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  follow_up_relevant BOOLEAN NOT NULL DEFAULT TRUE,
  source_message_id TEXT,
  source_excerpt TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_user_memory_facts_phone_key UNIQUE (phone_number, fact_key)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_proactive_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  local_date DATE NOT NULL,
  slot_no SMALLINT CHECK (slot_no IN (1, 2) OR slot_no IS NULL),
  source TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (source IN ('scheduled', 'manual')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed', 'uncertain', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  claimed_at TIMESTAMPTZ,
  message_text TEXT,
  delivery_mode TEXT CHECK (delivery_mode IN ('text', 'template') OR delivery_mode IS NULL),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whatsapp_proactive_daily_slot UNIQUE (phone_number, local_date, slot_no)
);

CREATE INDEX IF NOT EXISTS whatsapp_memory_inbox_pending_idx
  ON public.whatsapp_memory_inbox (status, updated_at, created_at)
  WHERE status IN ('pending', 'error');

CREATE INDEX IF NOT EXISTS whatsapp_memory_facts_active_idx
  ON public.whatsapp_user_memory_facts
  (phone_number, status, follow_up_relevant, importance DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_proactive_due_idx
  ON public.whatsapp_proactive_queue (scheduled_for, updated_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS whatsapp_proactive_phone_idx
  ON public.whatsapp_proactive_queue (phone_number, created_at DESC);

ALTER TABLE public.whatsapp_followup_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_memory_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_user_memory_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_proactive_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.whatsapp_followup_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_memory_inbox FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_user_memory_facts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_proactive_queue FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_followup_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_memory_inbox TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_user_memory_facts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_proactive_queue TO service_role;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_memory_inbox(p_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  id UUID,
  message_id TEXT,
  phone_number TEXT,
  user_text TEXT,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT i.id
    FROM public.whatsapp_memory_inbox AS i
    WHERE
      (
        i.status = 'pending'
        OR (i.status = 'error' AND i.updated_at <= NOW() - INTERVAL '2 minutes')
      )
      AND i.attempts < 4
    ORDER BY i.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 12), 50))
  )
  UPDATE public.whatsapp_memory_inbox AS i
  SET
    status = 'processing',
    attempts = i.attempts + 1,
    claimed_at = NOW(),
    updated_at = NOW()
  FROM picked
  WHERE i.id = picked.id
  RETURNING i.id, i.message_id, i.phone_number, i.user_text, i.attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_whatsapp_proactive(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  phone_number TEXT,
  local_date DATE,
  slot_no SMALLINT,
  source TEXT,
  scheduled_for TIMESTAMPTZ,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.whatsapp_proactive_queue AS q
    WHERE
      q.scheduled_for <= NOW()
      AND q.attempts < 3
      AND (
        q.status = 'pending'
        OR (q.status = 'failed' AND q.updated_at <= NOW() - INTERVAL '5 minutes')
      )
    ORDER BY q.scheduled_for
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50))
  )
  UPDATE public.whatsapp_proactive_queue AS q
  SET
    status = 'processing',
    attempts = q.attempts + 1,
    claimed_at = NOW(),
    updated_at = NOW()
  FROM picked
  WHERE q.id = picked.id
  RETURNING
    q.id,
    q.phone_number,
    q.local_date,
    q.slot_no,
    q.source,
    q.scheduled_for,
    q.attempts;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_whatsapp_memory_inbox(INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_whatsapp_proactive(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_memory_inbox(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_whatsapp_proactive(INTEGER) TO service_role;

INSERT INTO public.whatsapp_followup_profiles (
  phone_number,
  last_inbound_at,
  created_at,
  updated_at
)
SELECT
  c.phone_number,
  c.updated_at,
  NOW(),
  NOW()
FROM public.whatsapp_conversations AS c
WHERE c.phone_number IS NOT NULL
ON CONFLICT (phone_number) DO NOTHING;

INSERT INTO public.whatsapp_memory_inbox (
  message_id,
  phone_number,
  user_text,
  status,
  created_at,
  updated_at
)
SELECT
  'bootstrap:' || md5(c.phone_number),
  c.phone_number,
  LEFT(STRING_AGG(recent.content, E'\n---\n' ORDER BY recent.ord), 16000),
  'pending',
  NOW(),
  NOW()
FROM public.whatsapp_conversations AS c
CROSS JOIN LATERAL (
  SELECT
    item.value ->> 'content' AS content,
    item.ord
  FROM jsonb_array_elements(COALESCE(c.history, '[]'::jsonb))
    WITH ORDINALITY AS item(value, ord)
  WHERE item.value ->> 'role' = 'user'
    AND COALESCE(item.value ->> 'content', '') <> ''
  ORDER BY item.ord DESC
  LIMIT 12
) AS recent
GROUP BY c.phone_number
HAVING COUNT(*) > 0
ON CONFLICT (message_id) DO NOTHING;
