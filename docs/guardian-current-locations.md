# Localização atual do rebanho e conferência operacional

Base: `0b24983` / PR #97. Revisão de 30/10/2026.

## Evidência e causa

O histórico recente do teste final 2376 confirmou uma mudança integral às 09h20 para o lote pasto. O livro na versão 40 contém quatro localizações por espécie: 170 bovinos e os grupos de 20 aves, 58 suínos e 4 ovinos. Os três últimos totais gerais continuam desconhecidos, mas seus grupos já estão no destino. As entradas originais continuam sem lote porque esse era o dado na chegada.

A tabela principal misturava chegadas históricas com mudanças posteriores. Assim, uma chegada de 50 bovinos ainda aparecia como sem lote mesmo estando incluída na mudança integral. O pedido seguinte caiu em `intent:none`, e a resposta geral explicou a solicitação sem consultar o resultado operacional. Também foi observado um pedido de código com vocativo mal transcrito respondido apenas como seleção de fazenda.

## Correção

- `herd-location-report.ts` calcula a distribuição atual sobre o livro completo, usando contagens, grupos, transferências, mudanças integrais e fichas ativas. Não soma fichas novamente aos grupos. Exibe quantidades localizadas de espécies sem total conhecido e detecta novas chegadas sem lote. Totais gerais desconhecidos continuam desconhecidos.
- O painel coloca a localização atual em destaque. O histórico fica em uma seção própria, com a coluna “Lote no registro” e explicação de que os dados antigos preservam o local da época. A origem da compra/nascimento não é reescrita.
- `intent:inspect` consulta o estado real e monta a resposta no servidor. Uma ordem que inicialmente retorna `none` é reinterpretada uma vez: executar uma alteração ainda necessária, conferir a situação já resolvida ou esclarecer um alvo realmente ambíguo. Não confirma sucesso por texto gerado nem repete uma movimentação já concluída.
- O contexto de interpretação tem limites de detalhes, mas os totais e a indicação de pendências vêm do livro completo. A consulta final também usa os registros completos.
- `intent:panel` encaminha pedidos conversacionais de acesso ao emissor de códigos existente. As associações e permissões são revalidadas; emitir código para uma fazenda não muda a propriedade selecionada.

Grupos sem brinco/RGN ou sem total geral conhecido continuam manipuláveis pelos executores existentes. A autonomia usa os vínculos e permissões do produtor; não adiciona privilégio global nem contorna autorização de outras propriedades.

## Validação e implantação

Testes com PostgreSQL isolado cobrem a chegada sem identificação, o pedido inicialmente ignorado seguido de execução ou conferência, replay sem duplicação, totais desconhecidos, chegadas posteriores e acesso ao painel sem seleção indevida. A avaliação real do provedor usa somente oito contextos fictícios, incluindo a continuação de uma mudança já concluída e o vocativo de áudio. O navegador verifica o quadro atual, o grupo no destino, o histórico recolhido, persistência, celular e saída.

Não há migração SQL, pacote, segredo ou flag nova. Conferir CI e preview do commit exato e publicar frontend e workers no mesmo build. Os registros existentes são suficientes: não reexecutar o histórico, não recriar animais e não corrigir artificialmente o lote das entradas antigas.
