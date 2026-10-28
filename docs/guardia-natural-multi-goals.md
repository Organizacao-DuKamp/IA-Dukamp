# Guardiã: objetivos independentes na linguagem do produtor

## Falha observada

Na revisão das mensagens de 28/10/2026, o pedido com compra de quatro bovinos e “me avise também às 18:30 para alimentar eles” persistiu a compra e ignorou o lembrete. A variante por áudio “cria uma tarefa” não entrava no mesmo fluxo de “crie uma tarefa”. “Umas seis e meia da tarde” também perdia o relógio. Reconhecer uma intenção encerrava a análise antes das demais.

## Alteração

- A intenção de tarefa passa a reconhecer as formas naturais de lembrar, avisar, mandar mensagem, criar tarefas ou lembretes e agendar. A interpretação é independente da conjugação e do canal (texto/transcrição).
- Cada família de gestão é analisada: rebanho, financeiro, caderno de campo, alterações conhecidas e tarefas. Encontrar a compra não suprime o pagamento nem os lembretes. As ações válidas continuam usando validação de domínio, permissão, escopo da fazenda, versionamento e recibo.
- Uma única instrução pode introduzir uma lista de tarefas. A separação exige relógios próprios em ambos os lados; “seis e meia” não vira duas tarefas e “boi e vaca” não divide um título.
- Relógios numéricos e por extenso, com “umas”, “da tarde” ou “da noite”, conservam o fuso da fazenda. Quantidades de animais não viram horários. Um horário por extenso sem período ambíguo pergunta apenas manhã/tarde, preservando os dados.
- Quando uma transcrição é incerta (por exemplo, menciona “galgos”), a tarefa completa pode ser salva enquanto a entrada fica pendente, com indicação explícita do que faltou. Não se presume que cães ou cavalos sejam bovinos. A confirmação só da espécie pode completar o dado, sem repetir a tarefa já salva.
- A pergunta “e a tarefa que eu te dei?” pode recuperar o pedido original recente quando o texto do produtor está vinculado a uma movimentação realmente persistida e seu recibo. Uma promessa anterior do assistente não serve como comprovação. A retomada salva apenas a tarefa ausente, mantendo o identificador e horário da mensagem original na origem.
- Repetir tarefa com mesmo título e vencimento não cria outro lembrete. O recibo informa o que foi salvo e o que ficou pendente. Cadastro de fichas, RGN, estoque e movimentos anteriores não são refeitos.
- Consentimento, janela de envio, templates e limites de entrega permanecem no fluxo existente. Não habilitar mensagens gerais para testar.

## Validação

`tests/guardian-natural-multi-goals.test.ts` cobre as frases reais recentes, ordem invertida, compra + pagamento + dois lembretes, caderno independente, lista de tarefas com um só verbo, negativas, transcrição incerta, confirmação só da espécie, recibo antigo parcial e ausência de prova. `tests/guardian-multi-intent.test.ts` mantém os casos da primeira publicação; a expectativa de uma entrada sem quantidade agora diferencia tarefa salva de rebanho pendente.

Executar suíte completa, build, auditoria, lint e painel integrado; publicar backend e frontend no projeto Netlify `tpec-ia`. Sem nova migração SQL, segredo ou variável de ambiente: os novos campos opcionais pertencem ao rascunho JSON já persistido.

## Revisão histórica

A compra de quatro bovinos da mensagem das 14h42 de Brasília já estava persistida e o saldo calculado da Eduardo era 108. Não repetir nem excluir essa compra. A tarefa de alimentação às 18h30 estava ausente. Sua recuperação exige uma única gravação versionada, com origem da mesma mensagem, auditoria e evento de tarefa do fluxo normal. Confirmar o livro e a ausência de duplicação antes e depois; não enviar mensagem manual a clientes. Este documento não constitui recibo da recuperação.
