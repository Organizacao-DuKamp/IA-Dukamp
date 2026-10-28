# Guardiã: pedidos combinados e horário local

## Problema observado em 28/10/2026

Um áudio pediu selecionar Eduardo, registrar quatro bovinos comprados naquele dia e lembrar de dar ração às uma e meia da tarde. O horário de origem era 10h41 em Brasília. A resposta pediu novamente dados já informados, depois tratou 13h30 como passado e confirmou operações sem recibo. A revisão inicial encontrou o livro Eduardo na versão 21, sem essa compra e sem essa tarefa. A compra de quatro do dia anterior e a compra de oito de hoje são eventos diferentes e devem ser preservados.

## Comportamento implementado

- Pedidos explícitos de compra/nascimento/morte/venda ou financeiro junto com lembretes são interpretados antes da resposta geral do modelo.
- Seleção explícita só utiliza propriedades autorizadas. Os dados são aplicados pela camada de domínio e pelo mesmo RPC versionado do painel/WhatsApp, em uma única gravação do livro, com auditoria e recibo. Se um item falhar, nenhum registro do conjunto é salvo. A seleção de propriedade é uma operação independente já existente.
- “Às uma e meia da tarde” e “às 1:30 da tarde” correspondem a 13h30 de Brasília (16h30 UTC nessa data). Um horário sem dia significa hoje neste fluxo; o recibo mostra a data completa. Um horário passado pede esclarecimento, sem mudar automaticamente para amanhã.
- Na falta de data/horário ou descrição da tarefa, um rascunho persistente conserva os demais pedidos e a origem por 30 minutos. A continuação preenche apenas o campo necessário. Mudança de fazenda, expiração ou pergunta interveniente impedem uma confirmação indevida.
- Dois lembretes e registro financeiro no mesmo pedido são suportados. Uma instrução explícita de registro após o lembrete é separada de sua descrição.
- Reenvio do mesmo identificador recebe o recibo persistido. Repetição recente de entrada com mesma quantidade/data não soma novamente sem esclarecimento. Não se criam fichas ou RGN para animais sem identificação.
- O contexto da fazenda fornece o relógio local e distingue UTC de horário de Brasília para respostas conversacionais.
- Consentimento, janela de envio e templates continuam sendo exigidos pelos mecanismos de entrega. Criar a tarefa não habilita mensagens gerais. Sem avisos ativos, o recibo informa que a tarefa está no painel e que o WhatsApp depende dessa ativação.

## Validação

`tests/guardian-multi-intent.test.ts` cobre a transcrição original, relógios por extenso, tarde, horário passado, gravação conjunta, retomada do rascunho sem histórico em memória, origem, reenvios, propriedade isolada, permissões, falha de banco e o adaptador real de processamento do WhatsApp com dependências de teste (sem envio à Meta ou a clientes). Inclui financeiro + duas tarefas e ordem invertida entre tarefa e compra. A suíte de painel continua cobrindo a leitura dos mesmos registros após recarregar.

## Publicação e revisão histórica

Não há nova migração SQL, segredo ou variável de ambiente. Publicar pelo fluxo Git/Netlify do projeto `tpec-ia`, incluindo funções do backend e frontend. Confirmar SHA efetivamente publicado e resposta de `/painelfazenda`.

O lembrete histórico de 13h30 de 28/10 já estava passado no momento da correção. Não criar tarefa vencida, não enviar aviso atrasado nem mudar para outro dia sem pedido do produtor. A recuperação de uma compra histórica exige verificar novamente livro, recibos e auditoria, preservar a mensagem original, usar uma gravação versionada e comprovar que não houve duplicação. Este documento não constitui recibo de recuperação.

## Limites

Instruções negadas, hipotéticas, atribuídas a terceiros, propriedades ambíguas, datas conflitantes ou outras alterações não interpretadas com segurança não recebem confirmação de execução. Alterações destrutivas/correções de registros devem ser conferidas separadamente. A validação automatizada do adaptador não equivale a uma entrega real de WhatsApp; não foi autorizado enviar mensagens a clientes para demonstração.
