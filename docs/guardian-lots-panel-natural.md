# Lotes, áreas e acesso natural ao painel — 30/10/2026

Base: `main` em `633b489`, incluindo a correção de grupos reais do PR #97 (`e344d01`).

## Falhas verificadas

A leitura das mensagens recentes do número de teste final 2376 confirmou a rejeição da mudança de todos os animais para o lote 2 e a exigência indevida de contagens antigas ao mover o grupo da compra recente. A versão com transferência de grupos reais ainda não havia sido integrada à produção. O pedido de código com o nome precedido de “a fazenda” era reconhecido como acesso, mas sua referência não correspondia ao nome puro cadastrado.

## Resultado

- O código separa a intenção de acesso da referência à fazenda. Aceita artigos, o substantivo fazenda, pedidos conversacionais e a resposta apenas com nome/número à pergunta de escolha. Resolve exclusivamente contra os vínculos atuais do remetente, recusa nomes ambíguos e confere número e nome quando ambos aparecem. Não seleciona outra propriedade como efeito colateral nem modifica permissões.
- A transferência de grupos reais já preparada no PR #97 passa a compor a entrega. Origem sem lote não vira um lote fictício chamado Fazenda. A compra/nascimento original, o total da fazenda e a identificação individual são preservados.
- `herd_relocate` atende à ordem explícita de mover todos os animais registrados, ou todos de uma espécie, para um lote. O servidor usa o livro completo e grava `operations.lotPlacements`, com saldo conhecido ou desconhecido, origens incluídas e auditoria. Não cria compra, nascimento ou censo fictício. Fichas ativas acompanham a mudança; animais vendidos/mortos não são movidos. O destino pode ser criado pelo pedido. Mudanças parciais continuam exigindo grupo, ficha ou saldo seguro.
- A localização integral vale para o dia atual. Dados anteriores continuam intactos; alterar estoque antes dessa mudança ou corrigir uma chegada já incluída exige reconciliação. Uma nova contagem geral ou saída sem origem não deixa um total exato incorreto no lote. Entradas posteriores sem lote não são automaticamente alocadas.
- `lot_update` cria/edita pastagem e hectares sem exigir contagem. Referências faladas de lote, piquete e área resolvem os nomes existentes e os números, preservando identificadores distintos como `03` e `3`. Transferências quantitativas também aceitam os saldos atuais comprovados pelo livro, inclusive o destino novo autorizado, sem fabricar contagens de ontem.
- O painel, o formulário e o CSV leem as novas localizações. WhatsApp e HTTP usam as permissões, o controle de versão e os recibos transacionais existentes; a família SQL continua `lot_transfer`.

## Validação

A suíte local abrange linguagem de acesso, nomes ambíguos e propriedades sem vínculo, mudança integral e parcial, espécies com total desconhecido, chegada posterior, censos, saídas, áreas, permissões, atomicidade, replay, PostgreSQL isolado e leitura HTTP após recarregar. O roteiro Chromium verifica também a mudança de todo o rebanho no painel, saldos, origem preservada, versão móvel e saída.

`scripts/check-lot-semantics.mjs` valida no provedor configurado cinco contextos literais totalmente fictícios: criação de piquete, edição de área, todos os animais, somente bovinos e somente um grupo. Antes da chamada, verifica as referências sintéticas e remove deste processo as configurações de banco, WhatsApp e integração comercial. `--offline` executa apenas a conferência dos fixtures. O preview usa essa avaliação específica junto da suíte completa, lint e build. A avaliação ampla anterior permanece disponível em seu script, mas não é executada por esta mudança.

Nenhum histórico real foi reexecutado, nenhum WhatsApp foi enviado e nenhuma fazenda de produção foi modificada nos testes. O pedido antigo só deve ser retomado por uma nova mensagem do produtor após a publicação.

## Publicação

Não exige migração SQL, pacote, segredo ou flag nova. Conferir CI e preview do commit exato antes da integração. Publicar o frontend e os workers pelo mesmo build e confirmar o commit de produção no projeto oficial `tpec-ia`. Reversões devem preservar os leitores de `lotTransfers`, `openedOn` e `lotPlacements`; não republicar binário antigo com schema estrito nem apagar livros ou origens.
