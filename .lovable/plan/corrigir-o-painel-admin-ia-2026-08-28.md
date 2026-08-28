# Corrigir o painel /admin/ia

## Situação verificada

Consultei o banco conectado a este projeto:

- A tabela `ai_chat_turns` **não existe**.
- As funções `admin_ai_chat_overview` e `admin_ai_chat_users` **não existem**.

Por isso o painel retorna "Could not find the function public.admin_ai_chat_users(...) in the schema cache". A migration `supabase/migrations/20260828132000_ai_chat_analytics.sql` está no repositório, mas nunca foi aplicada no banco.

## O que será feito

1. Aplicar a migration integralmente, byte a byte como está no arquivo, criando:
   - tabela `ai_chat_turns` (telemetria de cada turno: usuário, canal, modelo, tokens, custo estimado, origem da resposta);
   - índices por data, usuário, conversa e telefone;
   - as funções de resumo `admin_ai_chat_overview` e de listagem `admin_ai_chat_users`.
2. Manter as regras de acesso da própria migration: leitura apenas para usuários autenticados com papel de administrador; acesso total apenas para o serviço interno; nenhum acesso para visitantes anônimos.
3. Conceder execução das duas funções a usuários autenticados e ao serviço interno (já previsto na migration).
4. Recarregar o cache de esquema da API para que as funções passem a ser reconhecidas imediatamente.
5. Reconsultar o banco para confirmar que tabela e funções existem, e testar o painel `/admin/ia` no preview (visão geral, lista de usuários e histórico).

## Observações técnicas

- Nada é apagado nem recriado: a migration usa `CREATE TABLE IF NOT EXISTS` e `CREATE OR REPLACE FUNCTION`.
- As funções são `SECURITY INVOKER`, então continuam respeitando a política de linha que exige papel de administrador.
- O código do painel (`src/lib/analytics.functions.ts` e `src/routes/_authenticated/admin.ia.tsx`) já corresponde à assinatura dessas funções; nenhuma alteração de código é necessária.
- Enquanto não houver turnos gravados, o painel deve mostrar zeros em vez de erro — esse é o resultado esperado logo após a aplicação.
- Nenhum outro projeto ou funcionalidade é tocado.
