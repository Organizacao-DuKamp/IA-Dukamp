# Auditoria antes das alterações de hospedagem

Base: `13bc4c05b77f0706cae60088a62ea106c2589a1c`, branch `migration/self-hosted-node`.
Leitura feita antes de editar a aplicação: AGENTS.md, README.md, package.json,
netlify.toml, vite.config.ts, .env.example, rotas, integrações, workers e Android.

## Diagnóstico

- React 19/TanStack Start usa `src/server.ts`, SSR Nitro e APIs no mesmo processo.
  Nitro 3.0.260603-beta é fixado no lockfile. O preset atual e o fallback do Vite
  são `netlify`; é necessário verificar e construir `node_server` nesta versão.
- Sete Functions: processamento WhatsApp; recuperação; scheduler de recuperação;
  follow-up; scheduler de follow-up; push Android; scheduler de push.
  Os três schedules são `* * * * *`. Recuperação também executa importações de
  animais. Follow-up inclui memória, Guardiã, pesquisa de clima, regras, relatórios,
  lembretes, memória semântica e perfis observados. Não basta migrar o frontend.
- O POST `/api/public/whatsapp` valida HMAC Meta e encaminha para
  `/.netlify/functions/whatsapp-process-background`. Em produção esse destino é
  obrigatório atualmente. Os schedulers usam self-fetch, `URL`/`DEPLOY_PRIME_URL`
  e cabeçalhos com segredo. Não existem consumidores independentes.
- Supabase já contém filas/reservas duráveis para mensagens, entregas, importações,
  eventos da Guardiã, memória e push, com claims/RPCs e RLS. Preservar tudo.
  Falta uma caixa de entrada durável ANTES do ACK do webhook, fora da Netlify.
- `check-admin-modules.mjs` e `check-ffmpeg-package.mjs` assumem `.netlify`.
  O scan de segredos já reconhece `.output/public`. FFmpeg precisa de ELF correto,
  permissões de execução e diretório temporário gravável no servidor Linux.
- Admin usa Supabase bearer, permissões e validação server-side. Painel do produtor
  usa links pessoais, convites e cookies HttpOnly/SameSite=Strict; tokens dependem
  da service role atual. NÃO rotacionar essa chave nesta migração. As verificações
  CSRF comparam Origin à URL da requisição: proxy precisa preservar origem HTTPS.
- Projetos Supabase principal e comercial permanecem. Comercial é somente leitura.
  Não é necessária migração SQL, cópia de dados ou alteração de RLS para trocar host.
- Serviços: OpenAI, Gemini/DeepSeek/Perplexity opcionais, Meta Graph, Supabase Auth/
  REST/Storage, OAuth Google e FCM, ABCZ por propriedade, IBGE/INMET/Open-Meteo.
- Android `br.com.tpecia.fazenda` 1.2.0 usa `https://www.tpecia.com.br`, WebView,
  cookies persistentes, App Links, Firebase e tarefas locais. PWA tem service
  worker sem cache de dados autenticados. Asset Links é uma rota dinâmica que
  depende de `TPEC_ANDROID_SHA256_CERT_FINGERPRINTS`. Não alterar app ou origem.
- URLs Netlify operacionais: webhook, schedulers, scripts live de QA e workflows
  de QA/CI/catalog refresh. Menções em docs são históricas. `dukamp.netlify.app`
  aparece como proveniência do catálogo de OUTRO site; não substituir sua fonte.
  Inventário reproduzível: `rg -n -i 'netlify|DEPLOY_PRIME_URL' src netlify scripts
build .github README.md .env.example vite.config.ts`.

## Adaptação proposta

1. Tornar `node_server` padrão, mantendo adaptador Netlify explícito para rollback.
2. Persistir webhooks assinados em SQLite local (WAL, volume privado, transações,
   deduplicação, leases, retries e fila de falhas), antes do ACK. Sem schema remoto.
3. Worker supervisionado independente, quatro tipos de trabalho e três tarefas
   recorrentes a cada minuto, com exclusão por tipo e reservas existentes mantidas.
   Chamadas locais autenticadas a handlers internos reutilizam os módulos atuais.
4. Rota interna bloqueada no proxy, token dedicado, limites de corpo, logs sem
   conteúdo/credenciais, liveness/readiness e encerramento com drenagem.
5. Docker Compose com Caddy e volume persistente; alternativa Node + systemd.
   Servidor único com disco local POSIX: SQLite NÃO serve como fila compartilhada
   entre máquinas/NFS. Para escalar horizontalmente, migrar essa fila a um broker
   compartilhado antes de subir outra máquina.
6. Manter domínio canônico www, certificar os dois hosts, redirecionar apex com
   308 preservando método/caminho, configurar origem pública explícita no backend.
7. Validar build, testes, Linux FFmpeg, SSR, API, cookies/links via PostgreSQL local,
   filas e reinício. Testes reais pagos, Firebase/aparelho e configuração do terceiro
   permanecem pendentes sem credenciais/servidor. Nenhuma alteração em produção.
