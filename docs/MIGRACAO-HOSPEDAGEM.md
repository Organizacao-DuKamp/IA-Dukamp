# Migração da TPEC-IA para hospedagem própria

Esta entrega prepara o código; não muda DNS, Meta, Supabase, Firebase nem produção.
A auditoria anterior à implementação está em [AUDITORIA-HOSPEDAGEM.md](AUDITORIA-HOSPEDAGEM.md).
O domínio canônico permanece **https://www.tpecia.com.br**. O apex
`https://tpecia.com.br` redireciona com 308, preservando caminho, query e método.
O domínio e o certificado de assinatura do Android não mudam.

## 1. Arquitetura anterior e nova

Antes: Netlify hospeda SSR e APIs; webhook encaminha para Background Function;
três Scheduled Functions disparam workers a cada minuto. Supabase mantém dados,
sessões, conhecimento e filas de negócio. Integrações externas são server-side.

Agora:

```text
Internet -> Caddy (HTTPS, canonical www) -> Node 24 / Nitro node_server
                                          | SSR + APIs + webhook Meta
                                          | ACK após commit SQLite
                                          v
                               /var/lib/tpecia/jobs.sqlite (WAL)
                                          ^
                             worker Node supervisionado, separado
                                          |
                          HTTP privado + token + lease da tarefa
                                          v
                               /api/internal/jobs (bloqueada no proxy)
                                          |
                        módulos existentes WhatsApp / IA / Guardiã / FCM
                                          |
                        Supabase existente / Meta / provedores / Firebase
```

Não há banco novo no Supabase, alteração de schema ou cópia de dados. SQLite é
somente transporte durável local; Supabase continua autoritativo para histórico,
reservas por mensagem, respostas, entregas, eventos, permissões e dados da fazenda.
As Functions antigas ficam no repositório para rollback de infraestrutura, mas
não são instaladas nem chamadas no modo `TPEC_RUNTIME=node`.

| Function antiga                   | Substituto no worker                       | Frequência         |
| --------------------------------- | ------------------------------------------ | ------------------ |
| whatsapp-process-background       | fila `whatsapp`, handler existente         | ao receber webhook |
| whatsapp-retry-background         | fila `recovery`, recuperação e importações | via scheduler      |
| whatsapp-retry-scheduler          | scheduler persistente                      | 60 segundos        |
| whatsapp-followup-background      | fila `followup`, memória e Guardiã         | via scheduler      |
| whatsapp-followup-scheduler       | scheduler persistente                      | 60 segundos        |
| guardian-app-reminders-background | fila `push`, FCM                           | via scheduler      |
| guardian-app-reminders            | scheduler persistente                      | 60 segundos        |

O scheduler recupera um ciclo ao iniciar, coalesce ciclos atrasados e impede
acúmulo de manutenções iguais. As próprias filas de negócio procuram eventos
vencidos, respeitando suas validades/consentimentos. Uma manutenção que demore
mais de um minuto não se sobrepõe a outra do mesmo tipo. Há quatro lanes: um
webhook por vez e três manutenções independentes. Não aumentar concorrência sem
avaliar limites de IA e ordenação de mensagens por produtor.

## 2. Requisitos do provedor

Solicite ao administrador, antes de contratar:

- Linux x86_64 ou ARM64 com **Node.js 24.22.1**, npm e execução persistente de
  dois processos (web e worker), supervisionados pelo systemd. Esta versão é
  exigida por package.json e também fornece `node:sqlite`; testar o mesmo release.
- Recomendação inicial **2 vCPU, 4 GB RAM**, 20 GB SSD livres, swap monitorada.
  Builds podem exigir mais RAM; medir carga real de vídeo/PDF/IA e ajustar.
  O build pode acontecer em outra máquina Linux da mesma arquitetura.
- Disco POSIX local persistente e gravável para a fila. **Não usar NFS, volume
  efêmero, pasta pública ou múltiplos servidores compartilhando SQLite**.
- Portas públicas TCP 80/443 para Caddy/ACME e aplicação. Porta 3000 somente
  loopback; nunca abri-la na Internet.
