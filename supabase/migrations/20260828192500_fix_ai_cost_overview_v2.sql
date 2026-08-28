-- Corrige a ambiguidade entre colunas da tabela e parâmetros OUT da função.

CREATE OR REPLACE FUNCTION public.admin_ai_chat_overview_v2(
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
  total_cost_brl NUMERIC,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  deep_research_pct NUMERIC,
  knowledge_base_pct NUMERIC,
  quick_response_pct NUMERIC,
  pricing_configured BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT s.user_key),
    COUNT(DISTINCT s.phone_number) FILTER (WHERE s.channel = 'whatsapp'),
    COUNT(DISTINCT s.conversation_id),
    COUNT(*),
    COUNT(*) FILTER (WHERE s.status = 'completed'),
    COUNT(*) FILTER (WHERE s.status = 'error'),
    COALESCE(SUM(s.estimated_cost_usd), 0),
    CASE
      WHEN COUNT(*) FILTER (WHERE s.estimated_cost_brl IS NULL) > 0 THEN NULL::NUMERIC
      ELSE COALESCE(SUM(s.estimated_cost_brl), 0)
    END,
    COALESCE(SUM(s.input_tokens), 0)::BIGINT,
    COALESCE(SUM(s.output_tokens), 0)::BIGINT,
    COALESCE(SUM(s.total_tokens), 0)::BIGINT,
    COALESCE(ROUND(100.0 * AVG((s.used_deep_research::INT)) FILTER (WHERE s.status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((s.used_knowledge_base::INT)) FILTER (WHERE s.status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((s.used_quick_response::INT)) FILTER (WHERE s.status = 'completed'), 2), 0),
    COALESCE(BOOL_AND(s.pricing_configured), true)
  FROM public.ai_chat_turns AS s
  WHERE (p_from IS NULL OR s.created_at >= p_from)
    AND (p_to IS NULL OR s.created_at <= p_to);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_chat_overview_v2(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_overview_v2(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;
