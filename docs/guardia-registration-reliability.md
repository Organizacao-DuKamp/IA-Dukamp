# Registro confiável do rebanho por conversa

Branch: `fix/guardian-registration-reliability`. Base: `origin/main` em `3b25fef`.

## Problema e comportamento final

Os relatos `Tpec-ia nasceu +2 bezerros novos hoje na minha fazenda ok` e `Hoje mesmo nasceu 2 bezerros aqui na minha fazenda` já traziam os dados necessários. A leitura anterior exigia verbo/número em posições específicas: o sinal `+` e a palavra `mesmo` impediam o reconhecimento. Depois disso, a proteção contra confirmações fictícias bloqueava o registro e voltava a pedir dados já presentes.

A leitura dos movimentos agora separa tipo do acontecimento, quantidade, animais, dia e propriedade. Aceita o verbo depois de expressões de contexto, a quantidade antes do verbo, `+2`/`+ 2`, números por extenso e modificadores como `novos`. Localização da frase não vira nome inventado de fazenda. Nascimento, compra, venda e morte continuam sendo eventos distintos. Compras de sacos de ração, por exemplo, não viram compras de animais.

Ambas as frases do print, quando apresentadas como um acontecimento novo, salvam **dois nascimentos** e atualizam o saldo no livro que alimenta `/painelfazenda`. A resposta mostra o saldo depois do commit, sem outra chamada à IA. Código/brinco e RGN continuam sendo solicitados, e informar as fichas depois não soma os animais novamente.

## Continuidade e consistência

- Quando realmente falta a quantidade de um único acontecimento, a TPEC-IA mantém o relato pendente e aceita uma resposta curta, como `dois`. Quando o dia é indefinido, aceita `foi ontem` ou uma data. Não exige repetir o relato completo para esses casos.
- O pedido pendente é privado, vinculado ao WhatsApp/propriedade, dura 30 minutos e usa `guardian_accounts.pending`, já existente. A origem e o horário da primeira mensagem são mantidos, inclusive se a resposta atravessar a meia-noite de Brasília. Pedidos cancelados não alteram o rebanho; propostas anteriores válidas podem ser preservadas.
- Datas impossíveis ou períodos que não identificam um dia não são convertidos em “hoje”. Relatos com mais de um movimento são salvos juntos; se um deles estiver incompleto ou o saldo ficar inconsistente, nenhum movimento do lote é aplicado parcialmente.
- Se uma entrada de mesma quantidade, tipo, dia e lote for reformulada enquanto sua identificação ainda está pendente, a TPEC-IA pergunta se são os mesmos animais ou uma entrada adicional. `São os mesmos` mantém o saldo; `são mais 2` confirma outra entrada de dois. Informar claramente `mais`/`+2` em um novo relato indica adição. Essa verificação é contextual; não é uma deduplicação semântica ilimitada de todo o histórico.
- Reenvios do mesmo identificador de mensagem reutilizam o recibo. Confirmações concorrentes de uma entrada adicional não geram duas movimentações. A mensagem de origem e a confirmação posterior ficam rastreáveis.
- Perguntas, hipóteses, negações, relatos de terceiros, quantidades fracionárias/negativas e análises visuais não se tornam movimentos automáticos. Permissões e isolamento de fazendas continuam valendo.
- Erros reais de domínio agora explicam a causa: data futura, ausência de contagem anterior ou um censo no fim do mesmo dia, por exemplo. A resposta não confirma a gravação nesses casos.

Não foi adicionada uma chamada de IA para executar movimentos por interpretação livre. Os campos aceitos passam pela validação do domínio, pelas permissões e pelo commit transacional existentes.

## Publicação no ambiente conectado

1. Buscar esta branch, revisar em relação à `main` atual e integrar pelo fluxo normal do repositório.
2. Publicar frontend/backend no projeto efetivamente conectado ao WhatsApp e ao painel. Conferir os domínios atuais e o commit do deploy, sem presumir que uma resposta antiga do bot comprova a versão publicada.
3. **Não exige nova migração SQL, segredo ou flag.** Há um novo tipo de pendência JSON (`herd_registration`) e uma confirmação contextual opcional (`repeatCheck`). Não reaplicar migrações anteriores.
4. Em propriedade/número de teste autorizados, validar as duas frases do print como entradas novas, o reconhecimento da reformulação, a identificação posterior e a recarga do painel. Não enviar mensagens a clientes.
5. Conferir as duas tentativas antigas do produtor nas mensagens/recibos e nos eventos. Se forem reformulações do mesmo nascimento de dois bezerros e esse evento ainda estiver ausente, recuperá-lo uma única vez, com origem/data/auditoria. Não somar quatro animais apenas porque há duas tentativas. Não forçar um saldo fixo se existirem outras movimentações posteriores.
6. Se já houver um evento correspondente, não reaplicar. Dados antigos não são reprocessados silenciosamente pelo deploy.

Para rollback, usar um leitor compatível com os tipos de pendência ou encerrá-los de forma auditada, preservando propostas anteriores válidas. Não apagar nascimentos, contagens, compras ou fichas para reverter o código.

## Evidências de validação

- Regressões com as duas frases exatas do print e uma matriz de **144 combinações** de tipo, quantidade, contexto e nome dos animais, além de ordem invertida, datas e entradas inválidas.
- PostgreSQL isolado: estoque calculado, recibos, reformulação sem duplicação, entrada adicional confirmada, preenchimento de quantidade/data, origem através da meia-noite, concorrência, falhas de persistência, escopo da fazenda e conflitos do domínio.
- Caminho real do processamento do WhatsApp: respostas de gravação retornam sem extrator ou IA geral para os casos determinísticos.
- Chromium com a rota pública, handler real e PostgreSQL isolado: financeiro, cálculos, novas entradas, reformulação, código/RGN, persistência após recarga, sessão e layout móvel.

Resultado final: **848 testes aprovados**, zero falhas, cancelamentos ou pulos; build com TypeScript e verificações do cliente aprovado; auditoria aprovada; Chromium aprovado; lint com zero erros e 11 avisos preexistentes. Os testes não usam banco, credenciais ou mensagens reais de produção.
