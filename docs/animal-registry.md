# Identificação de bovinos por registro

A intenção `animal_registry` reconhece série + número (`GTRT 2551`, `GTRT-2551`,
`gtrt2551`) e ativa pesquisa externa no mesmo turno. O catálogo comercial e o
RAG de nutrição não substituem evidência de identificação individual.

A pesquisa usa os provedores já configurados: OpenAI com Web Search obrigatório
no fluxo legado; Perplexity com alternativa compatível no modo multimodelo.
Não há nova chave, migração, API ABCZ contratada nem automação de formulário.
Prioridade: consulta pública/publicações ABCZ/PMGZ, associação de raça, criatório,
central genética e catálogo de leilão. Login/CAPTCHA e divulgação restrita não
são contornados. Um registro não indexado pode exigir certificado ou foto.

O plano procura grafias alternativas e exige correspondência exata na ficha do
animal, evitando confundir registros de ancestrais. A série não codifica raça.
Fontes históricas podem confirmar identidade, mas não proprietário ou avaliação
atual. Código incompleto gera pedido de série e número; RGD antigo exige também
raça, sexo e categoria. Continuações de raça, sexo, nome e genealogia preservam
o registro sem pesquisar catálogo nem herdar o alvo em outro assunto.

Identificações afirmativas devem conservar o código e pelo menos um link
retornado nas citações do provedor. A formatação do WhatsApp conserva essas
fontes. O guard valida formato/atribuição; a interpretação do conteúdo da fonte
continua sendo responsabilidade do modelo, não uma verificação independente
de todo o registro. Há uma correção limitada e resposta segura se persistir
ambiguidade/falta de fonte ou ocorrer indisponibilidade.

## Caso de referência

`GTRT 2551` aparece como **Mufla FIV de Tabapuã**, fêmea da raça **Tabapuã**,
na publicação do próprio criatório sobre a exposição de Cascavel em novembro
de 2011. Esse fato não é hardcoded na resposta e não se generaliza a outros
números da série GTRT:

- https://aguamilagrosa.com.br/noticias/touros-da-gua-milagrosa-o-grande-campeo-e-o-reservado-grande-campeo-da-exposio-de-cascavel-pr/
- https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais

`tests/animal-registry.test.ts` cobre formatos, continuação, falsos positivos,
fontes, ausência/ambiguidade e chamadas simuladas OpenAI/Perplexity. A matriz
`tests/evals/animal-registry-cases.ts` cobre intenções sem gastar créditos.
Esses testes não comprovam a disponibilidade das APIs/qualidade do lookup em
produção; validar após deploy com GTRT 2551, outro registro conhecido e um
registro sem publicação, incluindo WhatsApp e continuações.
