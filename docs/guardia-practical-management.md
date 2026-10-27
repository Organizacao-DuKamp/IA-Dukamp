# Gestão prática pelo WhatsApp: referências, edições e linguagem falada

Branch: `fix/guardian-practical-management`. Base: `origin/main` em `71a759e` (PR #83 já integrado).

## Problema e comportamento entregue

O produtor conseguia descrever corretamente um nascimento, uma despesa ou a troca de lote, mas certas frases eram descartadas antes de chegar à operação persistente. “Coloque os dois últimos no lote 2” caía na conversa geral: havia uma confirmação em linguagem natural e uma anotação privada, sem atualização das fichas do painel.

O fluxo distingue criar registros de editar registros existentes. Referências claras são resolvidas contra os dados reais da propriedade, e uma operação só é confirmada depois de seu recibo transacional. Quando falta um alvo ou um dado, a pergunta preserva o restante do pedido; o produtor pode responder naturalmente em outra mensagem.

### Rebanho e lote

- O áudio `Repente, adicione mais dois bezerros que nasceram hoje, tá? no rebanho, por favor` registra dois nascimentos. A quantidade por extenso, o pedido para adicionar e as pausas do áudio não invalidam o fato informado. `Não, eu quero que você adicione mais dois bezerros que nasceram hoje na fazenda` também é reconhecido; uma negação factual continua protegida.
- `Sim, eles tem:\nDUKN 402\nDUKN 404` salva duas identificações como códigos, sem inventar RGN. Listas com vírgula ou “e” continuam aceitas. Não exige copiar um modelo de frase.
- `Código b01, DUKN 401\nCódigo b02, DUKN 404` mantém os pares e pergunta uma vez se o segundo dado é o RGN. Um `sim` àquela pergunta confirma os pares; `não` mantém a pendência para correção. Também é possível informar explicitamente código/RGN, como antes.
- `Sabe esses dois últimos animais registrados? Então, coloque eles no lote 2 da fazenda por favor` altera as duas fichas mais recentemente cadastradas. Código, RGN, pesagens e nascimento permanecem nas fichas. Atualizações de fichas existentes não mudam sua ordem de cadastro.
- O áudio `Faça o seguinte, esses dois novos bezerros que nasceu na fazenda, que eles estão numerados, coloque ele no lote 2 da fazenda, tá bom?` resolve o grupo recém-identificado e realiza a mesma alteração. A oração sobre o nascimento não cria outro nascimento.
- Códigos, RGN, “o último animal” e o grupo recente mencionado pelo produtor também podem selecionar fichas. Referências vagas, quantidades maiores que as fichas disponíveis, códigos desconhecidos ou um animal inativo impedem uma alteração parcial. A pergunta mostra os registros recentes para ajudar o produtor.
- `Mude o último animal de lote` → `no lote 3` mantém a seleção até receber o destino. Pendências têm propriedade, origem e validade de 30 minutos.

A mudança individual de lote é uma atribuição atual nas fichas, registrada no histórico de movimentação do caderno. Não recria nascimento/compra, não inventa contagens de lotes e não altera o estoque total da fazenda. A repetição do mesmo pedido, inclusive por outro texto com os mesmos destinos, não acrescenta movimentos iguais a fichas que já estão no lote solicitado. Transferências quantitativas com censos de lotes continuam com suas regras próprias.

### Financeiro e caderno de campo

- O áudio `Olha, registra pra mim que a minha fazenda, ela tem cinco mil de despesas todos os meses, tá? E só com cana de açúcar` salva no financeiro **R$ 5.000 com cana de açúcar**, marcado como valor mensal informado pelo produtor. Não salva a expressão genérica “essa despesa”.
- A frequência mensal é informação declarada do custo, visível no painel. Este registro é do período atual: não cria automaticamente pagamentos em meses futuros, nem um fechamento de todas as despesas da fazenda. O item não usa `periodMonth` de total agregado e não substitui outros custos. Totais mensais explícitos do produtor mantêm a composição já existente.
- `Registre essa despesa` procura os dados nas mensagens recentes do produtor, inclusive transcrições de áudio, preservando valor e objeto. Uma mensagem do assistente não fornece valor para gravação. A referência para ao trocar a fazenda ou ao encontrar um relato de outra propriedade. Se aquele registro já está no livro, informa que já foi salvo e não duplica.
- `Corrija a última despesa para 600 reais` altera o lançamento existente, mantendo a descrição e os demais dados. `Corrija a última despesa` → `600 reais` pergunta apenas o que mudar e retém o lançamento escolhido.
- `Altere a última anotação para o lote 2, foi ontem` modifica a anotação existente. Pode selecionar uma anotação também por seu código ou por uma descrição que corresponda a um único registro.
- Correções preservam a origem do registro e guardam os valores anteriores com a origem de cada revisão. Campos futuros e mudanças financeiras por perfis sem permissão são rejeitados. O mesmo livro é utilizado pelo WhatsApp e pelo painel público.

## Integridade e compatibilidade

As operações passam por `ActionSchema`, permissões, aplicação em cópia do livro e um único commit com controle de versão. Nenhum item de um pedido é persistido se outro item falhar. Reenvios do webhook reaproveitam o recibo. Os alvos de uma alteração já resolvida permanecem os mesmos em uma repetição por conflito; uma troca concorrente de fazenda interrompe o pedido.

Perguntas sobre como realizar uma alteração, condicionais e relatos de terceiros não executam edições. Respostas curtas seguem a última pergunta; `exatamente`, `isso` e `correto` recebem a mesma proteção de foco que `sim`. Um pedido de edição que não pode ser resolvido recebe esclarecimento, sem confirmação gerada apenas pela conversa geral. Os casos deste documento não exigem pesquisa externa nem chamadas adicionais de IA.

**Sem migração SQL, segredo, nova dependência ou flag.** Campos opcionais foram adicionados aos livros JSON e ao estado `guardian_accounts.pending`: revisões de registros, frequência mensal declarada, pares de identificação propostos e `management_draft`. A nova ação `edit_record` usa a família de autorização SQL existente (`ledger` ou `record`), com validação do campo/da seção e permissão antes do commit. Não amplia acesso financeiro de funcionários. Livros existentes permanecem legíveis; rollback precisa de leitor compatível ou de tratamento auditado dessas pendências/campos opcionais.

## Publicação e recuperação do caso relatado

1. Buscar a branch, revisar contra a `main` atual, integrar e publicar os projetos conectados que atendem o WhatsApp e `/painelfazenda`. Verificar os domínios efetivamente configurados. Não basta publicar somente o frontend.
2. Usar uma propriedade e número de teste autorizados para os exemplos acima. Conferir no painel após recarregar: lote das fichas, total do rebanho, quantidade de nascimentos, despesa com cana, correção de valor e revisão da anotação.
3. Para o caso do produtor, **não repetir os dois nascimentos** nem recriar as fichas. Conferir, na propriedade autorizada Eduardo e nas mensagens de origem de 27/10/2026, as fichas **b01 / RGN DKN 404** e **b02 / RGN DKN 406**. O pedido do produtor é atribuir essas duas fichas ao **lote 2**. Se corresponderem, aplicar somente as duas mudanças de lote juntas, com origem e auditoria, e verificar no painel. Se já estiverem corretas, tratar como concluído. Se código, RGN ou propriedade não corresponderem, esclarecer a divergência antes de tocar em outra ficha.
4. Conferir a despesa de cana de R$ 5.000 já lançada como “essa despesa”. Se houver uma única correspondência na fazenda e na mensagem indicada, corrigir a descrição preservando valor, origem e revisão; não adicionar outra despesa nem reprocessar a conversa em massa.
5. Não enviar mensagens a clientes para demonstração. Os testes desta implementação usam PostgreSQL isolado e não tocaram em registros ou credenciais de produção.

## Verificação

A suíte adiciona cenários com as frases reais, áudio no adaptador de WhatsApp, referências a grupos, códigos numéricos que não se confundem com números de lotes, listas com um código desconhecido, escolhas em mensagens separadas, permissões, atomicidade, revisão de valores e leitura/edição pelo HTTP público do painel. O Chromium verifica as fichas movidas, o custo mensal e as correções depois de recarregar, além de sessão, calculadora e layout móvel.

Resultado: 876 testes aprovados; build com TypeScript, módulos administrativos e varredura de segredos no cliente aprovado; auditoria de importações privilegiadas aprovada; Chromium aprovado; lint com zero erros e 11 avisos preexistentes.
