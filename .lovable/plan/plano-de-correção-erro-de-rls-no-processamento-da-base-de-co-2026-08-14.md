# Plano de Correção: Erro de RLS no Processamento da Base de Conhecimento

O reprocessamento da base de conhecimento está falhando porque as tabelas `knowledge_chunks` e `knowledge_documents` possuem Row-Level Security (RLS) ativado, mas as policies atuais não permitem as operações de `INSERT`, `UPDATE` e `DELETE` necessárias para administradores, ou permitem apenas `SELECT` restrito. Além disso, o fluxo de ingestão precisa garantir o uso do cliente autorizado correto.

## Alterações Propostas

### 1. Banco de Dados (SQL)
Ajustar as policies de RLS para permitir que administradores realizem a manutenção dos documentos e chunks.

#### Tabela `knowledge_chunks`
- Criar policy para permitir `INSERT`, `UPDATE` e `DELETE` para usuários autenticados com role `admin`.
- Manter a restrição de `SELECT` para usuários comuns (usando a busca via funções RPC `SECURITY DEFINER` já existentes).

#### Tabela `knowledge_documents`
- Criar policy para permitir `INSERT`, `UPDATE` e `DELETE` para usuários autenticados com role `admin`.
- Garantir que administradores possam ver todos os documentos (`SELECT`).

### 2. Backend (TypeScript)
Refinar o fluxo de processamento para garantir a propagação do cliente autenticado/privilegiado.

- **`src/lib/knowledge.functions.ts`**: Atualizar a função `processNextPending` para passar explicitamente o `supabaseAdmin` (obtido via `getPrivilegedClient`) para a função `ingestDocument`.
- **`src/lib/rag/ingest.server.ts`**: Garantir que a função use o cliente fornecido, evitando fallbacks que possam falhar se a chave de serviço não estiver disponível no ambiente (como na Netlify).

## Verificação e Teste
1. Aplicar as novas policies via migração SQL.
2. Executar o processamento de **apenas um documento** via chamada controlada à função server-side.
3. Validar no banco:
    - Status do documento alterado para `concluido`.
    - Novos chunks inseridos com `embedding_provider` correto da OpenAI.
    - Chunks antigos removidos.
    - Metadados atualizados.

## Detalhes Técnicos (para o desenvolvedor)
- As policies usarão a função `public.has_role(auth.uid(), 'admin')`.
- O `getPrivilegedClient` será usado para obter o cliente correto: ou o `supabaseAdmin` real (se a chave de serviço estiver presente) ou o cliente do usuário (se for um admin autenticado e a chave estiver ausente).
- Não haverá reset de banco nem perda de dados.

---
**Causa Identificada:** As policies RLS de `knowledge_chunks` impediam a inserção e deleção por administradores, retornando `new row violates row-level security policy`.
**Segurança:** RLS permanece ativado. Nenhuma chave secreta exposta no cliente. Permissões restritas estritamente a administradores.
