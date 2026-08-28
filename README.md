# TPEC-IA

Assistente de IA especialista em pecuária brasileira, com vitrine institucional em `/`, atendimento pelo WhatsApp, memória curta de conversa, base RAG, previsão meteorológica aprofundada por região e integração comercial somente leitura com o Supabase do site DuKamp.

## Stack

- TanStack Start + React 19
- Nitro para SSR/server handlers
- Netlify como frontend e backend server-side
- Supabase TPEC-IA para RAG e dados internos
- Supabase secundário DuKamp para produtos e vendedores públicos
- OpenAI para raciocínio, resposta final e embeddings do RAG
- Perplexity exclusivamente para pesquisa externa atual

## Desenvolvimento local

```bash
npm install
npm run dev
```

Use `.env.example` como referência. O backend roda diretamente no runtime server-side da Netlify.

## Arquitetura de deploy independente

```text
Navegador
  -> GET / na Netlify
  -> vitrine TPEC-IA
  -> botão abre a conversa oficial no WhatsApp

Meta WhatsApp
  -> POST /api/public/whatsapp na Netlify
  -> handleIncoming no próprio runtime da Netlify
  -> Supabase TPEC-IA + RAG OpenAI + pesquisa atual + resposta OpenAI
```

O backend completo é carregado no servidor da Netlify e recebe como secrets:

```env
SUPABASE_URL=https://cawgzodelwchccilqeqr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

Modelos podem ser definidos sem alterar código:

```env
OPENAI_CAPABLE_MODEL=gpt-5
OPENAI_FAST_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
PERPLEXITY_MODEL=sonar
```

O fluxo por mensagem é: bancos internos e RAG recuperam evidências; quando a
pergunta exige informação atual, a Perplexity pesquisa a web; por fim, a OpenAI
recebe histórico, estado, RAG e pesquisa para raciocinar e produzir a única
resposta enviada ao usuário.

## Previsão do tempo aplicada à pecuária

Pedidos de chuva, temperatura, vento, geada, tempestade ou previsão do tempo
usam uma intenção própria. Sem localização confirmada, a TPEC-IA pergunta cidade
e UF e aguarda a resposta. A localização fica no estado da conversa para
continuações como “e amanhã?”, mas é substituída quando o usuário informar outra.

Com a região confirmada, a Perplexity usa contexto de busca alto e prioriza
fontes meteorológicas oficiais e regionais. A resposta final precisa identificar
local, data, hora/fuso e fontes, sintetizar agora/24 horas/7 dias quando houver
dados e relacionar a previsão a decisões pecuárias como conforto térmico, água,
sombra, manejo, transporte, pastagem, alimentos, lama, geada, raios e fogo.
Respostas sem localização, data, fonte ou elementos meteorológicos são
reprocessadas antes do envio.

Depois da migração para embeddings OpenAI, documentos legados aparecem como
`aguardando` no painel da base de conhecimento. A busca lexical continua
funcionando durante a transição. Use **Processar pendentes** para reindexá-los
gradualmente no novo espaço vetorial.

### Netlify

```env
SUPABASE_URL=https://cawgzodelwchccilqeqr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret-do-TPEC-IA>
OPENAI_API_KEY=<chave-da-OpenAI>
```

As variáveis `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` são server-only e
não aparecem no bundle do navegador. Se a pesquisa legada da Perplexity ainda
estiver configurada, ela pode ser removida do ambiente; o fluxo atual usa a
pesquisa Web nativa da OpenAI.

Depois de cadastrar as variáveis:

```text
Netlify -> Deploys -> Trigger deploy -> Clear cache and deploy site
```

A configuração do deploy está em `netlify.toml`; o preset do Nitro gera o
handler server da Netlify junto com o frontend.

## Mídia recebida pelo WhatsApp

O webhook aceita texto, áudio, imagem, vídeo e documento. A mensagem conserva o
mesmo fluxo de idempotência e entrega do texto: o backend privado baixa a mídia
diretamente da Meta, valida formato, tamanho e integridade, extrai um texto
seguro e só então chama o núcleo da TPEC-IA com o histórico existente.

- Áudios são transcritos; imagens e documentos são analisados pelo modelo multimodal.
- Vídeos usam a legenda e a transcrição da faixa de áudio; o arquivo visual completo não é enviado ao modelo.
- Cada arquivo pode ter até 25 MB. O conteúdo bruto não é salvo no histórico.
- São aceitas imagens JPG, PNG, WebP e GIF; áudios/vídeos AAC, FLAC, M4A, MP3, MP4, MPEG, OGG, WAV e WebM; e documentos comuns como PDF, Word, Excel, PowerPoint, CSV e texto.

`WHATSAPP_ACCESS_TOKEN` precisa existir como segredo server-only na Netlify para
receber, baixar e enviar mídias. Os modelos opcionais são
`OPENAI_MEDIA_MODEL` (padrão `gpt-4o-mini`) e `OPENAI_TRANSCRIPTION_MODEL`
(padrão `gpt-4o-mini-transcribe`). `OPENAI_MEDIA_IMAGE_DETAIL` aceita `low`,
`high` ou `auto`; sem configuração, fotos comuns usam `low` e pedidos de leitura
de texto, tela ou tabela usam `high`.

Quando uma consulta demora, o webhook usa uma única reserva durável para exibir
o indicador nativo de digitação do WhatsApp. Nenhuma mensagem textual de
“estou processando” é adicionada à conversa, inclusive em retries do webhook.

## Supabase comercial da DuKamp

A integração permanece separada e somente leitura:

```env
DUKAMP_SITE_SUPABASE_URL=...
DUKAMP_SITE_SUPABASE_ANON_KEY=...
```

A tabela pública `sellers` fornece os vendedores ativos e a tabela `products` fornece o catálogo comercial. A chave deve ser `anon`/publicável, nunca `service_role`. Mantenha RLS ativa e conceda apenas `SELECT` aos registros públicos.

## Caminho do atendimento pelo WhatsApp

```text
src/routes/api/public/whatsapp.ts
  -> src/lib/whatsapp/enhanced-http.server.ts
  -> src/lib/whatsapp/backend.server.ts
       -> src/lib/whatsapp/conversation.server.ts
  -> src/lib/chat/core.server.ts
```

A rota `/` não carrega cliente de chat nem formulário de mensagens. Ela apresenta a TPEC-IA e direciona todos os chamados para o WhatsApp oficial.

## Segurança

- O navegador nunca recebe chaves server-only.
- O backend privilegiado roda somente no handler server-side da Netlify.
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