- Saída HTTPS/DNS para Supabase (Auth/REST/Storage), OpenAI, Gemini, DeepSeek,
  Perplexity, graph.facebook.com e hosts de mídia Meta, oauth2.googleapis.com,
  fcm.googleapis.com, ABCZ, IBGE, INMET e Open-Meteo. Builds precisam npm/GitHub
  e download do binário ffmpeg-static. Proxy corporativo precisa CA confiável;
  nunca desativar validação TLS.
- systemd, Caddy 2.10.2, Git, curl, CA certificates e ferramentas
  de backup/logs. FFmpeg vem de ffmpeg-static; não requer instalação global,
  mas exige execução do ELF e `/tmp` gravável. Reserve ao menos 512 MB temporários;
  mídia continua limitada pela aplicação a 25 MB e vídeo a 10 minutos.
- Relógio sincronizado (NTP), monitoramento de disco/RAM e acesso administrativo
  para instalar serviço/proxy/firewall. Não é suficiente oferecer apenas PHP,
  FTP ou hospedagem compartilhada sem processos Node permanentes e disco local.

A configuração entregue é de **um servidor**. Para HA ou múltiplas máquinas,
substituir a fila local por broker transacional compartilhado antes de escalar.

## 3. Configuração: valores públicos e segredos

Use `.env.example` como inventário e transfira **os valores atuais**, sem postar
segredos em chat, PR, logs ou tickets. Não copie o arquivo preenchido para Git.
Os projetos Supabase, chaves usadas para assinar sessões, IDs Meta e conta FCM
continuam os mesmos. Não rotacione service role durante a migração: links/sessões
existentes dependem da chave. Copie também flags e overrides de modelos/tarifas;
não ative nem desative funcionalidades para simplificar a mudança.

Para Node direto, crie `/etc/tpecia/build.env` (somente público) e
`/etc/tpecia/tpecia.env` (privado), ambos fora do checkout.
Nunca passe chaves de IA/service role ao build ou com prefixo `VITE_`.

Build público obrigatório:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO-EXISTENTE.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CHAVE_PUBLICAVEL_EXISTENTE
VITE_SUPABASE_PROJECT_ID=SEU-PROJETO-EXISTENTE
```

O domínio/projeto dessas variáveis deve corresponder ao backend. Alterá-las
exige rebuild, pois entram no JavaScript. `SUPABASE_*` sem VITE são de runtime.

| Grupo              | Variáveis de runtime                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | `NODE_ENV=production`, `TPEC_RUNTIME=node`, `PUBLIC_ORIGIN=https://www.tpecia.com.br`, `HOST=127.0.0.1`, `PORT=3000`, `TPEC_DATA_DIR=/var/lib/tpecia`, `TPEC_INTERNAL_ORIGIN=http://127.0.0.1:3000`, `SERVER_SHUTDOWN_TIMEOUT=1560` |
| Fila privada       | `TPEC_WORKER_TOKEN` novo, aleatório, >=32 caracteres; `WHATSAPP_STATE_STORE=supabase`                                                                                                                                               |
| Supabase principal | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`; preservar `SUPABASE_PROJECT_ID` se já usado                                                                                                                |
| Supabase comercial | `DUKAMP_SITE_SUPABASE_URL`, `DUKAMP_SITE_SUPABASE_ANON_KEY`; acesso somente leitura, nunca service role                                                                                                                             |
| IA                 | `OPENAI_API_KEY`; se `TPEC_MULTIMODEL_ENABLED=true`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `PERPLEXITY_API_KEY`; preservar modelos, embeddings, preços e limites de `.env.example`                                                  |
| WhatsApp           | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_API_VERSION`                                                                                                   |
| Guardiã/proativo   | `TPEC_GUARDIAN_ENABLED`, `WHATSAPP_PROACTIVE_ENABLED`, nomes/idiomas dos templates; manter flags atuais e consentimentos no banco                                                                                                   |
| Firebase           | `TPEC_FCM_PROJECT_ID`, `TPEC_FCM_CLIENT_EMAIL`, `TPEC_FCM_PRIVATE_KEY` da conta atual; os três ou nenhum. Para preservar push ativo, os três são obrigatórios                                                                       |
| Android            | `TPEC_ANDROID_SHA256_CERT_FINGERPRINTS` do certificado ORIGINAL/Play Signing; não criar certificado novo                                                                                                                            |
| ABCZ               | `ABCZ_SOFTWARE_ID`, `ABCZ_FARM_CREDENTIALS_JSON`, se a integração atual estiver habilitada                                                                                                                                          |
| Admin opcional     | `QA_TEST_TOKEN`, `MARKET_INGEST_TOKEN`, limites `RATE_LIMIT_*`, demais overrides existentes                                                                                                                                         |
| Caddy | `ACME_EMAIL` de contato real, configurado no serviço Caddy. |

