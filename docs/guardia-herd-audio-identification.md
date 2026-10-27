# Entradas por áudio e identificação dos animais

Branch: `fix/guardian-herd-audio-identification`. Base: `origin/main` em `e1453ef`, depois da publicação das correções de financeiro/rebanho.

## Correção do relato enviado

O áudio “Pepec, agora nasceram mais quatro bezerros aqui na minha fazenda, tá? Se você puder registrar isso pra mim...” não era reconhecido como uma movimentação literal. O extrator exigia algarismos imediatamente depois do verbo e uma frase sem esses trechos de conversa. A resposta seguinte, “É pra rebanho”, seguia para a IA geral e podia parecer uma confirmação sem alteração do livro operacional.

Agora os relatos de entrada aceitam “mais”, quantidades por extenso (cardinais usuais até 999), números, nomes de animais no singular, o vocativo e os pedidos de registro usados nesse áudio. As remoções são limitadas a esses elementos: perguntas reais, relatos incertos, terceiros e mídia visual não viram movimentações automáticas.

A entrada salva um evento `birth`/`purchase` no mesmo livro que alimenta o painel. A confirmação informa a quantidade e o saldo calculado e só é entregue após o commit. Recibos por mensagem e controle de versão evitam repetições. Relatos incompletos e a resposta isolada “É pra rebanho” recebem orientação explícita, sem uma confirmação gerada pela IA. Propostas antigas de anotação de nascimento com quantidade também são convertidas em movimentos de rebanho na confirmação, quando o livro operacional já existe.

No cenário informado, **78 animais + 4 novos nascimentos = 82**. Os dois nascimentos e quatro óbitos anteriores são preservados; não se substitui o censo nem se repetem os eventos anteriores.

## Pergunta e resposta sobre código/RGN

- Após salvar nascimentos ou compras, a TPEC-IA pergunta se os animais têm código/brinco e RGN. A pergunta identifica a entrada e a quantidade ainda sem fichas.
- A entrada já é contabilizada, mesmo sem identificação. O produtor não precisa inventar um código nem possuir RGN para registrar nascimentos/compras.
- Uma resposta como `código B01, RGN KBU 491` cria a ficha correspondente. Para vários animais, enviar um por linha. Código sem RGN também é aceito; RGN isolado exige o código do animal.
- A identificação persiste no banco por 30 minutos e sobrevive ao reinício do processo. Pode ser preenchida parcialmente, sem repetir o nascimento ou a compra. Código, RGN e fonte são preservados. Nascimento fica na data do evento; compra não implica uma data de nascimento.
- “Sim” pede a lista; não executa outra entrada. “Não têm” encerra a identificação e mantém o rebanho. “Não têm RGN” mantém a possibilidade de informar somente os códigos.
- Listas com duplicidades de código/RGN, quantidade excessiva ou linhas inválidas não são gravadas parcialmente. Fichas existentes não são sobrescritas por esse fluxo de identificação de animais novos.
- A identificação é vinculada à fazenda e à entrada autorizada. Expiração, troca de propriedade ou revogação de acesso impedem vínculos indevidos. Funcionários continuam podendo cadastrar fichas segundo as permissões existentes, sem ganhar permissão para mudar o estoque.
- Quando há várias entradas possíveis, a TPEC-IA pede qual delas corresponde aos códigos. Uma nova entrada passa a ser o contexto da nova pergunta; os eventos anteriores permanecem salvos e suas fichas também podem ser cadastradas explicitamente depois.
- Uma proposta conferida de outra operação, como uma despesa, pode ser preservada atrás dessa pergunta. Responder “sim” à identificação não confirma essa despesa; ao encerrar a identificação, a proposta anterior só volta se continuar válida e na mesma propriedade.
- Em conversas gerais sobre o rebanho, a pergunta sobre código/RGN é acrescentada à resposta efetivamente entregue e ao histórico, sem depender de a IA lembrar de perguntar. Quando já há uma entrada aguardando identificação, a pergunta mantém esse contexto explícito.

As identificações continuam sendo declarações do produtor, sem suposta validação de registro oficial.

## Publicação e recuperação do evento antigo

1. Integrar a branch e publicar frontend e backend pelo fluxo normal do Netlify `tpec-ia`. **Não há nova migração SQL nem novo segredo.** A pergunta pendente usa o JSON `guardian_accounts.pending` existente, com discriminador `herd_identification`; o livro, os eventos e as fichas continuam nos formatos existentes.
2. Verificar a entrada pelo WhatsApp e a atualização de `/painelfazenda`, usando propriedade/número de teste autorizados e sem mensagens a clientes.
3. Para o caso antigo do produtor, localizar a mensagem original do áudio nas fontes autorizadas e conferir os recibos, o histórico e todos os eventos da propriedade correta. Se os quatro nascimentos realmente estiverem ausentes, recuperá-los **uma única vez**, mantendo data, mensagem de origem e auditoria, sem repetir os dois nascimentos/quatro óbitos anteriores. Não forçar um saldo de 82 se houver outras movimentações posteriores: acrescentar o evento ausente ao histórico correto e recalcular.
4. Se o evento já tiver sido corrigido por outro caminho, não reaplicar. O código novo não reprocessa silenciosamente mensagens antigas já encerradas.
5. Um rollback precisa aceitar o novo tipo de pendência ou encerrar apenas as pendências de identificação de forma auditada, preservando propostas anteriores válidas. Não apagar nem desfazer nascimentos, compras ou fichas para reverter o código.

## Validação

Os testes usam PostgreSQL isolado, sem credenciais ou mensagens reais de produção. Incluem o áudio exato e saldo 78→82, transmissão da confirmação no caminho do WhatsApp sem IA geral, números por extenso, reinício do banco, respostas parciais/listas, idempotência, códigos/RGN duplicados, ausência de RGN, permissões, troca de fazenda, expiração, revogação e preservação de propostas anteriores.

O teste Chromium reutiliza a rota e o handler reais com banco isolado: recebe mais quatro animais por transcrição, informa seus códigos/RGN depois e confirma no painel o saldo e as fichas após recarga, sem dupla contagem.

Resultado final: **837 testes aprovados**, sem falhas, cancelamentos ou pulos; build com TypeScript e verificações do cliente aprovado; auditoria de imports privilegiados aprovada; Chromium aprovado; lint com zero erros e 11 avisos preexistentes.
