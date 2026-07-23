# Plano: QA e melhoria contínua da TPEC-IA

## Objetivo
Testar a IA em cenários reais, corrigir só o que estiver errado (prompt, roteador, small-talk, lookups) e entregar um relatório com o antes/depois. Nada de reescrever a arquitetura — só cirurgia onde a resposta falhar.

## Etapas

### 1. Auditoria rápida (leitura, sem mudar código)
- Reler `src/lib/chat/core.server.ts`, `query-router.server.ts`, `system-prompt.ts`, `site-lookup.server.ts`, `perplexity.server.ts`.
- Confirmar quais intents já têm short-circuit (small-talk, contagens, listagens, vendedores por região, unidades) e onde ainda vai pra Perplexity.
- Mapear os pontos que historicamente falharam (definições, listagens acidentais, contexto de follow-up, ficha de produto indevida).

### 2. Bateria de testes (via `invoke-server-function` no `/api/chat`)
Rodar em lotes, sempre passando `history` para simular a conversa. Categorias:

1. **Produtos / catálogo**: "quantos produtos tem a dukamp?", "quais em destaque?", "me fale do dukamp 80/s", "tem ração pra ovino?", "preço do adekamp".
2. **Vendedores / equipe**: "quantos vendedores?", "quem são eles?", "e em monte aprazível?", "e em rio preto?", "quem atende Bady Bassit?".
3. **Unidades / institucional**: "onde fica a matriz?", "tem filial?", "qual o telefone?", "atende qual região?".
4. **Categorias**: "quais categorias vocês têm?", "quantas categorias?".
5. **Follow-ups / contexto**: sequência "vendedores" → "quem são?" → "e em rio preto?" → "e categorias?".
6. **Small-talk / reações**: "oi", "ah que legal", "acho que não", "sei lá", "beleza", "hmm".
7. **Ambíguo / typo / informal**: "quanto produt tem?", "toma jeitoo", "tem dukamp 80s ai?".
8. **Técnico (pecuária, sem catálogo)**: "como calcular lotação de brachiaria brizantha?", "qual o NRC atual pra bovino de corte?".
9. **Fora de domínio**: "quais as maiores empresas de pecuária em rio preto?", "qual o preço da soja hoje?".
10. **Sem dado**: "vocês entregam em Manaus?", "qual o horário de atendimento?".

Para cada resposta, anotar: correção factual, naturalidade, contexto, ausência de invenção, ausência de vazamento de fontes/RAG.

### 3. Correções focadas
Só onde a resposta violar um critério. Alvos prováveis (não garantidos até rodar):
- Ajustes finos no `system-prompt.ts` (tom, quando pedir esclarecimento).
- Regex do `query-router.server.ts` (falsos positivos/negativos em contagem, listagem, região).
- Novos casos no `detectSmallTalk` de `core.server.ts`.
- Filtros extras em `site-lookup.server.ts` (stopwords, aliases de cidade).
- Preservar tudo que já funciona; nenhuma alteração em schema, RAG ingest, UI admin ou auth.

### 4. Regressão
Depois de cada correção, re-rodar os testes daquela categoria + os cenários históricos que já funcionavam (contagem de produtos, vendedores por região, small-talk, filtro NRC, ficha só com menção explícita).

### 5. Relatório final
Tabela por pergunta com: resposta antes → problema identificado → correção → resposta depois. Lista separada do que ficou pendente (ex.: dados que não existem em nenhum banco e precisam de intervenção humana da DuKamp).

## Fora de escopo
- Nenhuma mudança de arquitetura, banco, RAG pipeline, UI ou auth.
- Nada de novos providers de IA.
- Não vou popular a base local com dados novos — se faltar dado, isso vira item do relatório.

## Como você acompanha
Vou postar o relatório final consolidado numa única resposta com o antes/depois e o que ficou pendente. Se preferir que eu pause depois da Etapa 2 (bateria + diagnóstico, antes de mexer em código) pra você revisar os problemas, é só dizer.