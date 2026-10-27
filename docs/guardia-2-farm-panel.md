# Guardiã 2.0 e painel da fazenda

## Diagnóstico e arquitetura reutilizada

Base auditada: `a8916ed469fa2718b73a76209d0dc96540a327c1`.

O projeto já tinha um backend TanStack Start/Nitro na Netlify, com autenticação
de webhook por assinatura Meta, deduplicação durável, recuperação de trabalho
interrompido, análise de mídia, memória privada e cadernos compartilhados de fazenda.
Não foi criado um segundo backend, nem foi retomado o antigo modo de proxy Lovable.

| Área do pedido                | Implementação reutilizada e evolução                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recepção e envio WhatsApp     | `enhanced-http.server.ts` → `backend.server.ts` → `conversation.server.ts`; assinatura Meta, claim durável, entrega e replay existentes preservados. O timestamp assinado da mensagem agora acompanha o processamento e o retry.                 |
| Conversação e memória         | Histórico recente, resumo, estado, recuperação lexical/semântica/temporal e notas privadas existentes. A conversa recebe também indicadores e recibos operacionais da fazenda ativa, com seleção limitada de evidências.                         |
| Captura espontânea            | Extrator conservador de declarações existente, com mensagem, trecho, autor e data. Uma projeção transacional liga o perfil observado a um caderno operacional privado; reaproveita um caderno de proprietário quando a associação é única.       |
| Cadastros e permissões        | `guardian_properties`, `guardian_members`, contas, convites vinculados ao telefone e papéis existentes. Nome, cidade e UF podem ser nulos em uma propriedade provisória. O rótulo provisório é somente de apresentação.                          |
| Gestão do rebanho             | Contagens declaradas, nascimentos, mortes, compras, vendas, transferências entre lotes e entre propriedades autorizadas. Registros individuais continuam separados do censo agregado.                                                            |
| Animais                       | Fichas e pesagens existentes, acrescidas de nome, categoria, RGN/RGD declarados, pai, mãe e situação. Não se criam animais individuais a partir de uma contagem ou de uma imagem.                                                                |
| Indicadores                   | Estoque calculado, evolução declarada, GMD por animal, consumo medido/estimado e saldo dos lançamentos. Calculadoras adicionais de mortalidade, natalidade, desmame, prenhez e produtividade exigem denominadores, período e dados explícitos.   |
| Alertas                       | Fila, consentimento, horários, frequência, templates, deduplicação, leases e histórico de entrega existentes. Novas regras configuráveis para GMD, contagem desatualizada e quantidade de mortes registradas, sem diagnóstico ou taxa inventada. |
| Administração                 | `/guardia` mantém perfis, propriedades, tarefas, financeiro, exportações e auditoria. A fila de revisão adiciona origem, motivo, decisão e auditoria. Métricas de custos/modelos/latência continuam no painel administrativo de IA existente.    |
| Acesso do produtor            | `/painelfazenda`, com código emitido pelo WhatsApp, escolha da fazenda, sessão privada, visão geral, rebanho/lotes, tarefas, caderno, financeiro, avisos, cálculos e edição revisada.                                                            |
| Multimodalidade               | Áudio transcrito pode alimentar os registros literais. Análises geradas de imagens, vídeos e documentos continuam excluídas da captura automática de fatos declarados. FFmpeg, limites, limpeza e recuperação existentes permanecem.             |
| ABCZ/genealogia               | Contrato desacoplado, validação de evidências, comparação de pais e testes. Sem conector autorizado, o resultado é `not_configured`; nenhuma API ou integração oficial é simulada.                                                               |
| DuKamp e conhecimento técnico | Recuperação interna, catálogo real, regras de fontes e separação de orientação técnica/comercial existentes preservadas. Não foram fabricados preços, estoque ou protocolos veterinários.                                                        |

## Fluxo do produtor

1. No WhatsApp oficial, pedir **gerar código do painel**.
2. Se houver várias propriedades, escolher com **gerar código do painel para 1**,
   ou informar um nome/código que identifique uma única fazenda.
3. Abrir `/painelfazenda` no mesmo site e digitar o código recebido.
4. Consultar os dados, escolher **Novo registro**, conferir a proposta e confirmar.
5. Usar **Sair** em dispositivos compartilhados. Para outra fazenda, pedir o código
   correspondente e iniciar outra sessão.

