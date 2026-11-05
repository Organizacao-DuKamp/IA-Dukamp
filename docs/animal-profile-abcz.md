# Ficha individual e consulta ABCZ

A ficha compartilhada entre o painel web, o Android e os registros da Guardiã contém identificação, nome, nascimento, brinco, brinco eletrônico, registro, série ABCZ, RGN, RGD, raça, pelagem, categoria, sexo, status, lote, responsável, pasto, piquete/curral, origem, destino, entrada, desmame, peso de entrada, peso atual, consumo diário, valores de compra/venda, vendedor, carcaça, parentesco, pai, mãe e observações. As propriedades novas são opcionais: fichas antigas continuam válidas e atualizações parciais preservam os demais dados.

O peso atual informado na ficha alimenta também o histórico de pesagens. Reenviar o mesmo peso não cria outra pesagem; corrigir o peso no mesmo dia preserva o valor anterior e a origem da correção. Valores de compra/venda na ficha não comprovam pagamento/recebimento e não criam lançamentos financeiros ou entradas no rebanho.

## Fluxo do produtor

1. Em Rebanho e lotes → Gerenciar → Cadastrar animal, informe a identificação local.
2. Para consultar a associação, use **Série + RGN**, inclusive a grafia combinada `DKN 404`. RGN numérico isolado não é uma identificação única. O código local da fazenda pode ser diferente do registro.
3. A alternativa **RGD** exige raça (sigla ABCZ), categoria/grau de sangue, sexo e RGD. Não se deduz raça a partir da série.
4. **Buscar na ABCZ** mostra os campos encontrados. Campos já preenchidos ficam desmarcados; o usuário escolhe explicitamente o que substituir. A busca não grava uma ficha, não cadastra os pais como animais da fazenda e não altera o rebanho.
5. **Aplicar campos selecionados** preenche o formulário. **Revisar antes de salvar** mostra a proposta com todos os campos, antes da confirmação existente no painel.
6. A ficha expandida e a exportação CSV incluem os campos novos e a genealogia disponível. Os campos financeiros, de manejo, peso e localização não são inventados a partir do registro genealógico.

O botão **Carregar ficha existente** preenche com dados do animal na própria fazenda, respeitando a sessão do produtor. Apagar um campo opcional gera uma limpeza explícita na proposta de revisão, sem apagar a identificação, o sexo ou o histórico de pesagens; deixar o peso atual em branco apenas evita uma nova pesagem. Campos não alterados continuam preservados. Pai e mãe podem ser informados manualmente ou selecionados pelos códigos já cadastrados. Alterar um pai/mãe remove da proposta os ascendentes importados daquele ramo, evitando genealogia contraditória.

## Serviço oficial e ativação

O serviço de produção documentado pela ABCZ é SOAP 1.1 em:

`https://www.abczstat.com.br/softwareterceiros/eletro.asmx`

Esta implementação usa a operação autenticada **`PesquisarGenealogia`**, cujo WSDL exige `criador_codigo`, `login`, `senha`, a identificação do animal e `software`. O resultado `AnimaisComGenealogia` distingue os animais pesquisados dos ascendentes. A disponibilidade do método para a TPEC-IA e o alcance dos registros acessíveis precisam ser homologados com a ABCZ.

Os métodos `_GEN` e `PesquisarAnimalQualquerChaveComplementar` não são chamados pelo provedor: checagens de acesso sem código autorizado retornaram **MÉTODO EXCLUSIVO DO SISTEMA PRODUZ**. Esse retorno é tratado como bloqueio de acesso, nunca como inexistência do animal. O parser mantém compatibilidade com respostas complementares para validação do protocolo; isso não habilita um método restrito. Não se utiliza o identificador de outro produto para contornar a restrição.

Configure no projeto **tpec-ia** da Netlify, escopo **Functions**, contexto **Production**:

