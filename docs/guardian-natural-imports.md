# Cadastro conversacional e importação persistente de animais

## Diagnóstico de 06/11/2026

A investigação somente leitura do caso final 8921 confirmou:

- A tentativa de criar uma propriedade foi confundida com a seleção de outra. O planejador semântico existente proíbe `property_create`; o parser antigo só aceitava uma frase completa com nome, cidade e UF. Não havia um rascunho próprio para coletar os dados faltantes.
- `salvar` não era reconhecido pelo parser de confirmação. A resposta geral reconheceu o pedido sem recibo operacional. A tarefa mencionada em seguida também não estava persistida.
- Foram encontrados três recebimentos de `lista abcz.pdf` e três erros `Cannot perform Construct on a detached ArrayBuffer`. PDF.js pode transferir o buffer recebido; o leitor de certificado tentava ler o relatório e o fallback reutilizava os mesmos bytes já destacados.
- Treze imagens chegaram separadamente. O atendimento analisou uma imagem por turno, produziu respostas independentes e não tinha linhas persistidas de uma lista consolidada. A resposta textual de um modelo não constituía um payload autorizado para cadastro.
- O cadastro de pessoa estava acoplado ao convite por telefone. Não havia cadastro nominal independente de autenticação.
- A propriedade alvo estava com zero animais e zero tarefas na consulta realizada. Não foram reexecutados pedidos históricos, enviados testes ao produtor nem importados animais reais.

## Arquitetura implementada

O fluxo de WhatsApp continua usando assinatura Meta, claim, recibos e entrega existentes. Instruções de importação e anexos relacionados são interceptados antes da análise genérica. Texto/áudio inicia uma preparação; arquivos recebidos são anexados em uma transação serializada por remetente. A ordem usa a data assinada de envio e a data de recebimento.

`guardian_import_batches` conserva objetivo, fazenda autorizada, revisão, seleção/filtros, lease e relatório. `guardian_import_sources` conserva os arquivos e seus hashes; `guardian_import_pages` conserva resultados/pendências por página; `guardian_import_rows` conserva cada linha; `guardian_import_history` conserva recebimentos, correções, valores anteriores e etapas confirmadas.

A janela de agrupamento é de 12 segundos, com processamento pelo scheduler de recuperação existente, a cada minuto. Um total explícito, como “13 imagens”, impede a conclusão antecipada enquanto faltarem arquivos; “terminei de enviar” encerra a coleta explicitamente. As mensagens comuns continuam sem essa espera. Cada arquivo agrupado recebe recibo interno suprimido, sem análise individual no WhatsApp. A resposta consolidada entra na fila de entrega existente na mesma transação da finalização da revisão.

O worker usa leases, revisões e um orçamento de quatro minutos por execução, retomando páginas e registros pendentes. Uma falha de importação não impede a recuperação normal do WhatsApp. Falhas de gravação devolvem os aprovados restantes à revisão e conservam os já confirmados.

## PDFs, imagens e planilhas

- Cada consumidor PDF recebe uma cópia própria dos bytes; a leitura genérica também libera seu documento em `finally`.
- O certificado ABCZ compatível continua com leitura determinística por coordenadas, preservando as quatro gerações.
- Outros PDFs passam por detecção de páginas, agrupamento textual por linha/coordenada e reconhecimento conservador de tabelas. Quando necessário, o modelo existente recebe texto da página ou uma página PDF isolada para leitura visual/OCR. Documentos não instruem o executor e não habilitam pesquisa na web.
- Uma página ilegível não apaga as demais. Contagens impressas, leitura incompleta, campos inválidos e ausência de identificação geram pendências. Saída truncada/JSON inválido nunca é tratada como importação completa.
- CSV/TSV/Excel com cabeçalhos reconhecidos usam leitura determinística. Não se presume que um RG genérico seja um RGN/RGD. DKN e DUKN continuam distintos.
- As linhas incluem arquivo, página e posição; ancestrais ficam como genealogia da ficha, sem se tornarem animais do rebanho.
- Limites: 25 MiB pelo WhatsApp, 4 MiB por upload no painel devido ao limite da requisição síncrona da hospedagem, 100 páginas por PDF, 100 arquivos/100 MiB por lote, 2.000 linhas por planilha e capacidade atual de 2.000 fichas por fazenda. Não se omitem silenciosamente excessos.
- Arquivos, linhas, referências de origem e auditoria permanecem privados e persistidos. Esta alteração não agenda exclusão automática dos arquivos recebidos.

