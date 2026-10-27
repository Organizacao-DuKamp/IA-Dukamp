# Correções de financeiro, rebanho e calculadoras

Base: `origin/main` em `f0d99c6`, incluindo a implantação do painel e a renumeração das migrações feita em produção. Branch: `fix/guardian-finance-herd-capture`.

## Comportamento corrigido

- “A minha fazenda tem uma receita de 100 mil e uma despesa de 80 mil nesse mês, registre isso” salva dois registros no **financeiro**, com R$ 100.000 de receita, R$ 80.000 de despesa e saldo de R$ 20.000. A resposta só confirma após o commit. Não gera uma anotação genérica no caderno de campo.
- Valores como “em torno de 40 mil” preservam a classificação de estimativa. Totais mensais armazenam `periodMonth`; `date` conserva o dia da informação. Sem um período ou valor suficiente, a resposta pede os dados faltantes e não registra um movimento financeiro ou uma anotação genérica.
- O total mensal mais recente de cada direção e escopo prevalece nos saldos, preservando os anteriores no histórico. Lançamentos individuais já cobertos por esse total não são somados novamente; lançamentos em dias posteriores continuam sendo adicionados. Totais mensais não são rateados em filtros diários/semanais. Painel, indicadores, relatórios e exportação usam o mesmo critério. A lista exibe quais linhas permanecem apenas como histórico/detalhamento.
- “Nasceu 4 bezerros na fazenda hoje, mas hoje também morreu 2” registra ambos os movimentos na mesma transação. Com 80 animais anteriores, o resultado é **82**. A expressão “hoje” é resolvida em Brasília a partir do horário original da mensagem assinada do WhatsApp.
- O print enviado continha **2 nascimentos e 4 mortes**, cujo resultado correto é **78**. O sistema respeita as quantidades escritas, sem inverter os eventos para obter outro saldo.
- “Um dos bezerros já tem código e RGN: KBU 491” cadastra uma única ficha, sem acrescentar outro nascimento. Também aceita código e RGN distintos e identificação em mensagem separada. Sem uma data de nascimento inequívoca, não cria essa data. O RGN permanece declarado pelo produtor, sem validação oficial inventada.
- Recibos de mensagens, controle de versão e permissões continuam válidos; lotes de ações são atômicos, inclusive quando há inconsistência de estoque. Códigos de animais não são gerados para todos os nascimentos a partir de uma única identificação.
- A fonte “Referência da definição: https://…” foi retirada do texto mostrado pelas calculadoras, tanto no painel quanto na resposta determinística por WhatsApp. Fórmula, resultado e premissas continuam disponíveis. A referência técnica permanece no resultado interno.

## Publicação pelo ambiente conectado

1. Buscar a branch acima e revisar o diff em relação à `main` atual.
2. Integrar e publicar backend e frontend no Netlify `tpec-ia`, pelo fluxo normal de revisão do repositório. Conferir o commit efetivamente publicado.
3. Esta correção **não exige migração SQL nem novos segredos**: os campos financeiros opcionais ficam no livro JSONB existente. Não reaplicar ou renumerar as migrações já implantadas.
4. Validar `/painelfazenda`, financeiro, movimentos de rebanho, ficha do animal e calculadoras. Usar propriedade e número de teste autorizados, sem mensagens a clientes ou alterações em propriedades alheias.
5. Os exemplos do produtor já processados em produção não são reaplicados automaticamente. Conferir a origem e os recibos antes de recuperar os lançamentos antigos. Manter as evidências e a auditoria; não somar os totais antigos de 60/40 mil aos valores atualizados de 100/80 mil. Antes de corrigir o rebanho histórico, esclarecer a divergência entre as quantidades no texto e no print.

Após gravações com `periodMonth`/`estimated`, um rollback precisa manter a leitura desses campos opcionais. A versão anterior valida o livro estritamente e pode rejeitar os novos campos. Preferir uma correção compatível, preservando os registros; não remover dados para permitir rollback.

## Verificações

- Suíte completa: 827 testes aprovados, sem falhas, cancelamentos ou pulos.
- Build com TypeScript e verificações do cliente aprovado; auditoria de imports privilegiados aprovada.
- Lint sem erros, com 11 avisos preexistentes.
- PostgreSQL isolado: exemplos financeiros, estimativas, atualização de totais, idempotência, permissões, nascimentos/mortes, RGN e rollback de lote inconsistente.
- Chromium com a rota pública e o handler real sobre PostgreSQL isolado: lançamento manual, entrada financeira pelo WhatsApp, atualização do rebanho e RGN visíveis após recarga, cálculo sem URL de referência, sessão, layout móvel e logout.

Os testes não usam credenciais, banco ou envio de WhatsApp de produção.