- **ABCZ_SOFTWARE_ID**: código de software atribuído/autorizado pela ABCZ à TPEC-IA.
- **ABCZ_FARM_CREDENTIALS_JSON**: segredo JSON indexado pelo UUID da fazenda do painel. Cada valor contém `creatorCode` (inteiro positivo), `login` e `password` da conta autorizada pelo criador para aquela propriedade. Exemplo de estrutura, com marcadores que devem ser substituídos: `{"UUID_DA_FAZENDA":{"creatorCode":123,"login":"LOGIN_AUTORIZADO","password":"SEGREDO_DA_CONTA"}}`.

Não há código padrão ou credencial compartilhada automaticamente entre fazendas. Só vincule uma conta a uma propriedade com autorização do respectivo criador; o código local do animal não identifica a conta ABCZ. Proprietários, gerentes e técnicos com acesso à fazenda podem consultar; o perfil de trabalhador não usa a conta externa. Não envie senhas no chat nem as registre no repositório, logs, variáveis `VITE_` ou APK. Cadastre-as diretamente como segredo no ambiente do servidor.

Incluir **Deploy Previews** somente se esse acesso também estiver autorizado para testes. Depois de alterar a configuração, publicar um novo deploy. A interface e o serviço são web: esta mudança de ficha não exige recompilar o Android.

Sem código de software válido e conta vinculada à fazenda da sessão, a ficha completa e o preenchimento local funcionam, e o aplicativo apresenta **consulta automática aguardando habilitação** com acesso ao portal público. A consulta externa fica desativada; não se afirma que houve uma consulta bem-sucedida. A homologação de produção depende da associação aceitar o código, as credenciais e o registro consultado. Nenhuma credencial real está incluída no repositório.

Este recurso apenas consulta: não transmite nascimentos/comunicações à ABCZ nem emite certificados.

## Contrato e segurança

- `GET /api/public/farm-panel/animal-registry`: disponibilidade da conexão após autenticar a sessão.
- `POST /api/public/farm-panel/animal-registry`: consulta com a sessão do painel, incluindo separação entre cookies de navegador e app instalado, reautorização, Origin exata, cabeçalho do painel e limite persistente de 20 consultas por minuto por integrante/fazenda.
- A fazenda e as permissões vêm exclusivamente da sessão. O cliente não escolhe um ID de fazenda, endpoint externo ou código de software. O endpoint e o namespace SOAP são fixos e usam HTTPS de produção.
- XML de resposta limitado a 2 MiB, profundidade e quantidade de tags limitadas, DTD/entidades externas rejeitadas e entidades personalizadas desativadas. Não há interpretação de instruções nos dados externos.
- Nome, sexo, nascimento, registro, raça, categoria, pelagem e parentesco são preenchidos somente quando a ABCZ os retorna. A correspondência é conferida no animal principal, nunca apenas em um ancestral ou vizinho. Resultados ambíguos são rejeitados.
- A ficha comporta até quatro gerações (30 ascendentes), com proteção contra ciclos. A consulta importa somente os parentes que a fonte devolver, incluindo nomes/datas/identificações disponíveis. Avós não são inventados nem se criam animais ou transações adicionais.
- Respostas privadas sem cache, erros públicos sem XML/credenciais e timeout de 10 segundos. Indisponibilidade, acesso negado e falta de resultado não significam inexistência do animal.
- A ficha armazena dados declarados/importados, não uma certificação oficial. Editar os campos não preserva uma falsa marca de certificação.

## Validação

`tests/guardian-animal-profile.test.ts` cobre todos os campos, compatibilidade de fichas antigas, revisão, exportação, centavos/decimais/zeros, histórico de pesos, correções, datas/limites e persistência real no PostgreSQL de integração.

`tests/guardian-abcz.test.ts` usa respostas sintéticas baseadas no WSDL oficial para testar a herança dos dados complementares, normalização de série/RGN e RGD, correspondência exata, genealogia, ciclos, ambiguidade, XML malicioso/oversize, falta de habilitação, método exclusivo do PRODUZ, acesso negado, sessão revogada, CSRF, limites e isolamento entre navegador/app. Os testes automatizados não usam um código de software real nem fazem consultas em nome de terceiros. As checagens diagnósticas de acesso sem código autorizado não substituem a homologação: a consulta real com autorização da TPEC-IA precisa ser verificada após a ABCZ liberar o acesso.