O acesso não exige criar uma senha ou uma conta de e-mail. Não permite buscar
fazendas pelo telefone de terceiros. O código e a sessão ficam vinculados à
propriedade escolhida e às permissões atuais do remetente verificado no WhatsApp.

O código usa 80 bits de aleatoriedade, expira em dez minutos e é consumido uma
única vez em transação. A tabela de códigos guarda o hash, não o código. Pedir
outro código para a mesma fazenda invalida os anteriores ainda não utilizados.
Pedidos são limitados no banco por remetente; tentativas de entrada também têm
limite durável. A mensagem de resposta segue a retenção normal da conversa, e o
código deve ser tratado como credencial temporária.

A sessão tem 256 bits, expira em doze horas e usa cookie `HttpOnly`, `SameSite=Strict`
e `Secure` em HTTPS. O cookie não fica em `localStorage` nem na URL. Leituras são
`no-store`; alterações conferem origem e cabeçalho de mesma origem. Cada acesso
revalida associação ativa e papel. Revogar um integrante invalida também seu uso
do painel, sem esperar a expiração do cookie.

O painel não recebe chave de serviço, telefone do remetente, lista de telefones
da equipe ou identificadores pessoais dos autores das evidências. Os controles
de equipe continuam disponíveis pelo fluxo autenticado e pelos convites do WhatsApp.

## Regras operacionais

- A origem é uma **declaração do produtor**. Confirmação de gravação e confiança
  na interpretação não representam comprovação externa.
- Uma contagem é um retrato ao **fim do dia**. O saldo usa a última contagem e as
  movimentações de dias posteriores. Movimentos no mesmo dia de uma contagem
  exigem revisão da ordem temporal; não se soma algo possivelmente já contado.
- Uma nova contagem preserva as anteriores e não inventa compra, venda ou nascimento
  para explicar a diferença. Uma venda não gera receita ou recebimento automaticamente.
- Saídas e transferências exigem saldo conhecido. Inserções retroativas são
  verificadas contra a sequência posterior para impedir saldo negativo.
- A transferência entre lotes grava entrada e saída juntas e conserva o total.
  Para dividir/fundir lotes, informe a contagem inicial dos lotes e transfira as
  quantidades pertinentes. O destino não é considerado vazio sem uma declaração.
- A transferência entre propriedades usa o WhatsApp: **transferir 10 animais para
  fazenda Santa Rita em 2026-10-25**, a partir da fazenda de origem selecionada.
  Exige revisão, acesso de gestão nas duas propriedades, contagens anteriores e
  uma transação que grava os dois cadernos, os dois recibos de auditoria e a
  deduplicação. O código de um único painel não autoriza essa operação em outra fazenda.
- Correções de eventos referenciam o original, que permanece no histórico.
  Correções de pesagem preservam valor e origem anteriores. Não é permitido
  corrigir isoladamente uma ponta de transferência.
- Relatos naturais reconhecidos incluem nascimento, morte, compra/venda de animais,
  vacinação, vermifugação, tratamento, desmame, inseminação, pesagem e movimentação.
  Relatos de manejo não criam diagnósticos, doses, animais ou pesos não declarados.
- A gramática é conservadora e determinística, sem chamada adicional de IA.
  Frases não reconhecidas continuam nas notas/histórico e não são promovidas
  arbitrariamente a operações. Cadastros legados sem perfil/contagem operacional
  mantêm o caderno privado até a projeção de fatos ou um registro operacional explícito.
- Mais de uma propriedade sem referência inequívoca, datas como “semana passada”
  sem um dia e conflitos de saldo geram esclarecimento/revisão, não uma gravação
  definitiva. Perguntas, hipóteses, terceiros, encaminhamentos e conteúdo gerado
  de mídia não alteram o rebanho.
- O instante original recebido da Meta é preservado. “Ontem” não muda para outra
  data só porque um worker processou/repetiu a mensagem depois.
- Limpar o contexto da conversa não cria uma cópia da fazenda operacional. A
  identidade e os registros de gestão permanecem; origens antigas não podem
  repovoar a nova geração da memória privada. Havendo várias fazendas, uma nova
  contagem sem identificação vai para esclarecimento, sem criar uma terceira
  propriedade nem atualizar arbitrariamente a última selecionada.
