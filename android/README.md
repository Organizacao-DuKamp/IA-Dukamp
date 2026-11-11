# TPEC-IA · Minha Fazenda para Android

Abra **esta pasta `android/`** no Android Studio. O painel usa `https://www.tpecia.com.br/painelfazenda`; agenda, notificações, armazenamento e alarme são nativos. O acesso usa links pessoais enviados pela TPEC-IA no WhatsApp. Veja [acesso por links e associação Android](../docs/farm-access-links.md).

O aplicativo fica restrito a `/painelfazenda`, incluindo a tela de acesso. O logotipo permanece no painel e o link “Voltar ao site” fica oculto no Android. Links para outras páginas abrem no navegador; links do WhatsApp abrem no aplicativo correspondente. A landing page continua disponível no site.

## Compilar

- JDK 17 e Android SDK 36 / Build Tools 36.0.0. Android mínimo: 8.0 (API 26).
- Aguarde o Gradle Sync. O wrapper Gradle 8.13 está incluído.
- Para testar no celular: selecione o aparelho no Android Studio e execute **Run**.
- Para gerar APK de teste, na raiz desta pasta:

```sh
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

No Windows, use `gradlew.bat`. O APK fica em `app/build/outputs/apk/debug/app-debug.apk`. Para distribuição, gere uma versão assinada no Android Studio; mantenha sua chave de assinatura privada.

## Configurar Firebase

O Firebase Cloud Messaging (FCM) avisa o Android para buscar os agendamentos novos ou alterados, inclusive com o painel fechado. O conteúdo da fazenda é obtido na API autenticada, não no push. O Supabase existente continua armazenando os dados; não é necessário criar Firestore, Realtime Database ou Firebase Authentication.

### 1. Cadastrar o Android

1. Abra o [Firebase Console](https://console.firebase.google.com/) e crie ou selecione um projeto.
2. Em **Configurações do projeto → Geral → Seus aplicativos**, adicione um aplicativo **Android**.
3. Informe o nome do pacote exatamente: **`br.com.tpecia.fazenda`**. Use um nome amigável, como “TPEC-IA Minha Fazenda”. SHA-1 não é necessário para esta integração de FCM.
4. Baixe **`google-services.json`** e coloque-o em **`android/app/google-services.json`**, a partir da raiz do repositório.
5. Faça **Sync Project with Gradle Files** no Android Studio e compile novamente. O plugin Google Services e a dependência Firebase Messaging já estão configurados; não adicione outra cópia.

O arquivo de configuração deve pertencer ao mesmo projeto usado pelo servidor. A configuração de cliente do projeto `tpec-ia-688a5` está incluída no repositório. Ela contém identificadores públicos do aplicativo; a chave privada da conta de serviço permanece exclusiva do servidor. Sem o arquivo de cliente, o projeto ainda compila e os horários sincronizados manualmente continuam funcionando, mas o aparelho não recebe FCM.

### 2. Habilitar o servidor

1. Em **Configurações do projeto → Cloud Messaging**, confira se **Firebase Cloud Messaging API (V1)** está habilitada. Se necessário, abra o link para gerenciar a API no Google Cloud e habilite-a.
2. Em **Configurações do projeto → Contas de serviço**, selecione **Gerar nova chave privada** e baixe o JSON da conta de serviço.
3. No painel da Netlify, abra o projeto **tpec-ia** (domínio **www.tpecia.com.br**) → **Project configuration → Environment variables**. Cadastre estas variáveis privadas para **Functions**, no contexto **Production** (e **Deploy Previews**, se for testar previews):

| Campo do JSON da conta de serviço | Variável na Netlify     |
| --------------------------------- | ----------------------- |
| `project_id`                      | `TPEC_FCM_PROJECT_ID`   |
| `client_email`                    | `TPEC_FCM_CLIENT_EMAIL` |
| `private_key`                     | `TPEC_FCM_PRIVATE_KEY`  |

Copie o valor completo de `private_key`, incluindo `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`. São aceitas quebras de linha reais ou `\n` literais. Não acrescente aspas externas.

**O JSON da conta de serviço é secreto. Não coloque esse arquivo no aplicativo, no repositório ou no chat.** Ele é diferente de `google-services.json`. Não use prefixo `VITE_` nas variáveis acima. Se usar uma conta de serviço própria, conceda a ela permissão para enviar mensagens FCM nesse projeto.

4. As funções de manutenção usam o `WHATSAPP_APP_SECRET` já existente no servidor para autenticação interna; mantenha essa variável. O app não recebe esse segredo.
5. Depois de salvar as variáveis, faça um novo deploy da `main` na Netlify. As funções `guardian-app-reminders` e `guardian-app-reminders-background` já estão no código. A primeira é executada a cada minuto em produção.
6. A migração `guardian_android_reminders` precisa estar aplicada ao Supabase antes de ativar os dispositivos. Consulte `docs/android-farm-app.md` para os detalhes da implantação.

### 3. Ativar e conferir no celular

1. Instale a compilação que contém o `google-services.json`.
2. Entre no painel com um código novo do WhatsApp.
3. Abra **Tarefas → Não perca a hora**. Escolha **Notificação** ou **Notificação e alarme** e toque em **Ativar lembretes neste celular**.
4. Permita as notificações e os horários exatos. Para a tela de alarme sobre o bloqueio, permita também **Alarme na tela bloqueada**, quando o Android oferecer essa opção.
5. Toque em **Testar em 5 segundos** e confira o volume de **alarme** do aparelho.
6. Pelo WhatsApp, crie uma tarefa para alguns minutos à frente. Aguarde a sincronização; confira a contagem de lembretes no app. Feche o aplicativo normalmente e bloqueie a tela. Verifique o som, os botões **Parar** e **Adiar 10 min** e o acesso à tarefa.
7. Repita com o app já fechado ao criar a tarefa, depois reagende e cancele uma tarefa pelo WhatsApp. O aparelho precisa de conexão para receber essas mudanças.

## Comportamento e limites

- A correção de entrega dos alarmes está na versão **1.0.1 (2)**. Atualizar o site não substitui o código nativo de um APK já instalado: compile e instale essa versão usando a mesma assinatura da instalação anterior.
- Até 128 próximos lembretes pessoais dos próximos 30 dias são mantidos no aparelho; a sincronização renova a lista. Não são alarmes para tarefas de outros responsáveis.
- Um horário já sincronizado usa `AlarmManager` e funciona sem internet, em segundo plano ou após fechar normalmente o app. Após reiniciar, os horários são restaurados quando o armazenamento do aparelho fica disponível após o desbloqueio.
- Mudanças feitas pelo WhatsApp exigem conexão para chegar ao aparelho. FCM e o WorkManager auxiliam a atualização; não garantem entrega instantânea. Sem Firebase configurado, abra o app após alterar a agenda.
- **Forçar parada** nas configurações do Android impede alarmes e mensagens até o usuário abrir o aplicativo novamente. As restrições de bateria do fabricante também precisam ser verificadas em aparelho real.
- Sem acesso a horários exatos, o Android pode atrasar o aviso. A interface mostra a permissão pendente.
- A ativação solicita notificações e, depois, acesso aos horários exatos. A tela também mostra volume de alarme zerado e restrições de bateria, com atalhos para ajustar. O teste de 5 segundos exige horários exatos.
- Horários já salvos e ainda ativos podem ser recuperados por até 1 hora de atraso do Android; novos horários recebidos do servidor continuam limitados à tolerância de 5 minutos. Conclusão, cancelamento, troca de fazenda e expiração de acesso continuam invalidando o alarme. Um alarme já entregue não toca novamente.
- O modo alarme reproduz som por até 5 minutos. **Adiar** marca mais 10 minutos. **Parar** silencia e não conclui a tarefa; a conclusão permanece no painel/WhatsApp.
- Logout limpa os alarmes locais e invalida a autorização no servidor. Sem conexão, uma revogação remota só chega ao aparelho na próxima sincronização ou no vencimento da sessão salva.
- Tela cheia depende da permissão e das regras do Android/distribuição. Se indisponível, o aviso continua pela notificação permitida. Na Google Play, verifique a declaração e a elegibilidade da permissão de tela cheia antes de publicar.
- Se o toque padrão do Android não puder ser aberto, o app usa um som incluído no APK. Isso não altera o volume escolhido pelo usuário nem a configuração de Não Perturbe.

## Referências oficiais

- [Adicionar Firebase ao Android](https://firebase.google.com/docs/android/setup)
- [Configurar o cliente FCM](https://firebase.google.com/docs/cloud-messaging/android/client)
- [Enviar pelo FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- [Agendar alarmes no Android](https://developer.android.com/develop/background-work/services/alarms/schedule)
