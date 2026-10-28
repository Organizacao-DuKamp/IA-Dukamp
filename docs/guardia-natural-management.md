# Conversa natural: rebanho, propriedade ativa e financeiro

Correção baseada na análise autorizada das últimas 20 mensagens do produtor, sem copiar dados privados para o repositório. Base: main após PR #84.

## Causas e mudanças

- Livros antigos sem `operations` não chegavam ao extrator de movimentos. Nascimentos e compras agora inicializam as operações existentes, sem exigir brincos nem um censo inventado. Total desconhecido permanece desconhecido; entradas e indicadores ficam registrados. Saídas sem saldo conhecido continuam bloqueadas.
- Uma fazenda mencionada explicitamente e pertencente ao remetente torna-se a propriedade ativa, com recibo próprio de seleção. A seleção persiste entre mensagens. Nomes desconhecidos/duplicados não escolhem outra fazenda. Transferências entre propriedades conservam o fluxo conjunto anterior, sem selecionar o destino como origem.
- A escolha de código do painel aceita “2. Tambori” em resposta à lista de fazendas; número e nome devem corresponder. Fora desse contexto, um número não emite acesso.
- Pedidos como “Eu quero que você registre 2 novos bezerros na fazenda Tambori que nasceram hoje” preservam o acontecimento. “Quero” sozinho não classifica uma inclusão como edição. Nascimento não vira anotação genérica se o movimento não for resolvido: pede esclarecimento e não confirma gravação fictícia.
- Consulta de quantidade responde com saldo calculado ou com eventos conhecidos e indicação de censo ausente. Não exige fichas individuais para contabilizar entradas.
- Custos mensais por extenso ou em linguagem comum, inclusive “despesa de cana-de-açúcar, 2 mil mensal de despesa”, entram no financeiro. Frequência mensal não agenda pagamentos futuros.
- Um lançamento novo posterior ao total declarado, no mesmo dia, é um incremento. R$ 80 mil mais R$ 5 mil resulta em R$ 85 mil. Um total posterior revisado absorve os detalhes anteriores, sem somá-los outra vez. `totalRelation: included` preserva a declaração de que o detalhe já está incluído. Totais mensais não são rateados por dia sem evidência.
- Defeitos declarados em lote/cerca/bebedouro/curral podem virar anotações de campo com origem/data/lote. Não alteram estoque ou financeiro. A memória estruturada os mantém para conversas posteriores. Não habilita alertas sem consentimento nem inventa dia/horário de lembrete.

## Integridade e publicação

Sem migração SQL, segredo, dependência ou flag nova. Campos opcionais usam o livro JSON existente. Permissões, RLS, recibos, controle de versão e origem permanecem. Validar as frases reais com dois livros, um deles antigo e sem censo; despesas/receitas, custo incluído/adicional, revisão posterior do total, repetição e recarga do painel. Não disparar mensagens a clientes.

Não reprocessar automaticamente o histórico no deploy. No caso revisado, um custo foi excluído posteriormente; sua restauração exige decisão explícita do produtor. Repetições do mesmo relato de nascimento devem corresponder a um único evento; não reproduzir todas as tentativas antigas nem inventar brincos. Mudanças de código não recriam essas operações.

## Testes

Regressões adicionadas para nascimento na propriedade mencionada, livro antigo sem operações, isolamento entre fazendas, persistência da seleção, repetição contextual, código/RGN opcionais, censo desconhecido, despesas 80+5=85, total revisado sem duplicação, detalhe incluído, custo mensal sem lançamentos futuros e defeito de lote sem efeitos financeiros/estoque. A suíte integral inclui permissões e transferências transacionais anteriores.
