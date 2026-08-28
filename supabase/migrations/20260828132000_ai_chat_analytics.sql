-- Telemetria privada da TPEC-IA para análise operacional e de custo.
-- As mensagens ficam disponíveis somente para administradores autenticados.
-- O custo é estimado a partir do usage devolvido pela OpenAI e das tarifas
-- configuradas nas variáveis OPENAI_*_USD_PER_1M.

CREATE TABLE IF NOT EXISTS public.ai_chat_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL CHECK (length(conversation_id) BETWEEN 1 AND 128),
  user_key TEXT NOT NULL CHECK (length(user_key) BETWEEN 1 AND 256),
  phone_number TEXT CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{6,20}$'),
  channel TEXT NOT NULL CHECK (channel IN ('web', 'whatsapp')),
  client_message_id TEXT,
  user_text TEXT NOT NULL,
  assistant_text TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'error')),
  error_code TEXT,
  error_message TEXT,
  model TEXT,
  model_tier TEXT,
  route_reason TEXT,
  response_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (response_mode IN ('standard', 'quick', 'knowledge', 'deep_research', 'mixed')),
  research_depth TEXT NOT NULL DEFAULT 'none'
    CHECK (research_depth IN ('none', 'medium', 'high')),
  used_deep_research BOOLEAN NOT NULL DEFAULT false,
  used_knowledge_base BOOLEAN NOT NULL DEFAULT false,
  knowledge_match_count INTEGER NOT NULL DEFAULT 0 CHECK (knowledge_match_count >= 0),
  used_quick_response BOOLEAN NOT NULL DEFAULT false,
  web_search_enabled BOOLEAN NOT NULL DEFAULT false,
  web_search_calls INTEGER NOT NULL DEFAULT 0 CHECK (web_search_calls >= 0),
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  reasoning_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  estimated_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  pricing_configured BOOLEAN NOT NULL DEFAULT false,
  pricing_source TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS ai_chat_turns_created_idx
  ON public.ai_chat_turns(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_chat_turns_user_idx
  ON public.ai_chat_turns(user_key, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_chat_turns_conversation_idx
  ON public.ai_chat_turns(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ai_chat_turns_phone_idx
  ON public.ai_chat_turns(phone_number, created_at DESC)
  WHERE phone_number IS NOT NULL;

ALTER TABLE public.ai_chat_turns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_chat_turns FROM PUBLIC, anon;
GRANT SELECT ON public.ai_chat_turns TO authenticated;
GRANT ALL ON public.ai_chat_turns TO service_role;

DROP POLICY IF EXISTS "tpec_admin_read_ai_chat_turns" ON public.ai_chat_turns;
CREATE POLICY "tpec_admin_read_ai_chat_turns"
  ON public.ai_chat_turns
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.ai_chat_turns IS
  'Uma linha por turno da TPEC-IA para análise privada de conversas, tokens, origem e custo estimado.';

CREATE OR REPLACE FUNCTION public.admin_ai_chat_overview(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  unique_users BIGINT,
  whatsapp_numbers BIGINT,
  conversations BIGINT,
  total_turns BIGINT,
  completed_turns BIGINT,
  failed_turns BIGINT,
  total_cost_usd NUMERIC,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  deep_research_pct NUMERIC,
  knowledge_base_pct NUMERIC,
  quick_response_pct NUMERIC,
  pricing_configured BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT *
    FROM public.ai_chat_turns
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at <= p_to)
  )
  SELECT
    COUNT(DISTINCT user_key),
    COUNT(DISTINCT phone_number) FILTER (WHERE channel = 'whatsapp'),
    COUNT(DISTINCT conversation_id),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'error'),
    COALESCE(SUM(estimated_cost_usd), 0),
    COALESCE(SUM(input_tokens), 0),
    COALESCE(SUM(output_tokens), 0),
    COALESCE(SUM(total_tokens), 0),
    COALESCE(ROUND(100.0 * AVG((used_deep_research::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((used_knowledge_base::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((used_quick_response::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(BOOL_AND(pricing_configured), true)
  FROM scoped;
$$;

CREATE OR REPLACE FUNCTION public.admin_ai_chat_users(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_key TEXT,
  phone_number TEXT,
  channel TEXT,
  conversation_count BIGINT,
  turn_count BIGINT,
  completed_turns BIGINT,
  total_cost_usd NUMERIC,
  last_message_at TIMESTAMPTZ,
  deep_research_pct NUMERIC,
  knowledge_base_pct NUMERIC,
  quick_response_pct NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    t.user_key,
    MAX(t.phone_number),
    t.channel,
    COUNT(DISTINCT t.conversation_id),
    COUNT(*),
    COUNT(*) FILTER (WHERE t.status = 'completed'),
    COALESCE(SUM(t.estimated_cost_usd), 0),
    MAX(t.created_at),
    COALESCE(ROUND(100.0 * AVG((t.used_deep_research::INT)) FILTER (WHERE t.status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((t.used_knowledge_base::INT)) FILTER (WHERE t.status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((t.used_quick_response::INT)) FILTER (WHERE t.status = 'completed'), 2), 0)
  FROM public.ai_chat_turns t
  WHERE (p_from IS NULL OR t.created_at >= p_from)
    AND (p_to IS NULL OR t.created_at <= p_to)
  GROUP BY t.user_key, t.channel
  ORDER BY MAX(t.created_at) DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.admin_ai_chat_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_overview(TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_ai_chat_users(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_users(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  TO authenticated, service_role;
