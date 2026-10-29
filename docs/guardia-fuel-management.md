# Combustível no painel e na conversa

A área **Combustível** de `/painelfazenda` usa o mesmo livro da propriedade acessado pela TPEC-IA no WhatsApp. Mostra saldo calculado por combustível/tanque, entradas, saídas, destinos, despesas do mês e comparação com um mês anterior escolhido. Valores monetários aparecem em vermelho; entradas em verde e saídas em âmbar. O saldo atual atravessa a mudança de mês; os indicadores de movimento e gasto usam o mês selecionado.

## Regras dos dados

- Diesel, gasolina e etanol permanecem separados, inclusive quando os tanques têm o mesmo nome. Entradas e saídas não inventam o saldo inicial. Sem saldo declarado, o tanque mostra **Não informado**. Uma declaração de saldo estabelece a referência; movimentos posteriores atualizam essa referência. Uma saída que tornaria um saldo conhecido negativo é recusada, sem gravação parcial.
- Reais não viram litros automaticamente. Despesa sem volume altera somente o financeiro. Uma entrada com custo gera um único lançamento financeiro vinculado à entrada. Preço por litro só gera custo total quando preço e volume foram expressamente informados; o preço informado fica no movimento como evidência. Não há integração com sensores ou consulta a preços externos.
- Custos usam `ledger`, com categoria `fuel:*`, sem um segundo financeiro. Um total mensal de gasolina absorve os detalhes anteriores de gasolina desse mês, preservando as linhas originais. Não substitui despesas de ração nem de diesel. Um total mensal de combustível sem detalhamento abrange todas as categorias de combustível. Um total da fazenda continua abrangendo seus detalhes; não se soma uma segunda vez um subtotal de combustível. Gastos avulsos posteriores ao total seguem as regras existentes de incrementos ou inclusão explícita.
- Despesas antigas que mencionam explicitamente combustível na descrição/categoria são apresentadas a partir dos registros originais. Não são copiadas, não recebem litros inventados e não têm sua origem alterada. Detalhes antigos de combustível também são reconhecidos ao calcular um novo total mensal.
- Cancelamentos preservam a linha original, motivo e proveniência. Cancelar uma entrada também cancela seu custo vinculado; cancelar somente o gasto mantém o volume. A retirada de uma entrada necessária para sustentar saídas posteriores é recusada. É possível informar novo saldo ou total mensal correto preservando as declarações anteriores.

## Conversa

Exemplos cobertos por testes:

- “Hoje o custo da gasolina foi 500.”
- “Esse mês foi 2000 de gasolina.”
- “Paguei dois mil de diesel hoje.”
- “No tanque principal tem 1000 litros de diesel.”
- “Entrou 500 litros de diesel no tanque principal e paguei R$ 3000.”
- “Saíram 250 litros de diesel para o trator e saíram 20 litros para o caminhão.”
- “Abasteci o caminhão com 20 litros de gasolina.”
- “Comprei 100 litros de diesel por R$ 6,50 por litro.”
- “Cancele a última despesa de gasolina.”

A pergunta “esse mês foi tanto de gasolina” pede apenas o valor faltante; uma resposta como “2000” completa o pedido original, mantendo mensagem e data de origem. “Mais 100” pode continuar uma despesa de combustível imediatamente confirmada na mesma fazenda. O sistema usa o relato do produtor e o recibo efetivamente salvo, sem aproveitar uma promessa inventada do modelo ou contexto de outra propriedade.

Pedidos completos de combustível podem ser combinados com rebanho, financeiro, caderno e lembretes. Dados incompletos, dois combustíveis misturados, destinatários incertos, datas inválidas, planos futuros, citações e negativas não produzem gravação presumida. A pendência de esclarecimento dura 30 minutos e pode ser cancelada. Um novo relato igual ao de poucos minutos atrás pede “o mesmo” ou “outro”; o mesmo ID de mensagem sempre usa o recibo existente. Isso reduz duplicidade sem bloquear duas despesas legítimas de mesmo valor.

Linguagem natural não garante interpretação infalível. Quando falta valor, quantidade, combustível, destino ou tanque entre várias opções, a resposta pede esse dado antes de confirmar o registro. Não há aprendizagem de preferências entre fazendas ou usuários.

## Acesso e publicação

Não exige migração SQL, novo segredo ou variável de ambiente. `fuel` e os campos opcionais do financeiro ficam no JSON versionado do livro. Livros antigos continuam válidos. As novas ações usam a família financeira `ledger` no RPC existente, com o tipo exato e as ações na auditoria da conversa. Não há expansão de permissões: proprietário e gerente administram; outros perfis seguem o acesso existente de consulta. A gravação por painel mantém validação de sessão, origem, versão, repetição e RLS. Segredos e integrações continuam no servidor.

O cancelamento e a edição são conferidos no painel antes de salvar. Consultas e relatórios usam somente a propriedade autorizada. O CSV inclui os movimentos e identifica cancelamentos. Nenhum histórico real deve ser reprocessado ou corrigido automaticamente ao publicar este recurso.

## Homologação

`tests/guardian-fuel.test.ts` verifica linguagem, valores brasileiros e falados, estoque entre meses, separação de combustíveis, destinos, negativos, totais sem duplicidade, despesas antigas, cancelamento, origem, continuação, repetição, pedidos com vários objetivos, permissões e API do painel. `scripts/check-farm-panel.mjs` testa a área no Chromium com banco PostgreSQL isolado, inclusive entrada pelo painel, saída e custos pela conversa, recarga, comparação e layout móvel.

Na publicação, confirmar commit e deploy no projeto `tpec-ia`; verificar `/painelfazenda` e a API real com fazenda fictícia e envio desabilitado. Validar que saldo e despesas persistem, que código de acesso não pode ser reutilizado e que logout nega acesso. Remover somente a fazenda fictícia e seus acessos ao terminar; preservar a auditoria técnica. Não enviar mensagens a clientes para homologar.