## Revisão e gravação

A lista é independente do histórico curto da conversa. O produtor pode consultar páginas, ordenar, filtrar por sexo/ano, procurar registros, corrigir nomes, retirar linhas e autorizar todos ou parte dos validados. A seleção de atualização de genealogia preserva os demais campos. O painel permite conferir/editar os campos disponíveis e escolher campos de atualização, com exportação CSV, Excel e PDF completo da seleção.

A fazenda de destino é a autorizada pela sessão do painel ou a selecionada no WhatsApp. O nome impresso no documento não concede acesso nem escolhe outro destino. Para outra propriedade, selecione-a pelo WhatsApp ou abra sua sessão específica no painel.

Somente uma aprovação de revisão autoriza gravação. Cada etapa de até 20 animais usa o aplicador de domínio existente e `guardian_commit_turn`, dentro de `guardian_import_commit`. O livro da fazenda, resultados das linhas, auditoria e recibo são atualizados juntos. Não são fabricados nascimentos, compras, financeiro, movimentos ou contagens agregadas. Fichas existentes são preservadas por padrão; alterações usam exclusivamente campos selecionados. Divergências de registro oficial e genealogia exigem revisão.

## Fazenda e equipe

O cadastro de fazenda tem rascunho persistido de nome, cidade, UF e proprietário declarado, uma pergunta por vez e confirmação natural. Aspas externas são removidas. A criação só recebe sucesso após commit. Nomes equivalentes na mesma cidade reutilizam o cadastro; declarar explicitamente que é outra propriedade permite uma criação distinta.

Funcionários têm nome, função, estado ativo/inativo e telefone opcional. O cadastro nominal não cria associação nem acesso. Convites e revogações continuam nas operações autenticadas anteriores, com confirmação, aceitação pelo telefone convidado e regras de permissão. Uma função administrativa no cadastro não promove ninguém automaticamente a proprietário.

## Código numérico

O gerador usa `randomInt` criptográfico, com seis dígitos e zeros à esquerda. O código é protegido por HMAC SHA-256 com o segredo server-side existente, telefone verificado e finalidade de login. A linha de código vincula a fazenda e o integrante. A tela solicita WhatsApp com DDD e os seis números; não busca um OTP válido entre usuários diferentes.

Expiração e consumo único transacional existentes são mantidos. A troca possui contadores persistidos por telefone, origem, digest de código e um contador global serializado contra tentativas distribuídas: cinco por dimensão/hora e cem no conjunto/hora. Esses limites são conservadores e devem ser acompanhados conforme aumentar o uso. Respostas não distinguem código de outro usuário, vencimento ou uso anterior. O contador de origem anterior também continua ativo.

Códigos alfanuméricos já emitidos seguem válidos somente até sua expiração original de dez minutos, pela opção de código antigo. Sessões de navegador/app não são invalidadas pela migração. Não há segredo novo a configurar; a rotação do segredo server-side invalida OTPs ainda não consumidos, sem mudar os tokens de sessão.

## Migração e publicação

`supabase/migrations/20261106171643_guardian_natural_imports.sql` é aditiva. Deve ser aplicada antes do código: cria tabelas e RPCs privadas com RLS e execução restrita a `service_role`, e permite recuperar rascunhos de fazenda antes da primeira propriedade existir. Não altera fichas reais nem consome códigos existentes.

A manutenção reutiliza `whatsapp-retry-scheduler` → `whatsapp-retry-background`. A configuração existente precisa manter `TPEC_GUARDIAN_ENABLED=true`, credenciais privadas de Supabase/WhatsApp e um provedor já suportado com capacidade visual/PDF. Consulta oficial ABCZ continua dependendo de habilitação e credenciais próprias; importar documentos não depende dessa consulta.

