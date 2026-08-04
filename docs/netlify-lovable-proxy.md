# TPEC-IA: Netlify como frontend/proxy e Lovable como backend privilegiado

## Fluxo

```text
Navegador
  -> POST /api/public/chat na aplicação Netlify
  -> dispatchChat (TPEC_BACKEND_MODE=proxy)
  -> POST HTTPS /api/internal/chat no Lovable
  -> valida x-tpec-proxy-secret
  -> handleIncoming (TPEC_BACKEND_MODE=local)
  -> Supabase principal + RAG + Lovable AI Gateway + Perplexity
```

O navegador nunca recebe `TPEC_PROXY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`LOVABLE_API_KEY`, `OPENAI_API_KEY` ou `PERPLEXITY_API_KEY`.

## Auditoria da rota do chat

Antes desta alteração, o frontend seguia este caminho:

1. `src/routes/index.tsx` chamava `WebChatAdapter.ask()`.
2. `src/lib/chat/web-adapter.ts` chamava a server function `sendChatMessage`.
3. `src/lib/chat.functions.ts` importava dinamicamente `core.server.ts`.
4. `core.server.ts` executava `handleIncoming` no mesmo runtime.

Agora a rota HTTP real usada pelo navegador é:

- `POST /api/public/chat`
- arquivo: `src/routes/api/public/chat.ts`
- handler compartilhado: `src/lib/chat/http.server.ts`

A server function antiga permanece compatível, mas também usa o mesmo dispatcher
local/proxy e não importa o núcleo privilegiado antes da decisão de modo.

## Endpoint interno

- rota: `POST /api/internal/chat`
- arquivo: `src/routes/api/internal/chat.ts`
- somente funciona em `TPEC_BACKEND_MODE=local`
- exige `x-tpec-proxy-secret`
- exige `x-tpec-proxy-hop: 1`
- devolve o resultado completo do `handleIncoming`: `reply`, `state`,
  `conversationId` e `diagnostics`
- não aceita redirecionamentos, cookies ou autorização do navegador

## Módulos privilegiados identificados

A auditoria automatizada pode ser executada com:

```bash
npm run audit:privileged
```

Os principais pontos são:

- `src/integrations/supabase/client.server.ts`
  - lê `SUPABASE_SERVICE_ROLE_KEY`
  - cria `supabaseAdmin`
- `src/lib/chat/query-router.server.ts`
  - importa `supabaseAdmin`
- `src/lib/rag/search.server.ts`
  - importa `supabaseAdmin` e `embedQuery`
- `src/lib/rag/ingest.server.ts`
  - importa `supabaseAdmin` e `embedTexts`
- `src/lib/rag/embeddings.server.ts`
  - lê `LOVABLE_API_KEY`
  - implementa `embedQuery` e `embedTexts`
- `src/lib/knowledge.functions.ts`
  - importa dinamicamente `supabaseAdmin` e o pipeline de ingestão
- `src/lib/products.functions.ts`
  - importa dinamicamente `supabaseAdmin` em operações administrativas
- `src/lib/market.functions.ts` e módulos `src/lib/market/*.server.ts`
  - usam o cliente administrativo em operações de cotações
- `src/lib/chat/core.server.ts`
  - define e exporta `handleIncoming`

Arquivos com sufixo `.server.ts`, handlers `server.handlers` das rotas e handlers de
`createServerFn` são executados no servidor. Arquivos de rota e server functions
podem participar da análise do bundle, por isso imports privilegiados são feitos
dinamicamente apenas dentro do ramo local.

## Configuração no Lovable Cloud

```env
TPEC_BACKEND_MODE=local
TPEC_PROXY_SECRET=<mesmo-segredo-grande-e-aleatorio>
```

O Lovable continua fornecendo internamente:

```env
SUPABASE_SERVICE_ROLE_KEY=...
LOVABLE_API_KEY=...
```

As demais chaves server-side usadas pelo backend local, como Perplexity, continuam
no Lovable.

## Configuração na Netlify

```env
TPEC_BACKEND_MODE=proxy
LOVABLE_BACKEND_URL=https://URL-REAL-DA-APLICACAO-LOVABLE
TPEC_PROXY_SECRET=<mesmo-segredo-grande-e-aleatorio>
```

A Netlify não precisa de:

```env
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY
```

O Supabase comercial secundário permanece independente:

```env
DUKAMP_SITE_SUPABASE_URL=...
DUKAMP_SITE_SUPABASE_ANON_KEY=...
```

## Netlify, TanStack Start e Nitro

- `vite.config.ts` aponta a entrada server do TanStack Start para `src/server.ts`.
- `src/server.ts` carrega `@tanstack/react-start/server-entry` e mantém SSR.
- `NITRO_PRESET=netlify` gera o handler server da Netlify.
- `NODE_VERSION=22` evita depender do runtime Node 20 sem WebSocket nativo.
- `publish=dist` é mantido; não há conversão para site estático.

O deploy preview executa auditoria, testes, lint e build. O build também verifica
que identificadores de segredos server-only não aparecem nos artefatos do cliente.

## Depois de cadastrar as variáveis

Na Netlify:

```text
Deploys -> Trigger deploy -> Clear cache and deploy site
```

Teste o chat e confirme nos logs:

```text
[tpec-backend] mode=proxy
[tpec-proxy] request completed status=200 duration_ms=...
```

No Lovable, o endpoint deve registrar apenas:

```text
[tpec-backend] mode=local
```

Nenhum log inclui o segredo ou o corpo completo da conversa.
