# Auditoria técnica da TPEC-IA

## Arquitetura e fluxo atual

O chat público envia texto, histórico recente e estado opaco à server function em `chat.functions.ts`. O núcleo em `core.server.ts` sanitiza, limita, aplica rate limit/idempotência por instância, normaliza estado, classifica a continuidade, consulta dados estruturados, site DuKamp, mercado e RAG, chama a Perplexity e valida a resposta antes de atualizar o estado.

A memória possui janela recente, resumo acumulado, fatos, decisões, entidades e pendências em `state.ts`. Ela ainda é custodiada pelo navegador: não há tabela server-owned de conversas. O RAG extrai TXT/PDF/DOCX/XLS(X)/CSV, divide em chunks 1.200/180, gera embeddings e combina RPC semântica com full-text search lexical, deduplicação e score mínimo no orquestrador.

A integração ativa usa Perplexity Chat Completions. Foi criada uma camada OpenAI server-only para Responses API, pronta para homologação; não foi ativada automaticamente para evitar mudança de provedor sem configuração e testes online. Modelos são centralizados por variáveis de ambiente.

## Problemas e riscos encontrados

- Memória controlada pelo cliente pode ser perdida ou adulterada; persistência futura exige autenticação, RLS, retenção e consentimento.
- Rate limit, lock e idempotência usam memória da instância e não são globais em serverless.
- Status de pedido não pode ser executado com segurança sem verificar ownership; somente o contrato tipado foi criado.
- Upload público de anexo/áudio não existe; extração está restrita à ingestão administrativa.
- Metadados RAG ainda não cobrem de forma normalizada todos os campos pedidos, nem há reranker dedicado.
- Logs são estruturados no console, mas não há armazenamento de custo, feedback, latência agregada ou painel.
- Uma credencial Perplexity foi compartilhada no pedido. Ela não foi reproduzida em arquivos; deve ser rotacionada imediatamente.
- O merge anterior removeu incorretamente dos tipos a RPC `search_knowledge_lexical`, embora a migração SQL versionada a crie. A tipagem foi restaurada.

## Separação e segurança das fontes

Dados comerciais (produto, estoque, preço, vendedor e contato) priorizam bases internas. Conteúdo técnico usa trechos internos relevantes. Mercado e informação temporal exigem consulta atual. Conteúdo RAG é tratado como dado não confiável e passa por neutralização de prompt injection. A validação final remove citações numéricas sem mapa e bloqueia preço/estoque sem evidência comercial.

## Proposta e ordem de implementação

1. Concluído nesta entrega: intenção estruturada, contratos de ferramentas, cliente OpenAI Responses, configuração central de modelos, sanitização RAG, grounding e 40 avaliações offline.
2. Persistir conversa/resumo no servidor com RLS, consentimento e política de retenção.
3. Implementar executor uniforme (`ok`, `not_found`, `timeout`, `internal_error`); pedidos exigem autenticação/ownership.
4. Normalizar metadados, filtros e reranking do RAG.
5. Ativar seleção de provedor por feature flag, circuit breaker e testes online.
6. Persistir telemetria sem mensagem bruta: duração, tokens, custo, falhas, baixa confiança e feedback.
7. Implementar anexos com MIME/limites/antivírus e política de retenção.

## Critérios de conclusão

- 40 avaliações independentes e testes de contexto, vendedor, segurança, ferramentas, grounding e memória passam.
- TypeScript e build passam; lint dos arquivos alterados passa.
- Segredos permanecem server-side; citações e fatos comerciais exigem evidência.
- Resultado vazio, timeout e erro interno são diferenciados nas futuras execuções de ferramentas.
- Recursos que dependem de autenticação ou configuração externa não são apresentados como concluídos.

## Implantação

Rotacione a chave Perplexity compartilhada. Configure `PERPLEXITY_MODEL` opcionalmente. Para homologar OpenAI, configure no servidor `OPENAI_API_KEY`, `OPENAI_FAST_MODEL` e `OPENAI_CAPABLE_MODEL`; o pipeline ativo continua na Perplexity. Aplique migrações já versionadas e confirme RLS. Execute instalação limpa, testes, TypeScript, lint direcionado e build.