Gere token dedicado: `openssl rand -hex 32`. Mesma configuração web/worker.
Para PEM Firebase, use valor entre aspas com quebras `\n`; o adapter converte.
O carregamento Node usa `--env-file`, inclusive systemd, para evitar diferenças
entre interpretadores de dotenv. Proteja o arquivo: `root:tpecia`, modo 0640;
`build.env` contém somente valores públicos. Não habilite `set -x` com segredos.

```bash
node --env-file=/etc/tpecia/build.env scripts/check-config.mjs --build
node --env-file=/etc/tpecia/tpecia.env scripts/check-config.mjs
```

Os processos recusam início se faltam variáveis essenciais, se origem não é
HTTPS, se fila não tem caminho absoluto, se token é curto, se FCM está parcial
ou se modo memória foi configurado. Verifique os mesmos valores nos processos web e worker. `TPEC_WHATSAPP_BACKGROUND=false` não desativa fila no modo Node.
Para desenvolvimento com `npm run dev`, não use as variáveis de produção:
deixe `TPEC_RUNTIME` ausente e use credenciais de integração isoladas.

## 4. Node direto + systemd

Instale Node 24.22.1 (verifique `node --version`) e Caddy. Os exemplos de units
assumem `/usr/local/bin/node`; adapte para o caminho real do administrador.
Não use nvm interativo dentro de systemd.

```bash
sudo useradd --system --home-dir /var/lib/tpecia --shell /usr/sbin/nologin tpecia
sudo install -d -m 0700 -o tpecia -g tpecia /var/lib/tpecia
sudo install -d -m 0750 -o root -g tpecia /etc/tpecia
sudo mkdir -p /opt/tpecia/releases
# Provisionar build.env e tpecia.env; chmod 0640 e chown root:tpecia.
# No checkout Linux revisado, após npm ci:
node --env-file=/etc/tpecia/build.env scripts/build-node.mjs
node --env-file=/etc/tpecia/tpecia.env scripts/check-config.mjs
```

Instale o checkout com `.output` em `/opt/tpecia/releases/COMMIT` e crie symlink
`/opt/tpecia/current` para ele. Garanta leitura/travessia para usuário `tpecia`,
sem conceder escrita nos arquivos da aplicação. O runtime precisa de `.output`,
`package.json`, `scripts/{start,worker,check-config,queue}.mjs` e
`src/lib/runtime/{config,queue}.server.ts`. Não precisa de npm/node_modules raiz:
Nitro inclui dependências server-side em `.output/server/node_modules`.

```bash
sudo cp deploy/systemd/tpecia-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tpecia-web tpecia-worker
sudo journalctl -u tpecia-web -u tpecia-worker -n 100 --no-pager
curl --fail http://127.0.0.1:3000/readyz
```

Copie `deploy/Caddyfile` para a configuração do Caddy; substitua o contato ACME
ou defina `ACME_EMAIL` no serviço Caddy. O upstream padrão é 127.0.0.1:3000.
Valide com `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`,
e recarregue o proxy. Só o proxy pode alcançar Node pela rede.

## 5. HTTPS, proxy, cookies, CORS e refresh

Caddy emite/renova HTTPS para **os dois hosts**, aplica HSTS, redireciona apex
com 308 e encaminha todas as rotas ao Nitro, inclusive assets, APIs e páginas
abertas diretamente. Não use fallback estático `/index.html` de SPA: há SSR.
A rota interna `/api/internal/*` e caminhos `/.netlify/*` retornam 404 no proxy.
O handler interno exige ainda token dedicado e lease válido, mesmo em loopback.

`PUBLIC_ORIGIN` reconstrói a origem HTTPS usada pelo backend sem confiar no
Host/X-Forwarded-Host recebido da Internet. `Host` do proxy é fixado em www.
Cookies continuam HttpOnly, SameSite=Strict e Secure; verificações Origin e
permissões não foram afrouxadas. Não usar CORS `*` nem autorizar origens novas
sem necessidade. Preserve a mesma origem e os valores de secrets para que as
sessões do browser/WebView continuem válidas. Endpoints autenticados não devem
ter cache no proxy; o service worker já não armazena dados da fazenda.

