# TPEC-IA

Assistente de IA especialista em pecuária brasileira. Chat web (com arquitetura pronta para WhatsApp), sem persistência, sem cadastro.

## Stack

- TanStack Start (React + SSR em Cloudflare Workers)
- Tailwind CSS v4
- Perplexity API (modelo `sonar`) via server function

## Configuração

1. Copie `.env.example` para `.env` e preencha `PERPLEXITY_API_KEY` (obtenha em https://www.perplexity.ai/settings/api).
2. `bun install`
3. `bun dev` e abra `http://localhost:8080`.

A chave **nunca** é exposta ao frontend — vive apenas no runtime do servidor.

## Arquitetura desacoplada

```
UI (src/routes/index.tsx)
   │
   ▼
WebChatAdapter  ──implementa──►  ChannelAdapter (interface)
   │                                    ▲
   │  chama server fn                   │  (futuro) WhatsAppAdapter
   ▼                                    │
sendChatMessage (src/lib/chat.functions.ts)
   │
   ▼
Chat Core (src/lib/chat/core.server.ts)
   │  valida, sanitiza, rate-limit, monta contexto
   ▼
Perplexity AI Service (src/lib/chat/perplexity.server.ts)
   │  único ponto que lê PERPLEXITY_API_KEY
   ▼
https://api.perplexity.ai/chat/completions
```

Módulos:

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Tipos/contrato | `src/lib/chat/types.ts` | `ChannelAdapter`, `ChatMessage`, limites |
| Prompt | `src/lib/chat/system-prompt.ts` | Persona TPEC-IA |
| Rate limit | `src/lib/chat/rate-limit.server.ts` | Janela em memória (15 req/min por sessão) |
| Serviço IA | `src/lib/chat/perplexity.server.ts` | Chamada à Perplexity, timeout, erros |
| Núcleo | `src/lib/chat/core.server.ts` | Orquestração agnóstica de canal |
| Adapter web | `src/lib/chat/web-adapter.ts` | `WebChatAdapter` (browser) |
| Transporte | `src/lib/chat.functions.ts` | `createServerFn` validado com Zod |
| UI | `src/routes/index.tsx` | Interface do chat |

## Privacidade e ausência de persistência

- ❌ Sem banco de dados
- ❌ Sem `localStorage`, `sessionStorage`, cookies de conteúdo
- ❌ Sem analytics de mensagens
- ❌ Sem logs do conteúdo das conversas (apenas erros técnicos)
- ✅ Histórico existe **apenas na memória da aba** enquanto ela estiver aberta

## Segurança

- Chave da API só no server (`process.env.PERPLEXITY_API_KEY`)
- Validação Zod no server (roles, tamanho, quantidade de turnos)
- Sanitização de caracteres de controle
- Limite de 2000 caracteres por mensagem, 20 turnos de contexto
- Rate limit por sessão (15/min)
- Timeout de 30s na chamada à Perplexity
- Mensagens de erro genéricas para o usuário (sem detalhes internos)

## Como testar

1. Abra a interface e faça uma pergunta técnica (ex.: "Como calcular taxa de lotação?").
2. Verifique que a resposta vem em português, técnica e sugere veterinário quando aplicável.
3. Clique em **Limpar conversa** — o `sessionId` é regenerado e o contexto é descartado.
4. Envie mensagem vazia → erro no cliente.
5. Envie 16 mensagens em <1min → erro de rate limit.
6. Recarregue a página → nenhum histórico permanece.

## Checklist para integração futura com WhatsApp

- [ ] Criar `src/routes/api/public/whatsapp.ts` como server route
- [ ] Implementar `WhatsAppAdapter` em `src/lib/chat/whatsapp-adapter.server.ts` seguindo `ChannelAdapter`
- [ ] Verificar assinatura do webhook (HMAC) antes de processar
- [ ] Mapear payload do provedor (Twilio / Meta Cloud API) para `IncomingMessage`
- [ ] `sessionId` = número do WhatsApp normalizado (E.164)
- [ ] Armazenar histórico curto em cache TTL (Redis/KV) — **não** em banco
- [ ] Chamar `handleIncoming()` do Chat Core (mesmo núcleo do web)
- [ ] Enviar resposta via API do provedor no `adapter.send()`
- [ ] Reaproveitar rate limit por `sessionId`
- [ ] Adicionar secrets do provedor (`WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`) via secure vault
- [ ] Manter Chat Core, prompt e Perplexity Service **inalterados**