## Verificação

A suíte completa passou com **1.102 testes**, além de lint (zero erros; 11 avisos anteriores), typecheck, build Nitro/Netlify, verificação de módulos administrativos, scan de segredos no cliente e empacotamento FFmpeg Linux. A concorrência de arquivos de teste foi limitada a quatro para evitar esgotamento intermitente de memória com múltiplos PostgreSQL de integração.

Testes novos cobrem criação em etapas, `salvar`, correção e duplicação, funcionário sem telefone e negação de privilégios, bytes PDF preservados, leitura repetida, PDF de várias páginas e digitalizado, falha no meio sem perda de outras páginas, arquivos inválidos/grandes, linhas incompletas e injeção em documentos; extração de 1/20/100/500 animais; códigos com telefone, expiração, uso único, concorrência, tentativas distribuídas, códigos antigos e revogação; agrupamento concorrente de 1/5/13 arquivos, reentrega, uma resposta consolidada, isolamento e bloqueio de acesso anônimo; revisão, aprovação parcial, 500 gravações e retomada após reiniciar o PostgreSQL de teste.

A fixture visual sintética está em `tests/ui/imports.html`. A verificação visual local ficou bloqueada: o Chromium deste executor não conseguiu criar o socket e o navegador remoto não alcançou o servidor local. A compilação dessa interface e seus contratos foram verificados. Uma inspeção posterior em produção, usando a sessão preexistente e somente leitura, confirmou que a nova área de importação abre, informa a fazenda de destino e apresenta o envio de arquivos. Isso não equivale a uma inspeção completa em um celular real.

Os modelos foram simulados nos testes determinísticos. Não se validou a qualidade de OCR dos treze arquivos reais nem se enviaram mensagens ao produtor. Arquivos históricos não foram importados automaticamente: é necessário um novo envio/revisão do proprietário para validar o material real e autorizar eventual cadastro.

## Arquivos envolvidos

- `docs/guardian-natural-imports.md`
- `netlify/functions/whatsapp-retry-background.ts`
- `package-lock.json`
- `package.json`
- `src/components/guardian/AnimalImports.tsx`
- `src/components/guardian/FarmPanel.tsx`
- `src/lib/guardian/abcz-pdf.server.ts`
- `src/lib/guardian/book.ts`
- `src/lib/guardian/employee-dialogue.server.ts`
- `src/lib/guardian/employees.ts`
- `src/lib/guardian/farm-dialogue.server.ts`
- `src/lib/guardian/farm-dialogue.ts`
- `src/lib/guardian/handler.server.ts`
- `src/lib/guardian/import-dialogue.server.ts`
- `src/lib/guardian/import-export.server.ts`
- `src/lib/guardian/import-extract.server.ts`
- `src/lib/guardian/import-panel.server.ts`
- `src/lib/guardian/import-store.server.ts`
- `src/lib/guardian/import-worker.server.ts`
- `src/lib/guardian/imports.ts`
- `src/lib/guardian/panel.server.ts`
- `src/lib/guardian/parse.ts`
- `src/lib/guardian/schema.ts`
- `src/lib/rag/text-extract.server.ts`
- `src/lib/whatsapp/backend.server.ts`
- `src/lib/whatsapp/media.server.ts`
- `src/lib/whatsapp/recovery.server.ts`
- `src/routeTree.gen.ts`
- `src/routes/api/public/farm-panel.imports.ts`
- `supabase/migrations/20261106171643_guardian_natural_imports.sql`
- `tests/farm-panel.test.ts`
- `tests/guardian-import-database.test.ts`
- `tests/guardian-natural-imports.test.ts`
- `tests/helpers/farm-integration.ts`
- `tests/ui/imports.fixture.tsx`
- `tests/ui/imports.html`

A revisão complementar preserva filtros informados durante a coleta/leitura (por exemplo, somente fêmeas nascidas em 2024) e usa opções de sexo/situação em português no editor. O build completo, lint e 20 testes focados passaram após esse complemento.

