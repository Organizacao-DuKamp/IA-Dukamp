# Guardiã: concluir tarefas sem exigir código

## Comportamento

O produtor pode dizer “já dei ração”, “já concluí essa tarefa” ou responder “já fiz” ao aviso do WhatsApp. A conclusão é validada e persistida antes do recibo, sem pedir uma segunda confirmação para um relato inequívoco. Códigos antigos continuam aceitos, mas não são exigidos nem aparecem nas novas instruções de conclusão.

O contexto nativo de resposta do WhatsApp (`context.id`) é preservado no webhook de texto/mídia, na fila e no adaptador. Quando disponível, identifica o aviso realmente respondido. Sem resposta nativa, o sistema usa a atividade informada e os avisos efetivamente enviados antes da mensagem do produtor. Não usa uma promessa anterior do modelo como prova de execução.

A conversa pode estar em uma fazenda enquanto o aviso é de outra. A consulta de notificações é restrita ao destinatário e às propriedades com acesso ativo. O livro da propriedade correta é carregado com a função atual do membro, e o RPC versionado revalida a permissão na gravação. A fazenda selecionada não é alterada para concluir um aviso de outra propriedade.

Se houver duas tarefas compatíveis, a Guardiã apresenta atividade, fazenda e horário. A pessoa pode escolher “a de dar ração”, “a do lote 2” ou “a primeira”. A escolha fica no estado persistente por 30 minutos. Não é preciso copiar um identificador. Escolhas expiradas, mudanças de fazenda, perguntas de outro assunto, acessos revogados e avisos de tarefas reagendadas não dão baixa indevida.

“Sim” ou “pronto” isolados só concluem quando o contexto indica uma pergunta de conclusão. Negativas, hipóteses e intenções futuras não concluem tarefas. Uma confirmação repetida não conclui outra tarefa que permaneceu aberta. Mensagens antigas não podem concluir uma tarefa criada ou reagendada depois da fala original.

“Concluí todas as tarefas” opera apenas sobre a fazenda indicada/selecionada. Concluir uma tarefa e pedir outro lembrete na mesma mensagem continua usando uma gravação do livro com recibo. Outros registros reconhecidos do mesmo pedido também passam pela validação de domínio e de acesso.

## Avisos

Novos avisos convidam a responder em linguagem natural. Avisos antigos ainda na fila têm apenas essa instrução atualizada, com a mesma tarefa, destinatário, vencimento e evidência. A atualização exige o lease do evento e antecede a autorização normal de entrega. O texto atualizado é persistido para manter a rastreabilidade do que foi enviado. Mensagens já enviadas e o histórico original não são reescritos.

A conclusão usa o fluxo existente para cancelar avisos pendentes ou já reivindicados cuja evidência ficou obsoleta. O aviso respondido recebe `answered_at`. Consentimento, horário, limites e templates aprovados permanecem em vigor. Nenhum envio geral é habilitado.

## Dados e validação

Aplicar `20261029113610_guardian_cross_property_receipts.sql` antes da publicação. A migração substitui apenas o RPC existente para vincular auditoria e recibo à propriedade alterada nas operações `update`, mantendo a fazenda selecionada. Preserva assinatura, permissões, RLS, travas e verificação de versão; não reescreve dados anteriores. Sem segredo ou variável de ambiente novos. Os campos novos são opcionais no estado JSON e no envelope interno do WhatsApp. Os IDs continuam internos; não há mudança em RLS, sessões do painel ou isolamento das fazendas.

`tests/guardian-natural-task-completion.test.ts` cobre linguagem natural, contexto entre fazendas, ambiguidades, resposta nativa, negativas, repetição, confirmação de todas as tarefas, tarefa concluída + novo lembrete, revogação, reagendamento, escolha expirada e mensagens atrasadas. `tests/whatsapp-webhook.test.ts` verifica a passagem do contexto de resposta em webhook assinado. As dependências de envio e de IA são substituídas nos testes; não enviar mensagens a clientes para homologar.

Para revisar uma conclusão antiga que não foi salva, verificar o horário assinado da fala, os avisos que já tinham sido enviados naquele momento, a tarefa ainda aberta e a permissão atual. Recuperar somente a correspondência inequívoca, uma vez, com origem e auditoria, sem inferir a conclusão de outras tarefas semelhantes. Este documento não constitui recibo de recuperação.
