-- As RPCs de analytics são chamadas somente pelo backend após assertAdmin().
-- Não devem ficar expostas ao PostgREST para anon/authenticated.

REVOKE ALL ON FUNCTION public.admin_ai_chat_overview(TIMESTAMPTZ, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_overview(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role;

REVOKE ALL ON FUNCTION public.admin_ai_chat_users(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_chat_users(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER)
  TO service_role;
