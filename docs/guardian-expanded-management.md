# Gestão ampliada do painel da fazenda

As seis áreas do painel foram preservadas. Vinte funções compatíveis foram adicionadas como subfunções, usando o mesmo livro e executor do WhatsApp e do painel.

| Área        | Novas funções                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebanho     | Pastos/piquetes/currais, manejo de pastagem, análise de solo, aplicações sanitárias, exames, inseminações/coberturas, diagnósticos de gestação, detalhes de partos, avaliação fecal e fornecimento nutricional |
| Finanças    | Contas a pagar e contas a receber, quitação e estorno auditados                                                                                                                                                |
| Combustível | Veículos/máquinas, ordens de serviço e custos de veículos                                                                                                                                                      |
| Estoque     | Produtos/matérias-primas, locais e fórmulas/dietas; saldos por local, transferência, correção e cancelamento dos movimentos existentes                                                                         |
| Caderno     | Rondas e ocorrências                                                                                                                                                                                           |
| Tarefas     | Agenda, conclusão, reagendamento e repetição diária existentes continuam disponíveis                                                                                                                           |

Pesagens, identificação/genealogia, nascimentos, compras, descartes, lotes, movimentos do rebanho, entradas/despesas, combustível e tarefas existentes foram reaproveitados. Confinamento especializado e bancos de sêmen/embriões não foram adicionados.

## Operação

- `management_save`: cria ou edita parcialmente uma entrada de uma seção. `reference` identifica uma entrada real por ID ou nome exato; ausente significa inclusão. Campos opcionais podem ser apagados por `clear`.
- `management_remove`: arquiva com motivo/origem. Não elimina fatos financeiros já realizados.
- `management_settle`: quita uma conta e cria uma única entrada correspondente em `ledger`. Vencimentos futuros não entram no saldo realizado.
- `management_unsettle`: estorna o lançamento vinculado, preserva o histórico e libera a conta para correção e nova quitação.
- Consultas sem mutação usam `inspect` com `inspection.kind=management`, seção e referência opcionais. A resposta é construída pelo servidor a partir do livro completo, com limite explícito e possibilidade de refinar a consulta.
- `supply_movement.location` acrescenta localização opcional sem modificar o significado dos movimentos antigos. `supply_transfer` grava entrada e saída juntas e conserva o saldo; exige contagem relatada nos dois locais, inclusive zero. `supply_edit` preserva a quantidade/data anterior; `supply_void` cancela as duas pontas de uma transferência.

Os formulários usam a mesma definição de campos e validação do executor. Proprietário e gerente podem manipular as novas funções. O WhatsApp recebe o catálogo de ações e os registros reais no contexto sem usar comandos rígidos. Ambiguidade ou referência inexistente bloqueia a operação e pede esclarecimento; nunca escolhe outra fazenda ou outro registro silenciosamente.

## Integridade e limites funcionais

A persistência usa o JSON do livro já existente, validação server-side, controle de versão e recibos idempotentes. Não requer tabela ou migração nova. As novas famílias usam a autorização SQL existente de proprietário/gerente, sem ampliar os direitos dos demais integrantes. Histórico e origem ficam no livro e na auditoria.

Todos os campos são validados por seção; dados de uma função não são aceitos em outra. Eventos realizados não aceitam data futura. A edição parcial não apaga campos omitidos. Valores de procedimentos e OS são informativos: uma despesa só é lançada quando o produtor solicita seu registro financeiro. Quitações, por outro lado, sempre geram seu lançamento vinculado uma única vez. Estornar mantém o lançamento anterior cancelado e auditado.

O fornecimento de dieta registra o consumo informado. Saídas de ingredientes exigem quantidades/unidades explícitas, podendo ser solicitadas no mesmo pedido atômico. Não se presume conversão de saco para kg nem estoque inicial. Detalhe de parto não substitui o evento de nascimento que atualiza a contagem. Não há prescrição automática de doses, diagnóstico veterinário ou cálculo de fórmulas a partir de dados ausentes.

## Exemplos de WhatsApp

- “Registre a vacina Produto X que apliquei hoje no lote 2.”
- “Na ocorrência da cerca do pasto Norte, coloque concluída e anote que troquei o arame.”
- “Tenho R$ 800 de ração para pagar dia 10. Cadastre essa conta.”
- “Paguei hoje a conta da ração, dê baixa nela.”
- “Marquei o pagamento errado; estorne a quitação da conta da ração.”
- “Transfira 20 kg de milho do galpão A para o B.”
- “Quais contas ainda tenho a pagar?”
- “Remova aquela análise de solo cadastrada por engano.”

A IA usa o histórico para identificar as referências; nomes duplicados ou dados necessários ausentes exigem esclarecer apenas o que falta. Exemplos pressupõem os cadastros e saldos reais necessários.

## Verificação

`tests/guardian-management.test.ts` cobre o ciclo de inclusão, edição e remoção nas vinte funções, permissões, referências ambíguas/inexistentes, validação por seção, atomicidade, quitação/estorno, preservação de caixa, consumo por local, transferências e correções retroativas, persistência via RPCs PostgreSQL, replay e contexto do WhatsApp.

`scripts/check-farm-panel.mjs` exercita as novas funções pelo navegador, pela API pública e por um PostgreSQL isolado. `scripts/check-management-semantics.mjs` avalia frases naturais com o modelo configurado no ambiente de CI, usando exclusivamente dados sintéticos e sem adaptador de envio de mensagens.
