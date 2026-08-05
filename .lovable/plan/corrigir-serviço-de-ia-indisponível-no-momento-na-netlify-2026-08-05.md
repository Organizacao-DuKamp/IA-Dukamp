# Corrigir "Serviço de IA indisponível no momento" na Netlify

## O que foi verificado agora

- No preview do Lovable o chat responde normalmente (testei com "oi" e com uma pergunta técnica real, ambas com resposta completa do modelo). Ou seja, o backend e a chave da IA estão certos aqui.
- Essa frase exata só é gerada em um ponto do código: quando o servidor tenta chamar o modelo e **não encontra a chave da IA no ambiente** (`PERPLEXITY_API_KEY`, ou `OPENAI_API_KEY` no caminho alternativo). Não é erro de rede nem de crédito — nesses casos as mensagens seriam outras ("Muitas requisições", "créditos esgotados", "demorou demais").
- Conclusão: a Netlify está executando o backend do chat **em modo local** (rodando tudo lá) sem a chave da IA configurada nas variáveis do site.
- Detalhe importante: o app publicado no Lovable (tpecia.lovable.app) hoje responde **404** nas rotas de API (`/api/public/chat` e `/api/internal/chat`). Então, se a ideia for apontar a Netlify para o Lovable (modo proxy), é preciso republicar o app antes, senão o proxy também falha.

## Como corrigir

Existem dois caminhos. Recomendo o A.

### Caminho A — Netlify em modo proxy (recomendado)

A Netlify serve apenas a interface e encaminha o chat para o app do Lovable, que já tem todas as chaves e bancos configurados. Nenhuma credencial sensível fica na Netlify.

1. Republicar o app no Lovable (hoje as rotas de API do publicado estão fora do ar).
2. Nas variáveis de ambiente da Netlify, definir:
   - `TPEC_BACKEND_MODE=proxy`
   - `LOVABLE_BACKEND_URL=https://tpecia.lovable.app`
   - `TPEC_PROXY_SECRET=<mesmo valor grande e aleatório usado no Lovable, 32+ caracteres>`
3. Guardar o mesmo `TPEC_PROXY_SECRET` nos segredos do projeto Lovable (hoje ele não existe lá).
4. Redeploy na Netlify e teste do chat ponta a ponta.

### Caminho B — Netlify em modo local

A Netlify roda o backend inteiro. Aí é preciso ter na Netlify: `PERPLEXITY_API_KEY` (e `PERPLEXITY_MODEL=sonar`), além das chaves de Supabase principal e do site DuKamp. Mais superfície de risco e mais variáveis para manter em dois lugares.

## Melhorias de diagnóstico incluídas

Para não depender de tentativa e erro, ainda vou:

- Tornar a mensagem de erro específica por causa, sem vazar nomes de segredo ao usuário final, mas registrando no log do servidor um código claro (`missing_ai_key`, `proxy_unavailable`, `missing_proxy_secret`) para identificar a origem em segundos.
- Reativar um endpoint de diagnóstico protegido por token (`/api/public/diag`, exigindo o cabeçalho com `QA_TEST_TOKEN`) que responde apenas com "configurada / ausente" para cada variável esperada — nunca o valor. Isso permite conferir o ambiente da Netlify de fora sem expor nada.

## Detalhes técnicos

- Origem da mensagem: `src/lib/chat/perplexity.server.ts` (e o equivalente em `openai.server.ts`), quando `process.env.PERPLEXITY_API_KEY` está vazio.
- Seleção de modo: `src/lib/chat/backend.server.ts` → `resolveTpecBackendMode`, que assume `local` quando `TPEC_BACKEND_MODE` não está definido. É por isso que a Netlify, sem essa variável, tenta rodar o backend sozinha.
- O endpoint de diagnóstico será uma rota `createFileRoute` sob `src/routes/api/public/`, com comparação de token em tempo constante e resposta booleana por variável.

## Próximo passo que depende de você

Depois de aprovar, me diga qual caminho prefere (A ou B). Para o A, eu gero o valor do `TPEC_PROXY_SECRET` e te passo o que colar na Netlify; para o B, você precisará colocar a chave da Perplexity nas variáveis da Netlify.

## Erros de tipagem já existentes no projeto (corrigir junto)

O projeto hoje não compila limpo — há erros de tipo que precisam ser corrigidos no mesmo trabalho, senão o build da Netlify/Lovable pode falhar:

- `src/lib/knowledge.functions.ts`: o tipo local `AdminContext` não bate mais com o cliente Supabase gerado (7 ocorrências em `assertAdmin`). Ajustar o tipo do parâmetro para aceitar o cliente real.
- `src/lib/rag/search.server.ts` (linha 38): a função `search_knowledge_lexical` não existe nos tipos gerados do banco. Alinhar a chamada com o padrão já usado logo acima no mesmo arquivo.