## 6. Registro.br: plano de DNS (não executado)

Primeiro confirme onde o DNS é autoritativo (`NS`). Registro.br pode delegar
para outro provedor; nesse caso, editar na zona autoritativa, sem trocar NS
às cegas. Faça backup da zona. Confirme IPs com o administrador do novo host.

| Nome no painel DNS            | Tipo  | Valor novo              | Ação na janela de corte                                                                            |
| ----------------------------- | ----- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| vazio / `@` / `tpecia.com.br` | A     | `IPV4_DO_NOVO_SERVIDOR` | substituir somente destino web antigo                                                              |
| `www`                         | CNAME | `tpecia.com.br.`        | substituir CNAME web antigo; remover A/AAAA conflitantes só desse nome                             |
| vazio / `@`                   | AAAA  | `IPV6_DO_NOVO_SERVIDOR` | somente se IPv6 estiver configurado/testado; remover AAAA web antigo que leve ao servidor anterior |

Não criar AAAA fictício. Se o provedor exigir A em www, usar o mesmo IPv4 em
vez de CNAME, nunca ambos no mesmo nome. TTL sugerido 300 segundos quando o
provedor permitir, reduzido pelo menos um TTL antigo antes do corte.
**Preservar MX, TXT (SPF/DKIM/DMARC), CAA existente, verificações e subdomínios de
outros serviços.** Se CAA restringe emissores, coordenar certificado com o
administrador antes do corte; não remover políticas sem revisão.
O CNAME `www -> apex` é compatível com o redirect HTTP apex -> www, pois DNS
resolve endereço e não executa redirects HTTP.

Não alterar registros reais nesta entrega. Após autorização futura: confirmar
A/AAAA/CNAME de fora da rede, HTTPS nos dois hosts, renovação e ausência de
tráfego enviado ao host antigo. Manter Netlify disponível para rollback DNS.

## 7. Meta, Supabase, Firebase, Android e PWA

**Meta:** a URL continua `https://www.tpecia.com.br/api/public/whatsapp`.
Preserve verify token, app secret, token permanente e phone number ID. Se o
painel Meta já usa essa URL, não precisa alterá-lo: DNS muda o destino. Se ainda
usa netlify.app, preparar mudança futura de callback e revalidar GET challenge
com token existente. POST exige `x-hub-signature-256`; não testar com assinatura
falsa e marcar como integração aprovada. Testar status callbacks e retries também.

**Supabase:** projetos, tabelas, storage, RLS e usuários permanecem. Não executar
`db reset`, seeds, migrações ou cópia de bancos para esta troca de host. Conferir
Auth > URL Configuration: Site URL canônica www e redirects realmente utilizados
pelo admin (ex.: `https://www.tpecia.com.br/` e `/auth`, conforme fluxo existente).
Sem mudança se já corretos. Evitar wildcard amplo em produção. Preservar rotas de
callbacks OAuth configuradas no projeto. Validar SELECT/UPDATE autorizado e
negação para outro produtor usando ambiente de homologação; não abrir RLS para
contornar configuração incorreta. Chave comercial continua anon/publicável.

**Firebase:** mesma conta server-side, projeto e aplicativo; não precisa domínio
novo para FCM HTTP v1. Confirmar API habilitada, IAM e entrega a dispositivo com
permissão. Nunca publicar PEM. Push só contém sinal de sincronização; app busca
conteúdo após autenticação. Ausência de configuração deixa push inerte, por isso
não aceitar essa situação se produção hoje envia notificações.

**Android:** não alterar package, certificado original, PANEL_ORIGIN, App Links,
Keystore ou armazenamento de sessão. `/painelfazenda`, links com fragmentos e
convites continuam iguais. Confirmar `/.well-known/assetlinks.json` em www com
HTTP 200 JSON, certificado SHA-256 correto e sem intersticial de autenticação.
Apex redireciona, mas o app atual verifica www. Abrir link pessoal e convite no
APK existente; testar fechar/reabrir e reinício do aparelho, alarmes e push.
PWA deve abrir a mesma rota e manter service worker sem cache de dados privados.
Nenhum rebuild/redistribuição de APK é exigido apenas pela mudança de host.