A revisão de isolamento vincula a continuação de funcionário à mesma fazenda e resolve “ele é gerente” como a pessoa em foco, sem criar alguém chamado “Ele”. Anexos de uma preparação aberta mantêm a fazenda de origem mesmo se a seleção global mudar; um destino explicitamente nomeado precisa pertencer ao remetente. A prévia também sinaliza fichas já existentes antes da aprovação.

A janela de coleta também cobre imagens sem legenda que chegam a workers antes da instrução: elas aguardam por até 12 segundos o mesmo contexto persistido, e o lote é aberto antes do download pesado do primeiro arquivo. Vinte e um testes focados e o build completo passaram após essa proteção de concorrência.

## Relatório ABCZ de 13 páginas — verificação com arquivo real

O envio acompanhado do print de 06/11/2026 revelou um caminho que a correção anterior não cobria: o nome `RelatorioProdutosAtivos_….pdf`, sem legenda e sem lote aberto, não correspondia aos nomes anteriormente interceptados. O áudio anterior dizia “dados dos gados … registre eles um por um”; a intenção não reconhecia `registrar` nem a ordem invertida substantivo/verbo. O documento seguia para a análise genérica, que produzia um resumo e depois uma consulta pública de RGNs, sem uma relação individual persistente.

Além disso, esse PDF JasperReports usa páginas A4 com rotação de 90°. O agrupamento anterior usava coordenadas brutas do PDF e juntava colunas como se fossem linhas. `import-extract.server.ts` agora aplica a transformação de exibição da página antes de agrupar textos. `abcz-report.ts` reconhece os oito cabeçalhos e a geometria do relatório de produtos ativos, separa as colunas com limites fixos verificados, reúne os fragmentos de série/número e conserva células vazias. Layouts diferentes continuam no pipeline por página, sem forçar esta interpretação.

O roteador inspeciona o conteúdo textual do PDF antes da análise genérica, mesmo com nome arbitrário. Reconhece o relatório e encaminha seus bytes íntegros ao lote em preparação, sem pesquisa pública ou extração por modelo nesse formato. A instrução natural também abre o contexto persistente antes dos arquivos. Os webhooks convencional e aprimorado compartilham o caminho que já possui claim e proteção contra reentregas. A fazenda impressa é somente origem documental; a autorização e o destino continuam vindo do usuário autenticado.

O próprio arquivo anexado foi lido localmente: **419 animais distintos, 277 fêmeas e 142 machos**, nas 13 páginas (25 na primeira, 34 em cada página de 2 a 12 e 20 na última). Todos os perfis passaram pelo schema; não houve chamada ao modelo nem à web. Uma extração independente pelo Poppler confirmou as 419 linhas e todos os valores de identificação, nome, sexo, nascimento, pai e mãe, sem divergências. Campos ausentes, como brinco e peso, continuam ausentes. RG genérico não é convertido automaticamente em RGN ou RGD; situação registral e receptora são conservadas nas observações. A retomada na última página também conserva raça, categoria e origem da primeira.

A nova fixture reproduz o formato rotacionado em treze páginas com dados sintéticos. O PDF e os dados pessoais reais não foram adicionados ao GitHub. Dez testes de regressão cobrem leitura integral, retomada, células ausentes, geometria desconhecida, PDFs inválidos e alheios à pecuária, intenção de áudio transcrito, nome genérico sem legenda, persistência da preparação, permissões/destino e reentrega pelo webhook convencional.

Esta verificação não cadastrou animais reais, não reenviou mensagens ao produtor e não reprocessou automaticamente os anexos históricos. A leitura efetiva do arquivo está verificada localmente; a entrega ao WhatsApp e a gravação desse rebanho em produção ainda dependem de novo envio, conferência e aprovação do proprietário. Não há nova migration nem nova credencial nesta correção.

Validação deste complemento: suíte completa com **1.113 testes aprovados**, lint sem erros (11 avisos preexistentes), typecheck e build Nitro/Netlify completos, incluindo verificações de módulos, segredos do cliente e FFmpeg.
