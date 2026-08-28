-- Mantém a base de conhecimento privada e administrável apenas por admins.
-- A versão anterior deste arquivo liberava os chunks para qualquer usuário
-- autenticado; isso não é necessário para o painel nem para o backend.
DROP POLICY IF EXISTS "no direct access" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "admins read docs" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Authenticated can select documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Authenticated can select chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "Admins can manage documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Admins can manage chunks" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "tpec_admin_manage_knowledge_documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "tpec_admin_manage_knowledge_chunks" ON public.knowledge_chunks;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;
GRANT ALL ON public.knowledge_chunks TO service_role;

CREATE POLICY "tpec_admin_manage_knowledge_documents"
ON public.knowledge_documents
FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'))
WITH CHECK (public.has_role((select auth.uid()), 'admin'));

CREATE POLICY "tpec_admin_manage_knowledge_chunks"
ON public.knowledge_chunks
FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'admin'))
WITH CHECK (public.has_role((select auth.uid()), 'admin'));