## 8. Fila, falhas, idempotência e dados privados

SQLite usa WAL, synchronous FULL, transações e permissões 0700/0600; limite de
webhook 240 KiB antes do commit. Confirmação HTTP 200 somente após persistência.
Assinatura Meta é validada antes de gravar e novamente no processamento.
Duplicatas do envelope usam hash; mensagens continuam deduplicadas pelo ID Meta
no Supabase. Entrada normalizada agora é salva atomicamente junto ao claim,
para recuperar queda entre reserva e execução. Dados/mídia não entram em logs.

Cada lane reserva uma tarefa, com token de fencing e lease de 30 minutos,
renovado a cada 30 s. O worker aguarda no máximo 25 min por HTTP. Após falha de
transporte incerta não libera imediatamente: o servidor poderia estar enviando
uma resposta. Uma tarefa órfã pode aguardar até 30 min; as reservas de negócio
mantêm a recuperação de mensagens mais rápida quando aplicável. Não reduzir
leases sem medir a duração real. Encerramento SIGTERM drena trabalho; systemd aguarda 27 min. Em falta de energia/KILL, a fila e o Supabase retomam.

Falhas confirmadas têm backoff exponencial de 5 s até 5 min, com até 10 tentativas
antes de `dead`. O scheduler não perde as tarefas de negócio persistidas no
Supabase durante indisponibilidade. Não há garantia de entrega exatamente uma
vez do lado Meta: aceite remoto seguido de falha de ACK é ambíguo, como no fluxo
anterior. Leases conservadores e recibos evitam reenvio imediato. Não apagar
recibos nem forçar reenvio de uma entrega incerta sem verificar na Meta.

Payload de job concluído é apagado imediatamente; hashes concluídos duram 7 dias.
Payload de falha fica até 7 dias para replay e depois é limpo. Proteja o volume
com criptografia de disco e backups com retenção restrita: ele contém texto
privado de webhooks, nunca mídia bruta ou secrets de API. A SQLite não é um
arquivo de diagnóstico para anexar a tickets. Não copiar o `.sqlite` vivo sozinho:
parar os dois processos e copiar diretório inteiro com WAL/SHM ou usar backup
SQLite consistente. Dados do Supabase continuam seguindo seu próprio backup.

```bash
# Estado local (não imprime mensagens nem tokens)
node --env-file=/etc/tpecia/tpecia.env scripts/queue.mjs
# Após investigar uma falha confirmada, reabrir job morto ainda retido:
node --env-file=/etc/tpecia/tpecia.env scripts/queue.mjs replay ID_DA_TAREFA
```

Execute os comandos de fila como o usuário `tpecia` (por exemplo, com `sudo -u tpecia`), para preservar as permissões do banco local.

## 9. Atualização, publicação e rollback

Nunca alterar uma pasta de release em execução. Identificar cada release por SHA
completo e manter versão anterior, seu artefato Linux e o arquivo de variáveis
compatível. Não sobrescrever nem recriar o diretório persistente da fila em atualizações.

Node direto: `deploy/release.sh SHA_COMPLETO` é exemplo executado pelo
administrador (não por este PR). Clona release revisado, instala dependências,
builda somente com `build.env`, valida runtime, para worker primeiro e depois
web, troca symlink atomicamente e inicia ambos. `/readyz` precisa ficar saudável;
se não ficar, restaura symlink anterior. Revise paths/ownership antes de adotar.
Durante a breve parada web, a Meta recebe erro e reenviará webhooks.

Rollback manual Node: parar worker, parar web, apontar `current` ao release
anterior completo, iniciar web e worker e verificar `/readyz`. Não reverter
banco ou apagar filas. Se voltou a release pré-migração Netlify, ela não consome
SQLite: drenar a fila antes ou preservar o volume e voltar ao runtime compatível
para consumir pendências. No rollback DNS, drenar primeiro tarefas locais já confirmadas; só então parar o
worker Node e reativar schedulers antigos. Se o worker precisar continuar, desativar
as manutenções na outra origem até a drenagem. Não manter dois schedulers ativos.

O diretório `/var/lib/tpecia`, os dados de Caddy e o diretório de secrets são permanentes.

