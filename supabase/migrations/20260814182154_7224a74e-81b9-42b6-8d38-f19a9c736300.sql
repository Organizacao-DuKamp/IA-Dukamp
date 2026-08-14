
-- 1. Remover policies restritivas ou conflitantes se existirem (opcional, mas seguro)
DROP POLICY IF EXISTS "no direct access" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "admins read docs" ON public.knowledge_documents;

-- 2. Garantir privilégios nas tabelas para usuários autenticados (Dukamp/TPEC)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
GRANT ALL ON public.knowledge_documents TO service_role;

-- 3. Policies para knowledge_documents
-- Administradores podem fazer tudo
CREATE POLICY "Admins can manage documents"
ON public.knowledge_documents
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Usuários autenticados podem ler documentos (necessário para o join na busca)
-- Nota: RLS no knowledge_documents é importante para o join no match_knowledge_chunks
CREATE POLICY "Authenticated can select documents"
ON public.knowledge_documents
FOR SELECT
TO authenticated
USING (true);

-- 4. Policies para knowledge_chunks
-- Administradores podem fazer tudo
CREATE POLICY "Admins can manage chunks"
ON public.knowledge_chunks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Usuários autenticados podem ler chunks (necessário para a busca semântica se não usar SECURITY DEFINER em tudo)
CREATE POLICY "Authenticated can select chunks"
ON public.knowledge_chunks
FOR SELECT
TO authenticated
USING (true);
