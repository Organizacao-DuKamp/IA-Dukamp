# Lembretes diários da fazenda

O produtor pode pedir “todos os dias às oito da manhã me lembre de dar ração aos gados”, por áudio ou texto. A interpretação mantém `task_create` e acrescenta `recurrence: "daily"`. `dueAt` é a primeira ocorrência futura, no horário de Brasília: hoje se ainda não passou; amanhã caso contrário. Uma data inicial explícita é respeitada. Tarefas sem repetição continuam com o comportamento anterior.

Uma única tarefa guarda o agendamento. Não há uma lista permanente de tarefas futuras nem um limite comercial de dias. O campo opcional `completedThrough` guarda a última ocorrência concluída. Concluir hoje mantém a tarefa aberta para amanhã; cancelar a tarefa encerra a repetição. Alterar o horário preserva a repetição. Os commits, permissões, recibos, origem e auditoria continuam no fluxo existente. Outras frequências não são convertidas silenciosamente em diária.

## Entrega

A migração `20261104114141_guardian_daily_task_reminders.sql` acrescenta funções `SECURITY INVOKER`, executáveis somente por `service_role`. Não cria tabelas nem modifica tarefas ou mensagens históricas. O claim de eventos materializa hoje e amanhã a partir dos agendamentos ativos; cada ocorrência tem chave determinística. A confirmação final de envio revalida tarefa, ocorrência, conclusão, revisão, vínculo e consentimento. Uma edição não reenvia uma ocorrência já enviada ou incerta. Os limites de avisos espontâneos continuam separados dos lembretes pessoais solicitados. A exigência de template WhatsApp aprovado fora da janela de 24 horas permanece.

O snapshot Android expande até 30 dias, respeitando o limite total já existente de 128 horários no aparelho. Cada dia usa uma chave própria, estável diante de alterações apenas no título. A fila FCM cria um sinal por ocorrência e revalida edição, conclusão e revogação. Os alarmes sincronizados funcionam pelas rotinas nativas existentes; Firebase e permissões do aparelho continuam necessários nos mesmos casos anteriores. O painel mostra “Todos os dias”, a próxima ocorrência e “Cancelar repetição”.

## Validação

- `tests/guardian-daily-tasks.test.ts`: cálculo de horários, virada de dia/mês/ano, conclusão por ocorrência, continuidade automática sem conclusão, PostgreSQL real isolado, deduplicação, cancelamento com lease ativo, FCM diário, alteração de horário, acesso revogado e reconhecimento de áudio pelo adaptador determinístico.
- `scripts/check-daily-task-semantics.mjs`: avaliação do provedor real com fazenda/telefone sintéticos, sem credenciais de banco ou WhatsApp; cobre o pedido falado, antes/depois das 8h, início futuro, tarefa única, cancelamento e conclusão diária. Executado no Deploy Preview.
- Os testes não enviam mensagens de WhatsApp nem notificações reais. Nenhum pedido histórico é reaplicado para ativar um lembrete.

## Implantação

Aplicar a migração aditiva antes de publicar o backend da mesma revisão. Conferir CI e Deploy Preview, integrar na `main` e conferir o deploy de produção. Solicitar novamente um lembrete pelo WhatsApp depois da publicação; o áudio anteriormente recusado não é executado retroativamente. Para reverter, corrigir por novo commit preservando os leitores dos campos opcionais dos agendamentos já salvos.
