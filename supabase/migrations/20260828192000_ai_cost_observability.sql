-- Observabilidade financeira da TPEC-IA.
-- O câmbio é opcional e vem do ambiente TPEC_USD_TO_BRL; quando ausente,
-- o custo em USD continua exato e o valor em BRL fica nulo, sem inventar uma
-- cotação desatualizada.

ALTER TABLE public.ai_chat_turns
  ADD COLUMN IF NOT EXISTS estimated_cost_brl NUMERIC
  CHECK (estimated_cost_brl IS NULL OR estimated_cost_brl >= 0);

COMMENT ON COLUMN public.ai_chat_turns.estimated_cost_brl IS
  'Custo estimado do turno em BRL, calculado com TPEC_USD_TO_BRL no momento do registro.';

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
    CASE
      WHEN COUNT(*) FILTER (WHERE estimated_cost_brl IS NULL) > 0 THEN NULL::NUMERIC
      ELSE COALESCE(SUM(estimated_cost_brl), 0)
    END,
    COALESCE(SUM(input_tokens), 0),
    COALESCE(SUM(output_tokens), 0),
    COALESCE(SUM(total_tokens), 0),
    COALESCE(ROUND(100.0 * AVG((used_deep_research::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((used_knowledge_base::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(ROUND(100.0 * AVG((used_quick_response::INT)) FILTER (WHERE status = 'completed'), 2), 0),
    COALESCE(BOOL_AND(pricing_configured), true)
  FROM scoped;
END;
$$;

-- A função só é chamada pelo server function depois de assertAdmin(). Não
-- conceder EXECUTE a authenticated evita expor o agregado a usuários comuns.
REVOKE ALL ON FUNCTION public.admin_ai_chat_overview_v2(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_overview_v2(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;
