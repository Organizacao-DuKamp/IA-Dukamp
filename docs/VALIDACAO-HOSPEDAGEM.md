# Validação da migração de hospedagem

Executado em 16/11/2026, Linux x64, Node.js 24.22.1, branch
`migration/self-hosted-node`, base `13bc4c05b77f0706cae60088a62ea106c2589a1c`.
Não foram usadas credenciais de produção e nenhuma configuração externa foi alterada.

Os testes de Docker abaixo são registros históricos da implementação inicial; a entrega final usa Node.js direto e systemd, sem arquivos de Docker.

## Aprovados

| Verificação executada                                              | Resultado                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --include=dev`                                             | Concluído com scripts habilitados (incluindo FFmpeg). Cache configurado em diretório gravável do ambiente                                                                                                         |
| `npm test` após adaptações e novos testes                          | **1.182 testes, 1.182 aprovados, zero falhas, zero skips**                                                                                                                                                        |
| `npm run test:self-hosted`                                         | 9 testes novos aprovados: disco SQLite real, dois clientes, persistência após saída abrupta, fencing, backoff, dead-letter, replay, retenção, cron, HMAC, Unicode, configuração e recuperação de claim            |
| `npm run typecheck` / `npm run build:node`                         | TypeScript e build completo do preset `node_server` aprovados com valores públicos de fixture                                                                                                                     |
| `npm run lint`                                                     | Aprovado                                                                                                                                                                                                          |
| `npm run audit:privileged`                                         | Executado; relatório de imports disponível no log de execução, build mantém proteção client/server                                                                                                                |
| Verificações pós-build                                             | Cinco módulos administrativos importados; scan de segredos do cliente; FFmpeg ELF Linux x64 íntegro/executável e `ffmpeg -version`                                                                                |
| `npm run test:hosting`                                             | Servidor compilado e worker separado reais; SSR de `/`, painel e rota de privacidade, refresh, Asset Links JSON, API, HMAC, rota privada, fila persistida antes do ACK, consumo após reiniciar web e deduplicação |
| `npm run test:panel-access` com Chromium e frontend Node compilado | PostgreSQL isolado; entrada inicial e com página/app abertos, logout/reentrada, refresh atrasado, link consumido recusado, convite, persistência após reload, compatibilidade da navegação de APK e cookie        |
| Build de `Dockerfile`                                              | Imagem multi-stage Node 24.22.1 construída; build, scans e FFmpeg executados dentro do builder                                                                                                                    |
| Execução da imagem Docker                                          | Web/worker separados, usuário `node`, raiz read-only, tmpfs, volume SQLite; SSR, APIs, FFmpeg e retomada de webhook após restart do container aprovados                                                           |
| `docker compose ... config --quiet`                                | Configuração renderizada com fixtures e arquivo privado externo, sem imprimir seus valores                                                                                                                        |
| Caddy 2.10.2 `validate`                                            | Configuração de produção válida                                                                                                                                                                                   |
| Proxy HTTPS em teste isolado                                       | Certificado local verificado por CA de teste (sem `-k`), www `/healthz` 200, apex `/painelfazenda` 308 para www e `/api/internal/jobs` 404; nenhuma emissão ACME pública solicitada                               |
| `bash -n deploy/release.sh`                                        | Sintaxe aprovada; script não foi executado contra servidor real                                                                                                                                                   |

Os testes de aplicação cobrem adapters de IA, importação PDF/planilhas, áudio,
vídeo, permissões/RLS via PostgreSQL isolado, memória, idempotência, lembretes,
push FCM simulado e sessões/convites. Isso NÃO comprova entrega real dos serviços.

O Docker neste ambiente usa VFS e um disco de cerca de 8 GB: a primeira execução
de container atingiu ENOSPC após o build. O cache criado por este build foi
removido e o teste de containers foi repetido com sucesso. O primeiro lançamento
do smoke antigo de painel também atingiu ENOSPC; a repetição chegou à asserção
legada descrita abaixo. O ambiente definitivo deve oferecer o disco recomendado
no guia. As fixtures e volumes temporários não contêm dados reais.

## Não aprovados / pendências explicitamente observadas

- `scripts/check-farm-panel.mjs`: depois de autenticar e renderizar a fazenda,
  falha na linha 81 ao esperar o artigo **“Rebanho calculado”**. O script da própria
  base main já usa esse seletor, enquanto a interface base atual exibe
  **“Bovinos nos registros”** em `FarmMobileHome.tsx`. Nenhum componente visual foi
  alterado na migração. É um smoke legado desatualizado; não o contabilizar como
  aprovado. O script de acesso/sessões atual e os testes SQL passaram.
- `check-lot-semantics.mjs`, `check-daily-task-semantics.mjs` e
  `check-management-semantics.mjs`: os três foram iniciados e interrompidos pelo
  erro de configuração **missing_api_key**. Exigem chamadas reais ao modelo e
  foram deixados sem credencial; não inventar resultado de qualidade sem executá-los.
- Build/teste Android nativo: wrapper não conseguiu conectar inicialmente. Foi
  baixado Gradle 8.13 pelo caminho HTTPS disponível e executada a tarefa novamente;
  o build falhou na resolução do plugin `com.android.application` **8.13.2** nos
  repositórios configurados, antes dos testes. Nenhum arquivo Android foi alterado.
  Emulador, APK assinado, Keystore/CookieManager reais, FCM e alarmes em aparelho
  continuam pendentes. A ponte Android simulada no browser não os substitui.
- `systemd-analyze verify`: não concluiu porque o sandbox nega criação de
  `/run/systemd` (filesystem somente leitura). Este host tampouco tem Node em
  `/usr/local/bin/node`, caminho de exemplo das units. Ajustar o caminho no
  servidor e executar verify/enable/restart ali; o daemon systemd real não foi testado.
- Registro.br, IP/firewall do terceiro, certificados públicos/renovação, callback
  Meta, URLs autorizadas Supabase e IAM Firebase não foram alterados nem
  homologados. Não há credenciais ou servidor definitivo nesta sessão.
- Chamadas reais aos quatro provedores, WhatsApp com mídia real, entrega FCM e
  acesso ABCZ precisam de homologação com as contas autorizadas. Os adapters
  existentes não foram substituídos; a validação automatizada usa simulação.
- CI Windows/Android e o workflow de artefato opcional foram preparados; não
  afirmar aprovação remota antes de observar os resultados do GitHub Actions.

## Recomendação para o corte

Revisar o PR e implantar primeiro em Linux com disco persistente, dois processos
supervisionados e valores atuais por canal seguro. Executar o checklist completo
em [MIGRACAO-HOSPEDAGEM.md](MIGRACAO-HOSPEDAGEM.md), com mensagens e propriedade
de homologação, inclusive queda durante processamento, sessão no APK existente e
lembrete com push. Só depois aprovar uma janela de DNS. Preservar Netlify como
rollback durante a transição, coordenando schedulers para não manter duas origens
fazendo manutenção ao mesmo tempo. Este PR não faz merge nem migra produção.
