# Contexto de conversa no rebanho, financeiro e caderno de campo

Branch: `fix/guardian-conversation-context`. Base: `origin/main` em `00df27a`.

## Resultado

Respostas curtas agora são interpretadas junto do registro pendente. O produtor não precisa repetir os termos “código”, “valor” ou toda a atividade para completar uma informação já solicitada. As operações continuam sendo confirmadas somente depois de persistidas no livro da propriedade autorizada.

### Rebanho e identificação

Após uma compra de quatro animais, `Apenas 1 gado tem:\nDUKN 401` salva **uma ficha com código DUKN 401**, mantém o rebanho e reconhece que os outros três estão sem identificação. Não inicia pesquisa pública nem tenta interpretar “APENAS 1” como série genealógica.

Como a resposta não especifica se aquele identificador também é RGN, o código já é salvo e a pergunta seguinte fica limitada a isso: “O código DUKN 401 também é o RGN desse animal?”. `Sim, é o mesmo`, `não` ou um RGN diferente completam o contexto correto, sem criar outra ficha ou aumentar o estoque. Não há presunção de validação oficial.

Outros casos cobertos:

- `Só um possui identificação` mantém a quantidade informada e pergunta apenas pela identificação desse animal; a resposta pode ser só `DUKN 402`.
- Identificadores sem rótulos e listas de identificadores são aceitos durante a identificação pendente. Código e RGN declarados explicitamente continuam funcionando.
- Um RGN informado antes do código fica pendente; a resposta posterior com o código aproveita o RGN já informado. Se o produtor confirmar que ambos são iguais, o mesmo valor é usado nas duas posições.
- “Os demais não têm” encerra a identificação dos restantes; não inventa fichas ou códigos.
- Perguntas como “o que é RGN?” recebem uma explicação local e mantêm o pedido pendente. Pesquisas públicas são permitidas quando o produtor efetivamente pede consulta, raça ou genealogia; uma resposta de cadastro não vira pesquisa por parecer um registro.

### Financeiro

`Paguei a ração` pergunta só pelo valor em reais. A sequência `foi ontem` → `foi 1.250,50 reais` preserva o objeto e salva uma despesa de R$ 1.250,50 na data informada. Complementos de valor, objeto, dia e lote podem vir fora da ordem da pergunta; o próximo pedido trata somente do que ainda falta.

`Recebi R$ 500 hoje` pede a descrição. `Foi com a venda de leite` completa a receita, sem perder valor ou data. Relatos completos como `Hoje paguei R$ 150 com adubo` vão diretamente ao financeiro. Nenhum desses casos cria uma anotação genérica no caderno de campo.

Relatos mensais mantêm todos os valores: `Minha receita foi de 100 mil e minha despesa de 80 mil` → `nesse mês` salva os dois totais com o período informado. Os critérios existentes de histórico e composição do saldo mensal continuam valendo; não se somam novamente detalhes já abrangidos pelo total mensal.

Comandos financeiros canônicos que já exigiam conferência mantêm essa etapa. Se a proposta era “Despesa R$ 150 com ração hoje” e o produtor responde `foi ontem`, a proposta é atualizada preservando valor/objeto e só é gravada depois de `confirmar`. A revisão e a confirmação ficam rastreáveis.

### Caderno de campo

`Consertei a cerca semana passada` → `no lote 3` → `foi ontem` salva uma anotação com a atividade, lote e dia, sem movimentar o financeiro ou o estoque de animais. `Registre no caderno de campo` pode ser completado pela descrição enviada na mensagem seguinte.

Atividades declaradas como vacinação, manutenção, adubação e limpeza são tratadas como registros, sem inferir diagnóstico ou prescrever condutas. Movimentações de animais continuam passando pelo fluxo de rebanho. Quando uma compra de animais e seu pagamento estão explícitos na mesma mensagem, os dois registros são preparados e salvos juntos.

## Foco e integridade

- O pedido pendente é privado, persistido no banco, vinculado ao WhatsApp e à propriedade, com validade de 30 minutos. Os campos já fornecidos e a mensagem de origem são preservados.
- A última pergunta da conversa controla respostas curtas e ambíguas: um `sim` depois de uma pergunta sobre clima não confirma um RGN ou proposta financeira anterior; `150` em resposta a uma pergunta sobre chuva não preenche uma despesa antiga. Retomar explicitamente “o valor foi 150 reais” permite continuar a despesa.
- Ao retomar uma pendência anterior depois de concluir outra operação, a resposta mostra a pergunta que voltou a ficar ativa. Não há confirmação silenciosa de uma operação suspensa.
- Consultas como `resumo financeiro`, `financeiro` e `caderno de campo` não criam rascunhos de novos lançamentos.
- Códigos/RGN duplicados, listas excessivas, permissões de funcionários, troca de fazenda, expiração, idempotência e controle de versão continuam sendo verificados. Funcionário pode anotar atividades permitidas sem receber permissão para lançar no financeiro.
- Não foram adicionadas chamadas de pesquisa ou de IA para executar as continuações determinísticas. As informações persistidas continuam sendo declarações do produtor.

## Publicação no ambiente conectado

1. Buscar a branch, revisar em relação à `main` atual, integrar e publicar backend/frontend no projeto que efetivamente atende WhatsApp e `/painelfazenda`.
2. **Não exige nova migração SQL, segredo ou flag.** O estado adicional usa `guardian_accounts.pending`: novo tipo `record_draft` e campos opcionais de identificação/disponibilidade. Livros existentes permanecem compatíveis.
3. Em uma propriedade/número de teste autorizados, executar o exemplo exato de identificação, uma despesa com valor/data em mensagens separadas e uma anotação com data/lote em mensagens separadas. Conferir os registros no painel após recarga. Não enviar mensagens a clientes para demonstrar a funcionalidade.
4. Para o exemplo antigo, a compra de quatro animais já foi registrada: **não repetir a compra**. Conferir a mensagem de origem e a ficha existente; recuperar somente a identificação ausente, se necessário. Não atribuir RGN sem uma declaração/confirmação do produtor. Não reprocessar em massa registros financeiros ou anotações antigas.
5. Para rollback, usar leitor compatível com as novas pendências ou encerrá-las de forma auditada, preservando operações anteriores válidas. Não apagar registros para reverter o código.

## Validação

Testes determinísticos e PostgreSQL isolado cobrem os exemplos acima, ausência de consulta externa indevida, disponibilidade de identificação, RGN por confirmação, continuidade de valor/data/objeto/lote, revisões de propostas, consulta sem efeitos colaterais, permissões, propriedade e troca de assunto.

O Chromium usa a rota pública, o handler real e um PostgreSQL isolado para verificar rebanho, código/RGN, financeiro e caderno de campo após recarga, além de sessão, calculadora e layout móvel. Nenhum teste usa banco, credenciais ou mensagens reais de produção.

Resultado final: **863 testes aprovados**, zero falhas, cancelamentos ou pulos; build com TypeScript e verificações do cliente aprovado; auditoria aprovada; Chromium aprovado; lint com zero erros e 11 avisos preexistentes.