- GMD usa pesagens não estimadas do mesmo animal, com fórmula e período. Taxas
  dependem de população exposta e cobertura do período; não são inferidas do número
  de fichas. Consumos medidos e estimados são somados separadamente, sem conversão
  implícita de matéria seca. Saldo financeiro não é chamado de lucro líquido.

Não há automação de unificação destrutiva de propriedades com identidades ou
censos conflitantes. Esses casos precisam ser identificados e conciliados pelo
responsável; a fila de revisão não descarta a origem nem “confirma” dados por IA.

## Banco de dados e implantação

Migrações novas, nesta ordem:

1. `20261027111123_guardian_farm_panel.sql`: identidade provisória compatível,
   vínculo e projeção dos perfis observados, backfill da geração ativa, códigos,
   sessões, idempotência web, limites e fila privada de revisão.
2. `20261027111135_guardian_reviews_rules.sql`: decisões administrativas auditadas,
   claims de regras por propriedade/integrante, fila com versão da origem e
   cancelamento de alertas quando a evidência muda.
3. `20261027111144_guardian_property_transfers.sql`: autorização e transação para
   transferências entre duas propriedades, com ordem de locks e controle de versão.

As tabelas novas têm RLS e nenhuma permissão direta para `anon`. Códigos, sessões,
pedidos, limites e RPCs operacionais ficam restritos a `service_role`. A revisão
tem leitura administrativa por RLS. Funções usam `SECURITY INVOKER` e `search_path`
fixo. Acesso administrativo é verificado no servidor em cada chamada; o navegador
não escolhe o telefone nem substitui a propriedade autorizada pelo cookie.

Nenhuma migração foi aplicada ao Supabase de produção nesta tarefa. Os ensaios
aplicam as migrações reais no PostgreSQL isolado do PGlite, com papéis, constraints,
RLS, funções e persistência em disco. A produção e o WhatsApp real dependem de
homologação com credenciais substituídas e configuradas de forma segura.

Para implantar: usar primeiro um projeto/branch de banco apropriado à homologação,
validar o backup/restauração do banco, aplicar as três migrações depois das já
existentes, executar a validação abaixo e testar o domínio HTTPS de preview.
Configurar `TPEC_GUARDIAN_ENABLED=true` somente após isso. O fluxo local segue
`npm ci --include=dev`, Node fixado pelo repositório e `npm run dev`.

Avisos automáticos também exigem `WHATSAPP_PROACTIVE_ENABLED=true`, consentimento
individual e os temas/horários autorizados. Fora da janela de 24 horas é necessário
`WHATSAPP_GUARDIAN_TEMPLATE_NAME` aprovado na Meta, com idioma correspondente.
Ativar regras no painel não concede consentimento de envio. Os alertas não fazem
chamadas generativas adicionais.

Para reverter a ativação, desativar a flag e voltar ao deploy anterior. Não apagar
tabelas novas nem remover fatos/recibos como rollback. Para reverter dados de uma
operação, usar correção auditável e revisar as duas pontas quando for transferência.
Os limites já existentes de snapshot e os novos limites de lote/histórico são
técnicos; não foram criados planos pagos ou limitações comerciais.

## Validação reproduzível

```bash
npm run audit:privileged
npm test
npm run lint
npm run build
```

Os testes novos cobrem a entrada espontânea, nome/UF ausentes, atualização sem
causa inventada, isolamento de produtores, persistência após reabrir o banco,
compatibilidade e backfill, código de uso único, expiração, limites, papéis e
revogação, CSRF, edição revisada, conflitos, replay, estoque negativo,
transferências atômicas, correções, datas originais, fórmulas, alertas e revisão.

O ensaio de navegador usa a página real, o handler HTTP real e um banco PostgreSQL
isolado com dados sintéticos. A fronteira HTTP é encaminhada para esse banco,
sem conectar Supabase ou WhatsApp de produção. Com Playwright/Chromium disponíveis:

```bash
# Primeiro, iniciar npm run dev em outra sessão.
PLAYWRIGHT_MODULE_PATH=/caminho/para/playwright-core/index.mjs \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/caminho/para/chromium \
node --experimental-strip-types scripts/check-farm-panel.mjs
```

