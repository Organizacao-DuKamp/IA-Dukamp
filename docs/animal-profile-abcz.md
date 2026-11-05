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

Esta implementação usa as operações documentadas `PesquisarAnimalSUI_GEN` e `PesquisarAnimalRGD_GEN`. Ambas recebem o parâmetro `software`. Configure **ABCZ_SOFTWARE_ID** com o código atribuído/autorizado pela ABCZ para a TPEC-IA. Não há código padrão, código de outro software ou fallback que simule autorização.

Na Netlify, cadastrar a variável no projeto **tpec-ia**, escopo **Functions**, contexto **Production**; incluir **Deploy Previews** somente se esse acesso também estiver autorizado para testes. Depois, publicar um novo deploy. Não colocar essa configuração em variável `VITE_` nem no APK. A interface e o serviço são web: esta mudança de ficha não exige recompilar o Android.

Sem um código válido configurado, a ficha completa e o preenchimento local funcionam, e o aplicativo apresenta **consulta automática aguardando habilitação** com acesso ao portal público. A consulta externa fica desativada; não se afirma que houve uma consulta bem-sucedida. A homologação de produção depende da associação aceitar o código e autorizar os registros consultados. O código precisa ser obtido com a ABCZ; não está incluído no repositório.

As operações autenticadas por criador, como `PesquisarGenealogia` (login, senha e criador), são outro contrato e não são chamadas com uma credencial global para todas as fazendas. Este recurso não transmite nascimentos/comunicações à ABCZ nem emite certificados.

## Contrato e segurança

- `GET /api/public/farm-panel/animal-registry`: disponibilidade da conexão após autenticar a sessão.
- `POST /api/public/farm-panel/animal-registry`: consulta com a sessão do painel, incluindo separação entre cookies de navegador e app instalado, reautorização, Origin exata, cabeçalho do painel e limite persistente de 20 consultas por minuto por integrante/fazenda.
- A fazenda e as permissões vêm exclusivamente da sessão. O cliente não escolhe um ID de fazenda, endpoint externo ou código de software. O endpoint e o namespace SOAP são fixos e usam HTTPS de produção.
- XML de resposta limitado a 2 MiB, profundidade e quantidade de tags limitadas, DTD/entidades externas rejeitadas e entidades personalizadas desativadas. Não há interpretação de instruções nos dados externos.
- Nome, sexo, nascimento, registro, raça, categoria, pelagem e parentesco são preenchidos somente quando a ABCZ os retorna. A correspondência é conferida no animal principal, nunca apenas em um ancestral ou vizinho. Resultados ambíguos são rejeitados.
- Genealogia limitada a três gerações (até 14 ascendentes), com resolução de referências, proteção contra ciclos e sem criar animais ou transações adicionais.
- Respostas privadas sem cache, erros públicos sem XML/credenciais e timeout de 10 segundos. Indisponibilidade, acesso negado e falta de resultado não significam inexistência do animal.
- A ficha armazena dados declarados/importados, não uma certificação oficial. Editar os campos não preserva uma falsa marca de certificação.

## Validação

`tests/guardian-animal-profile.test.ts` cobre todos os campos, compatibilidade de fichas antigas, revisão, exportação, centavos/decimais/zeros, histórico de pesos, correções, datas/limites e persistência real no PostgreSQL de integração.

`tests/guardian-abcz.test.ts` usa respostas sintéticas baseadas no WSDL oficial para testar normalização de série/RGN e RGD, correspondência exata, genealogia, ciclos, ambiguidade, XML malicioso/oversize, falta de habilitação, acesso negado, sessão revogada, CSRF, limites e isolamento entre navegador/app. Esses testes não usam um código de software real nem fazem consultas em nome de terceiros. A verificação ao vivo deve ocorrer após a ABCZ liberar o acesso.

## Referências oficiais consultadas

- [Consulta pública da ABCZ](https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais)
- [Contrato WSDL de produção](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?WSDL)
- [PesquisarAnimalSUI_GEN](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?op=PesquisarAnimalSUI_GEN)
- [PesquisarAnimalRGD_GEN](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?op=PesquisarAnimalRGD_GEN)
- [PesquisarGenealogia](https://www.abczstat.com.br/softwareterceiros/eletro.asmx?op=PesquisarGenealogia)
