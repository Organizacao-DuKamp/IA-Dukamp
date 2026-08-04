# TPEC-IA

Assistente de IA especialista em pecuária brasileira, com chat web, memória curta de conversa, base RAG e integração comercial somente leitura com o Supabase do site DuKamp.

## Stack

- TanStack Start + React 19
- Nitro para SSR/server handlers
- Netlify como frontend e proxy seguro
- Lovable Cloud como backend privilegiado
- Supabase principal para RAG e dados internos
- Supabase secundário DuKamp para produtos e vendedores públicos
- Perplexity como provedor principal de respostas

## Desenvolvimento local

```bash
npm install
npm run dev
```

Use `.env.example` como referência. Sem `TPEC_BACKEND_MODE`, o projeto usa `local` para preservar o funcionamento existente.

## Arquitetura híbrida de deploy

```text
Navegador
  -> POST /api/public/chat na Netlify
  -> função server da Netlify
  -> POST /api/internal/chat no Lovable, autenticado por segredo
  -> handleIncoming
  -> Supabase principal + RAG + Lovable AI Gateway + Perplexity
```

A decisão ocorre no servidor:

- `TPEC_BACKEND_MODE=local`: importa e executa `handleIncoming` no runtime atual.
- `TPEC_BACKEND_MODE=proxy`: não importa o núcleo privilegiado; encaminha ao Lovable.

### Lovable Cloud

```env
TPEC_BACKEND_MODE=local
TPEC_PROXY_SECRET=<segredo-grande-e-aleatorio>
```

O Lovable continua gerenciando internamente:

```env
SUPABASE_SERVICE_ROLE_KEY=...
LOVABLE_API_KEY=...
```

### Netlify

```env
TPEC_BACKEND_MODE=proxy
LOVABLE_BACKEND_URL=https://URL-REAL-DA-APLICACAO-LOVABLE
TPEC_PROXY_SECRET=<mesmo-segredo-do-Lovable>
```

A Netlify não precisa receber `SUPABASE_SERVICE_ROLE_KEY` nem `LOVABLE_API_KEY`.

Depois de cadastrar as variáveis:

```text
Netlify -> Deploys -> Trigger deploy -> Clear cache and deploy site
```

A documentação completa está em [`docs/netlify-lovable-proxy.md`](docs/netlify-lovable-proxy.md).

## Supabase comercial da DuKamp

A integração permanece separada e somente leitura:

```env
DUKAMP_SITE_SUPABASE_URL=...
DUKAMP_SITE_SUPABASE_ANON_KEY=...
```

A tabela pública `sellers` fornece os vendedores ativos e a tabela `products` fornece o catálogo comercial. A chave deve ser `anon`/publicável, nunca `service_role`. Mantenha RLS ativa e conceda apenas `SELECT` aos registros públicos.

## Caminho do chat

```text
src/routes/index.tsx
  -> src/lib/chat/web-adapter.ts
  -> POST /api/public/chat
  -> src/lib/chat/http.server.ts
  -> src/lib/chat/backend.server.ts
       local -> src/lib/chat/core.server.ts
       proxy -> Lovable /api/internal/chat -> core.server.ts
```

A server function `src/lib/chat.functions.ts` continua disponível para compatibilidade, mas usa o mesmo dispatcher local/proxy.

## Segurança

- O navegador nunca recebe `TPEC_PROXY_SECRET` ou chaves privadas.
- O proxy não encaminha cookies, `Authorization` ou headers do navegador.
- O endpoint interno aceita somente POST, exige segredo e só funciona em modo local.
- O proxy usa HTTPS em produção, timeout, limite de tamanho e `redirect: "error"`.
- O build verifica que identificadores de segredos server-only não aparecem no bundle do cliente.
- Logs não incluem segredos nem o corpo completo das conversas.

## Netlify e Nitro

O `vite.config.ts` usa `src/server.ts` como entrada do TanStack Start. O `netlify.toml` mantém:

```toml
NITRO_PRESET = "netlify"
NODE_VERSION = "22"
```

O diretório publicado continua sendo `dist`; o projeto não é convertido em deploy estático e continua gerando o handler server da Netlify.

## Validação

```bash
npm run audit:privileged
npm test
npm run lint
npm run build
```

O deploy preview da Netlify executa essa sequência automaticamente.
