
-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(vector, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, INT) TO service_role;

REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Explicit deny-all policy on knowledge_chunks (only service_role bypasses RLS)
CREATE POLICY "no direct access" ON public.knowledge_chunks FOR SELECT TO authenticated USING (false);