CI valida build Node e smoke test sem Netlify. O workflow opcional
`self-hosted-release.yml` gera artefato por GitHub Actions (workflow_dispatch),
sem publicar nem tocar servidor. O terceiro pode baixar artefato revisado para
uma nova release. Para deploy automático futuro, usar ambiente GitHub protegido,
chave SSH restrita e comando de release fixo; não guardar senha/root no workflow.

## 10. Monitoramento e logs

- `/healthz`: liveness do processo web, não testa provedores/banco.
- `/readyz`: 200 se worker autenticou e deu heartbeat há menos de 90 s, 503 se
  indisponível. Não comprova validade de chaves externas ou fila sem falhas.
- `queue.mjs`: contagens por estado, idade da tarefa mais antiga e heartbeat.
  Alertar para `dead>0`, pendências crescendo, lease expirando, disco >80%,
  reinícios frequentes, `/readyz` 503 e falhas/retries de manutenção.
- Logs estruturados: `worker_started`, `worker_draining`, `queue_enqueue_failed`,
  `job_done`, `job_failed`, `worker_dispatch_uncertain`, `maintenance_summary`.
  Resumos de manutenção só incluem contadores/booleanos. Logs dos módulos atuais
  continuam ativos. Não habilitar captura de corpos ou cabeçalhos Authorization.
- Configurar retenção do journald segundo a política do administrador. Caddy não grava URLs
  de acesso para evitar links sensíveis em queries. Monitorar status sem gravar
  mensagens, cookies, telefone completo ou tokens.

## 11. Testes e checklist de corte

Executáveis locais sem serviços pagos:

```bash
npm ci --include=dev
npm run audit:privileged
npm test
npm run lint
node scripts/check-lot-semantics.mjs
node scripts/check-daily-task-semantics.mjs
node scripts/check-management-semantics.mjs
node --env-file=/etc/tpecia/build.env scripts/build-node.mjs
npm run test:hosting
# Browser com PostgreSQL isolado, frontend local ou artefato Node:
FARM_PANEL_TEST_ORIGIN=http://127.0.0.1:3000 npm run test:panel-access
```

Para executar smoke/configuração em homologação, nunca fornecer chaves de
produção aos testes. `test:hosting` usa fixtures, porta 3197 e diretório temporário;
verifica SSR, refresh do painel, API, assinatura, rota privada, worker separado,
ACK persistente e reinício real. Os testes da aplicação exercitam SQL/PGlite,
permissões, sessões, mídia e adapters simulados; não equivalem a chamadas reais.
O relatório executado nesta entrega é [VALIDACAO-HOSPEDAGEM.md](VALIDACAO-HOSPEDAGEM.md).

Antes do corte autorizado, validar no servidor do terceiro:

- [ ] Recursos Linux/Node, disco persistente, NTP, saída HTTPS e firewall aprovados.
- [ ] Secrets e valores públicos atuais copiados por canal seguro; flags mantidas.
- [ ] Dois processos ativos e fila compartilhada; teste de restart e backup/restore.
- [ ] HTTPS/renovação e domínio canônico, SSR e refresh das rotas internas.
- [ ] Login admin, sessão do produtor, links pessoais/convites e bloqueio entre fazendas.
- [ ] Consultar/alterar dado de teste e confirmar auditoria/recibo sem duplicatas.
- [ ] WhatsApp texto, áudio, imagem, vídeo e PDF reais; retries e queda durante IA.
- [ ] OpenAI e, se ativos, Gemini/DeepSeek/Perplexity com modelos autorizados.
- [ ] RAG/contexto, clima, mercado, Supabase comercial e ABCZ quando habilitada.
- [ ] Lembrete autorizado na hora correta, sem duplicar WhatsApp/push.
- [ ] FCM em aparelho, alarmes Android, App Links, cookies após fechar/reabrir, PWA.
- [ ] Verificar URL Meta/Supabase, certificado Android e ausência de endpoint interno público.
- [ ] Plano de DNS aprovado sem alterar e-mail; ambiente antigo preservado para rollback.
- [ ] Parar schedulers antigos na janela de corte para evitar trabalho em duas origens.
- [ ] Monitoramento e responsável pelo rollback disponíveis após mudança.

Sem essas verificações externas, o resultado é **preparado para implantação e
homologação**, não uma migração de produção concluída.
