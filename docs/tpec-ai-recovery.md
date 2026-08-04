# Relatório de investigação e recuperação

## Preservação

Antes de alterar código foi criado `tpec-ia-backup-completo.bundle` com `git bundle create ... --all`. O bundle preserva todas as refs alcançáveis existentes naquele momento.

## Resultado da investigação

`git branch --all` encontrou apenas `work`; não havia tags. `git reflog --all` continha somente operações recentes em `239c298`. `git fsck --full --no-reflogs --unreachable` não encontrou objetos unreachable/dangling. O objeto `fb8c63b` não existia. Nenhum commit alcançável continha `intent.ts`, `openai.server.ts`, `response-validation.ts`, `security.ts`, `tools.ts`, `tests/ai-architecture.test.ts` ou `docs/tpec-ai-audit.md`. Portanto, o trabalho anunciado anteriormente não era recuperável do banco de objetos e foi reimplementado.

## Merge 239c298

Contra o primeiro pai, o merge alterou sete arquivos: atualizou desnecessariamente `@lovable.dev/vite-tanstack-config`, removeu incorretamente a tipagem da RPC lexical, e incorporou melhorias relacionadas em roteamento, prompt, busca híbrida e vendedores. A migração `20260803120000_hybrid_knowledge_search.sql` cria a RPC lexical; por isso sua remoção dos tipos era inconsistente. Esta entrega reverte a atualização de dependência não relacionada e restaura a tipagem, preservando as melhorias funcionais atuais.

## Matriz de comprovação real

| Requisito                  | Estado                                     | Evidência executável                                                       |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| Auditoria                  | implementado                               | `docs/tpec-ai-audit.md`                                                    |
| AGENTS.md                  | implementado                               | regras permanentes no arquivo raiz                                         |
| Memória                    | parcialmente                               | `state.ts` tem janela/resumo/fatos; não há persistência server-side        |
| Classificação de intenção  | implementado                               | `intent.ts`, integrada no core e avaliada                                  |
| Cliente OpenAI central     | implementado, não ativado                  | `openai.server.ts` usa Responses API                                       |
| Perplexity                 | implementado                               | cliente único e modelo configurável                                        |
| Proteção contra alucinação | parcialmente                               | grounding comercial/citações; validação semântica ampla permanece futura   |
| Prompt injection           | implementado                               | `security.ts` sanitiza trechos RAG                                         |
| Ferramentas tipadas        | implementado como contratos                | `tools.ts`; executor externo permanece futuro                              |
| Busca híbrida/RAG          | implementado                               | semântica + lexical + deduplicação em `search.server.ts`                   |
| Validação de fontes        | parcialmente                               | `source-policy.ts` e grounding; mapa de citações externas permanece futuro |
| Logs estruturados          | parcialmente                               | core registra diagnóstico; persistência/custo permanece futura             |
| Testes de contexto         | implementado                               | matriz e testes de janela                                                  |
| Testes de vendedores       | implementado                               | `seller-domain.test.ts`                                                    |
| Testes de segurança        | implementado                               | injection, segredo, citação, preço sem evidência                           |
| 40 avaliações              | implementado                               | exatamente 40 entradas em `tests/evals/tpec-ai-cases.ts`                   |
| Build                      | sujeito ao resultado registrado na entrega | comando real do package.json                                               |
| TypeScript                 | sujeito ao resultado registrado na entrega | `npx tsc --noEmit`                                                         |
| Lint alterados             | sujeito ao resultado registrado na entrega | ESLint direcionado                                                         |
