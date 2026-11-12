# Navegação fluida e quadro de piquetes

O recebimento de documentos responde: “Entendido! Já estou preparando os animais no painel. Pode aguardar — aviso quando terminar.” É uma confirmação de recebimento/leitura. As etapas de conferência, aprovação e gravação continuam iguais, com os avisos de término existentes.

As áreas principais já visitadas permanecem montadas e ocultas com `hidden`. O conteúdo usa `memo` com callbacks estáveis e é descartado no logout/troca de acesso. Respostas com a mesma propriedade e versão preservam a referência do livro, mas atualizam equipe e demais dados da resposta. Alterações de versão atualizam as projeções. A navegação usa rolagem instantânea; só os atalhos circulares animam, por 220 ms, ao aparecer. Movimento reduzido desativa essas animações.

Toque horizontal reconhece a intenção antes de trocar de área; o gesto não captura carrosséis, controles, tabelas horizontais, pinch zoom ou rolagem vertical. Mouse usa o mesmo limiar de direção. A API e a fila de cookies não participam da troca de abas. Importação e áreas secundárias continuam montadas somente quando abertas para não manter consultas periódicas desnecessárias.

O custo anterior vinha especialmente das fichas, genealogias e pesagens de todos os animais montadas mesmo com `<details>` fechado. Agora, lotes abrem até 20 fichas por vez, e a ficha completa/genealogia só é montada ao selecionar o animal. A busca inclui fichas arquivadas e permite acessar registros sem lote. Pesagens, tarefas e lançamentos têm carregamento progressivo sem alterar os totais do livro. Os três indicadores do rebanho não precisam percorrer todas as pesagens individuais.

O novo quadro é uma projeção somente leitura do livro completo. Usa `herdLocationReport` para a localização atual, incluindo transferências já realizadas; usa os vínculos explícitos de `operations.lots[].pasture` e, na ausência deles, um vínculo não ambíguo do cadastro de pastagens. Não deduz a localização de todo um lote pela ficha de um único animal, não soma fichas aos censos/grupos e não converte saldo desconhecido em zero. Piquetes sem lotes, lotes sem piquete e grupos sem identificação continuam visíveis. Dados históricos não são apagados; os blocos antigos saem da apresentação do painel.

## Verificação

- `node --test --experimental-strip-types tests/guardian-paddock-board.test.ts` cobre vínculos, transferências, locais desconhecidos, ausência de duplicidade e compatibilidade dos indicadores com os cálculos existentes.
- `scripts/check-farm-panel-experience.mjs` usa Chromium e PostgreSQL isolado, 1.999 animais e 39.980 pesagens. Confere círculos/dialogs, expansão de lotes, ficha sob demanda, carrossel, rolagem vertical, gesto entre áreas, retenção do DOM e movimento reduzido, além dos fluxos de cadastro/foto/importação anteriores.
- `FARM_PANEL_TEST_ORIGIN` seleciona o endereço do frontend a testar; `FARM_PANEL_CPU_RATE=4` simula CPU quatro vezes mais lenta. Os tempos de navegação são registrados no console. Comparações de desempenho devem usar o bundle de produção; desenvolvimento inclui custos adicionais de validação React/HMR.
- `npm run test:panel-access` verifica primeira entrada, logout, links e recarga com PostgreSQL isolado. `npm run build` e `npm run lint` validam empacotamento e tipos.

Não há migração SQL, alteração de provedor de IA, nova permissão nem alteração nativa do APK. O app Android usa o mesmo painel web.