## Referências oficiais consultadas

- [Consulta pública da ABCZ](https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais)
- [Contrato WSDL de produção](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?WSDL)
- [PesquisarAnimalQualquerChaveComplementar](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?op=PesquisarAnimalQualquerChaveComplementar)
- [PesquisarGenealogia](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?op=PesquisarGenealogia)

## Importação de certificado PDF ABCZ

Em **Rebanho e lotes → Gerenciar → Cadastrar animal → Importar ficha ABCZ**, escolha um PDF digital de até 5 MiB. Funciona sem credenciais ABCZ, para proprietários, gerentes e técnicos autenticados. O upload usa o mesmo endpoint, autorização, proteção CSRF e limite persistente da consulta, com `Content-Type: application/pdf`; a fazenda vem da sessão. A leitura não grava nada e o arquivo não é retido nem enviado a serviços de IA.

O formato validado é o certificado digital de **Registro Genealógico de Nascimento**, uma página horizontal de 842 × 595 pontos, com colunas de quatro gerações. Foram conferidos visualmente o PDF fornecido, as posições de todos os parentes e as duas células vazias do ramo paterno. Seu registro é DUKN 340; há 28 ascendentes (30 posições possíveis). Um mesmo ancestral pode aparecer em caminhos diferentes; os caminhos `sire.dam.sire` etc. preservam cada vínculo. O extrator usa posições, nunca a sequência corrida do texto. Modelos diferentes, digitalizações sem texto, certificados RGD, células incompletas e layouts não reconhecidos são rejeitados com orientação para preenchimento manual. Não há OCR nem inferência de conteúdo ausente.

Nome, registro, série, RGN, raça, categoria, nascimento, pelagem, sexo, observações e genealogia disponíveis são apresentados para seleção e revisão. O PDF de exemplo não contém RGD: ele fica ausente. Identificações dos ancestrais são conservadas literalmente, sem tentar decompor códigos antigos em série/RGN/RGD. Proprietário, fazenda, município, UF, criador e fonte ficam em campos opcionais `documentOwner`, `documentFarm`, `documentMunicipality`, `documentState`, `documentBreeder`, `documentSource`, explicitamente rotulados **(documento)**. Não alteram cadastro, localização, responsável ou propriedade atual.

Campos já preenchidos começam desmarcados. Havendo ficha com o mesmo código ou série + RGN, a revisão pede carregar essa ficha antes de aplicar os campos; seu código local é preservado. O servidor rejeita uma segunda ficha com a mesma série + RGN. DKN e DUKN são séries distintas. A aplicação da genealogia exige pais correspondentes; editar um pai depois continua removendo seu ramo importado. Ancestrais nunca são cadastrados como integrantes do rebanho, e não há movimentações de estoque/financeiro.

`tests/guardian-abcz-pdf.test.ts` verifica o layout real com dados pessoais substituídos, leitura de PDF sintético completo, 28 caminhos, repetição de ancestral em ramos diferentes, células vazias, quatro gerações na persistência, preservação de manejo, duplicatas, sessão navegador/app, CSRF, permissão, limite de upload e ausência de gravação na extração. O PDF original foi usado localmente e não foi incluído no repositório.

## Viabilidade da consulta pública (05/11/2026)

A página oficial pública informa série + RGN e renderiza um formulário POST para `/produtos-e-servicos/consulta-publica-de-animais-ajax`, tipo `identificacao-unica`. Há reCAPTCHA em cada formulário e o botão Buscar inicia desabilitado. Isso exige interação legítima com a página; não foi implementada resolução automática ou contorno do desafio.

Foram examinados o HTML público e os formatos DKN 401 / DUKN 401. As tentativas HTTP sem desafio resolvido não produziram resultado válido neste ambiente. Portanto **a raspagem e os dois animais permanecem não validados**; timeout/bloqueio não significa animal inexistente. Não se deve converter DKN em DUKN automaticamente nem habilitar scraping em produção com base nisso. O fluxo suportado é abrir a consulta pública manualmente, obter o certificado e importar o PDF compatível; a integração autenticada continua dependendo da homologação ABCZ.