Este ensaio verifica acesso público, código inválido, geração pelo handler do
WhatsApp, cookie, formulário, confirmação, gravação SQL, recarregamento, celular
e logout. A autenticação administrativa real e o webhook público da Meta ainda
precisam ser homologados no preview com as novas credenciais seguras.

## Publicação e dependências externas

Não houve deploy, publicação de domínio ou envio real de WhatsApp nesta tarefa.
Nenhuma chave colada na conversa foi gravada nos arquivos. As chaves privadas
expostas devem ser substituídas e os novos valores configurados no backend seguro.
Tarifas `COLOQUE_O_PRECO` não foram inventadas: valores desconhecidos continuam
explicitamente parciais nas métricas de custo existentes.

ABCZ permanece sem conector oficial ativo, pois não há documentação/autorização
vinculada. A interface e seus testes permitem integrar um provedor autorizado
posteriormente, sem raspar áreas protegidas ou tratar declarações como prova de
registro. A integração DuKamp continua somente leitura e depende dos bindings e
acessos já previstos pelo projeto.

## Resultado da validação desta entrega

| Verificação executada                          | Resultado                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                     | 820 testes passaram; zero falhas, cancelamentos ou testes ignorados.                                                                              |
| `npm run audit:privileged`                     | Passou.                                                                                                                                           |
| `npm run lint`                                 | Zero erros; os 11 avisos existentes foram preservados.                                                                                            |
| `npm run build`                                | Passou, incluindo typecheck, módulos administrativos e scan de segredos no bundle público.                                                        |
| Navegador Chromium + HTTP + PostgreSQL isolado | Passou: código inválido, entrada, edição revisada, persistência, recarregamento, celular e logout.                                                |
| Continuidade e isolamento SQL                  | Passaram: reabertura do banco, backfill, reset, múltiplas propriedades, revogação, replay, conflitos e rollback das duas pontas da transferência. |
| Inspeção de credenciais nos arquivos alterados | Nenhum valor de credencial encontrado.                                                                                                            |

As correções verificadas incluem a preservação do timestamp original do WhatsApp,
a ligação entre fatos privados e o caderno operacional, o reaproveitamento de
propriedades existentes após reset e a distinção entre contagens, movimentos e
cadastros individuais. O teste antigo do webhook foi atualizado para exigir
também o timestamp propagado; sua validação de remetente, mensagem e envio foi
mantida. Os problemas de formatação identificados durante a implementação foram
resolvidos antes da validação final.

Não foram alteradas Supabase Edge Functions. Foram estendidos os serviços
server-side da aplicação e a manutenção já chamada por
`src/lib/whatsapp/proactive.server.ts`; os novos alertas usam o mesmo ciclo de
autorização e entrega existente. Nenhum agendamento externo foi ativado no ambiente
de produção por esses testes.

## Branch e commits para revisão

Branch local: `feat/guardia-farm-panel`, a partir da base auditada acima.

- `b9c5c13`: gestão persistente, painel por código, interface, migrações e testes.
- `f1f0e44`: continuidade da identidade após reset e proteção de contagens ambíguas.

Os commits estão preparados localmente. A integração ao branch principal e a
publicação dependem da revisão e homologação descritas nesta documentação.

## Histórico de implantação conectada — 27/10/2026

As três migrações foram homologadas pelos 820 testes e aplicadas, na ordem documentada, ao projeto TPEC-IA `cawgzodelwchccilqeqr`. A conexão Supabase atribuiu as versões abaixo. Os arquivos e o helper de testes foram sincronizados com o histórico real, mantendo o SQL integralmente inalterado, para impedir reaplicação por uma futura execução de `db push`.

| Versão original de desenvolvimento | Versão registrada no Supabase | Migração |
| --- | --- | --- |
| 20261026210000 | 20261027111123 | guardian_farm_panel |
| 20261026213000 | 20261027111135 | guardian_reviews_rules |
| 20261026220000 | 20261027111144 | guardian_property_transfers |

A conferência posterior preservou os hashes dos animais, tarefas, lançamentos e registros do caderno anteriormente existente e as três observações originais. O backfill foi aplicado sem apagar registros. A publicação e a validação do endereço público são etapas separadas desta aplicação de esquema.
