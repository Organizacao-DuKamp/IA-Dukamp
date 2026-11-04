# Aplicativo Android e agenda da fazenda

O projeto Android está em `android/`. O [guia de compilação e Firebase](../android/README.md) descreve a configuração operacional. O painel continua compartilhando a mesma agenda que a IA registra pelo WhatsApp.

## Fluxo

O usuário entra com um código de acesso ao painel instalado e ativa os lembretes no celular. O Android troca sua sessão instalada por uma credencial aleatória de dispositivo; o servidor guarda apenas o hash da credencial. Fazenda e telefone são derivados da sessão autorizada, não de identificadores enviados pelo cliente.

`/api/public/farm-panel/app` registra o dispositivo e fornece um snapshot de tarefas abertas atribuídas ao usuário. Cada horário possui chave ligada à fazenda, tarefa e revisão. O dispositivo concilia os snapshots por versão e data do servidor, cancela horários antigos e preserva apenas adiamentos ainda válidos. Recibos locais evitam repetir o mesmo disparo. A sessão salva limita os alarmes offline.

Uma atualização das tarefas insere um trabalho de sincronização. A manutenção de minuto também encontra tarefas vencendo, com janela de tolerância de 5 minutos, e insere um sinal FCM de alta prioridade. Os pushes contêm apenas `app=tpec-farm` e `kind=sync|reminder`. A obtenção de títulos e horários depende de nova autorização na API.

A fila usa deduplicação, leases, revalidação imediatamente antes do envio, recibos e tentativas com backoff. Ela é separada da fila e das preferências de envio do WhatsApp. Não modifica o limite diário ou o horário de silêncio de mensagens proativas.

O Android combina FCM, WorkManager periódico (mínimo de 15 minutos, sujeito ao sistema) e atualização ao abrir o app. Os horários sincronizados são agendados via AlarmManager. O modo alarme usa serviço de reprodução em primeiro plano, som de alarme, vibração e ações para parar/adiar. Uma tela privada pode aparecer sobre o bloqueio quando o Android permitir. Reinício, mudança de hora/fuso e concessão da permissão de alarme provocam uma reconciliação local.

## Dados e implantação

Aplicar a migração `supabase/migrations/20261103165643_guardian_android_reminders.sql` antes de publicar o backend que registra dispositivos. Ela cria `guardian_app_devices`, `guardian_app_push_jobs`, as funções `guardian_app_*` e um trigger de mudanças da agenda. É aditiva, com RLS habilitada e acesso restrito a `service_role`; não há políticas para clientes anônimos ou autenticados do Supabase.

As variáveis `TPEC_FCM_PROJECT_ID`, `TPEC_FCM_CLIENT_EMAIL` e `TPEC_FCM_PRIVATE_KEY` pertencem somente ao servidor. O envio fica inativo enquanto estiverem ausentes. A credencial privada Firebase nunca é incluída no bundle web ou APK. `google-services.json` é uma configuração pública de cliente distinta, incluída em `android/app/` para o projeto `tpec-ia-688a5`. Arquivos de chave privada da conta de serviço não devem ser versionados.

Publicar a `main` na Netlify pelo fluxo Git já existente. As duas funções de manutenção são empacotadas junto do backend atual. O segredo existente `WHATSAPP_APP_SECRET` autentica o acionamento da função de background. O agendador não envia mensagens de WhatsApp.

## Proteções

- API de cadastro exige origem exata, cabeçalhos do painel instalado e cookie HttpOnly; não aceita uma fazenda arbitrária no corpo.
- Sincronização e rotação de token revalidam sessão, vínculo e fazenda. A fila verifica esses mesmos vínculos antes do envio. Logout remove a agenda local e revoga o acesso.
- O WebView aceita a ponte de mensagens apenas no frame principal, na origem HTTPS configurada e na página do painel. Não usa `addJavascriptInterface`, não permite arquivos locais nem conteúdo misto. TLS não é contornado.
- Dados e tokens nativos são cifrados com chave do Android Keystore, sem backup ou transferência para outro aparelho.
- Conteúdo privado não segue no push e as notificações usam visibilidade privada no bloqueio. Erros do provedor e segredos não são enviados à interface.
- Snapshots atrasados não ressuscitam tarefas canceladas. Leases antigos não autorizam envio após reagendamento ou revogação. Não há garantia de revogação offline imediata.

## Validação

`tests/guardian-app.test.ts` testa o snapshot pessoal, o limite de 128 horários, cadastro/autorização/rotação, SQL real em PGlite, leases, cancelamento, alteração de revisão, revogação, OAuth e conteúdo do FCM com transporte simulado. Os testes não enviam notificações reais nem mensagens de WhatsApp.

`android/app/src/test/.../ReminderPolicyTest.kt` testa deduplicação, janela de disparo, expiração de sessão, conciliação de snapshots, cancelamento, adiamento e troca de fazenda. O workflow `.github/workflows/android-app.yml` compila o APK, executa os testes e o lint Android, e publica os relatórios como artefatos de validação.

Antes de distribuir, executar o roteiro de aparelho real em `android/README.md` com o projeto Firebase definitivo: aplicativo fechado, tela bloqueada, economia de bateria, reinício, notificações negadas, horários exatos negados, FCM com troca/cancelamento, dois alarmes simultâneos e logout. Compilação e testes unitários não substituem a verificação de som e entrega em aparelho físico.
