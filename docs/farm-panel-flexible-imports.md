# Cadastro e documentos de animais; painel simplificado

O formulário usa série + RGN como identificação, ou brinco/registro informado para animais sem série. O código interno continua existindo para preservar fichas antigas e relações; não há mais um segundo campo obrigatório no cadastro.

A entrada “Importar animais de PDF ou Excel” abre a mesma preparação em lote usada na área de importações. Aceita documentos ABCZ e de terceiros, com um ou vários animais, PDFs digitais/digitalizados, imagens e planilhas XLSX/XLS/CSV/TSV. Certificados ABCZ são reconhecidos por página, inclusive em PDFs concatenados. Relatórios conhecidos e colunas reconhecidas usam leitura local; outros layouts usam os provedores multimodais já configurados. Na planilha desconhecida, a leitura é dividida em blocos de até 75 linhas, com origem e retomada durável. Páginas/trechos com falha são informados; registros parciais ou ambíguos continuam pendentes de revisão. Ascendentes não são cadastrados como animais do rebanho.

O WhatsApp responde ao receber o anexo para importação e também informa falhas de preparação, em vez de encerrar a mensagem em silêncio. PDFs sem legenda são inspecionados por conteúdo (até três páginas iniciais, com classificação multimodal para layouts desconhecidos/digitalizados); planilhas também podem ser identificadas pelo conteúdo. Um pedido explícito de cadastro importa o documento independentemente do nome ou layout. O destino e a permissão vêm sempre da sessão/associação autorizada, nunca do documento.

A gravação continua exigindo revisão e aprovação. Não é uma promessa de leitura infalível de qualquer arquivo: documentos ilegíveis/protegidos/corrompidos, campos ausentes, limites de volume ou provedores indisponíveis geram pendências e mensagens úteis. Limites atuais: 4 MB por envio no painel, 25 MB pelo WhatsApp, 100 páginas por PDF e 2.000 linhas por aba.

O painel usa cabeçalho verde, atalhos circulares e grupos de funções de manejo. “Equipe e acessos” fica em Mais, somente para o proprietário. Deslizes horizontais por toque ou arraste de mouse navegam entre Início, Rebanho, Tarefas, Finanças e Mais, sem capturar formulários, tabelas roláveis ou a rolagem vertical. Botões continuam disponíveis para teclado e tecnologias assistivas.

A foto é recortada e reencodificada no navegador como miniatura JPEG 192×192, sem metadados, até 12 mil caracteres. É salva no livro privado existente por `property_update`, com as mesmas permissões, concorrência, recibos e auditoria das demais alterações; não cria bucket público ou migração SQL. Proprietário e gerente podem trocar/remover a foto. Novos leitores preservam livros antigos sem foto. Ao reverter, preserve a leitura do campo opcional `photo` antes de voltar a um schema antigo estrito.

O Android 1.2.0 (código 6) acrescenta o seletor de documentos do sistema para fotos, PDFs e planilhas, com seleção múltipla quando solicitada. Apenas URIs `content` concedidas pelo seletor são entregues ao painel HTTPS; cancelamento devolve valor nulo. Acesso `file://` permanece desabilitado. É necessário distribuir o novo APK para esse seletor funcionar em instalações antigas.

## Validação

- `npm test`: regressões de cadastro, arquivos de terceiros, várias páginas/animais, Excel com várias abas/colunas desconhecidas, falhas parciais, autorização e persistência.
- `npm run build`, `npm run lint`, `npm run audit:privileged`.
- Com Vite em `127.0.0.1:8080`: `node --experimental-strip-types scripts/check-farm-panel-experience.mjs` usa Chromium e PostgreSQL isolado para conferir foto após reload, cadastro por série/RGN, equipe separada, layout móvel/desktop e gestos reais. A API de importação é simulada somente nesse teste de interface; os parsers e a persistência possuem testes separados.
- Android: `./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug`. Homologar o APK em aparelho físico, inclusive seletor, cancelamento, fotos e envio de PDF/Excel. Modelos reais precisam ser homologados com documentos autorizados em preview; testes com modelo injetado não comprovam extração real.
