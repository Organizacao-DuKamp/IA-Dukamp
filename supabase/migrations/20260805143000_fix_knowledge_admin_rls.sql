-- Permite que o painel administrativo continue funcionando em ambientes
-- sem SUPABASE_SERVICE_ROLE_KEY (por exemplo, Netlify), usando a sessão do
-- administrador já validada por public.has_role().
--
-- A política é intencionalmente limitada à role authenticated e exige a role
-- de aplicação "admin" tanto para leitura quanto para escrita.

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

revoke all on table public.knowledge_documents from anon;
revoke all on table public.knowledge_chunks from anon;

grant select, insert, update, delete on table public.knowledge_documents to authenticated;
grant select, insert, update, delete on table public.knowledge_chunks to authenticated;

drop policy if exists "tpec_admin_manage_knowledge_documents" on public.knowledge_documents;
create policy "tpec_admin_manage_knowledge_documents"
on public.knowledge_documents
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "tpec_admin_manage_knowledge_chunks" on public.knowledge_chunks;
create policy "tpec_admin_manage_knowledge_chunks"
on public.knowledge_chunks
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

comment on policy "tpec_admin_manage_knowledge_documents" on public.knowledge_documents is
  'Administradores autenticados podem registrar, atualizar e reprocessar documentos da RAG quando o backend não dispõe da service role.';

comment on policy "tpec_admin_manage_knowledge_chunks" on public.knowledge_chunks is
  'Administradores autenticados podem ler e gravar embeddings da RAG quando o backend não dispõe da service role.';
