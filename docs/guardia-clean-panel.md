# Painel da fazenda: leitura visual e gestão simples

A visão geral prioriza o rebanho calculado, nascimentos, mortes, financeiro e tarefas.
Detalhes de cálculo, origem e relatórios ficam em seções expansíveis. Quantidade de fichas
não é apresentada como total do rebanho. Valores desconhecidos continuam identificados.

Receitas usam verde, despesas vermelho e pendências âmbar, com rótulos, ícones e sinais
para que a cor nunca seja o único indicador. Saldo negativo também aparece em vermelho.
O financeiro tem busca por descrição/lote e filtros de tipo. Os filtros alteram somente
a lista; os totais mantêm as regras existentes de não duplicação de totais mensais.
Lançamentos já absorvidos por um total ficam identificados. Origem e dados originais
permanecem disponíveis em Detalhes do lançamento.

A navegação usa ícones, fichas destacam RGN e lotes e o formulário começa no tipo adequado
à área, respeitando os tipos autorizados ao perfil. Todas as gravações continuam passando
pela revisão e confirmação existentes; autenticação, sessão, RLS e API não mudam.

Sem migração SQL, novas variáveis ou dependências de produção. Publicação pelo fluxo Git
existente do projeto tpec-ia. Nenhuma alteração em registros de produtores.

Validação: suíte de domínio/API; build e verificação de segredos; lint; script Chromium
`scripts/check-farm-panel.mjs` com PostgreSQL isolado, sessão, gravação revisada, recarga,
financeiro, filtros/busca, rebanho, fichas, calculadoras, mobile e logout. Capturas visuais
usam apenas a propriedade fictícia de teste.
