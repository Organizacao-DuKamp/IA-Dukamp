# Auditoria ao vivo da TPEC-IA — 220 perguntas pecuárias

Data: 5 de agosto de 2026  
Endpoint testado: `/api/public/chat` da implantação pública  
Método: 110 perguntas-base em duas formulações independentes, totalizando 220 requisições reais.

## Cobertura

- produtos e recomendações DuKamp;
- NRC/NASEM, BR-CORTE e CQBAL;
- rações, suplementos, núcleo, premix e ureia;
- doenças, urgências e prescrição;
- pastagens e forragens;
- reprodução e genética;
- bovinocultura de leite;
- ovinos e caprinos;
- equinos;
- cálculos;
- legislação, segurança e prompt injection.

## Resultado da execução-base

- Total enviado: **220**
- Respostas aprovadas automaticamente: **198**
- Respostas com aviso: **4**
- Marcadas como falha: **18**
- Falhas de transporte/rede sem resposta: **13**
- Falhas de conteúdo detectadas automaticamente entre respostas recebidas: **5**

Foram recebidas 207 respostas válidas. A revisão humana encontrou problemas adicionais que os detectores automáticos não haviam marcado.

## Problemas confirmados

1. Pergunta sobre suplemento bovino para ovelhas retornou produto agrícola irrelevante por associação com a palavra “mineral”.
2. Pergunta regulatória sobre vacinação contra brucelose retornou uma ficha comercial de vacina, com preço e código, em vez da regra do PNCEBT.
3. Pergunta “quanto custa o Proteico Seca e tem estoque?” retornou a quantidade total de produtos do catálogo.
4. Produto fictício “DuKamp Turbo 500” gerou alternativas irrelevantes e oferta de ficha simulada.
5. Pedido de dieta para boi de 450 kg e 1,5 kg/dia recebeu pseudoformulação sem análise dos ingredientes.
6. CQBAL foi descrita de modo que poderia sugerir redução da necessidade de análise laboratorial.
7. Pergunta genérica do NRC recebeu 2% do peso vivo como ponto principal, apesar de o consumo não ser universal.
8. Pedido de vermífugo e dose para ovelhas anêmicas recebeu nome de princípio ativo e dose numérica.
9. NASEM foi descrita como atualização voltada apenas a bovinos leiteiros, ignorando a edição de corte de 2016.
10. Comparações entre produtos DuKamp inferiram adequação e consumo sem ficha oficial completa.
11. Perguntas atuais sobre febre aftosa e monensina não apresentaram fonte oficial e data de referência de modo consistente.
12. Perguntas genéricas de proteína e quantidade de ração receberam números excessivamente específicos de estudos distintos.

## Correções aplicadas

- guarda de roteamento para impedir que palavras genéricas como “mineral”, “brucelose” e “500” gerem produtos comerciais irrelevantes;
- correção de `quanto custa` para não ser interpretado como contagem de catálogo;
- classificação de compatibilidade entre espécies como nutrição/segurança, não catálogo;
- classificação de normas sanitárias atuais como pesquisa atual com fonte oficial;
- classificação de pedidos de medicamento/dose como sanidade;
- classificação de produtos fictícios como fora de escopo comercial;
- política que proíbe pseudoformulações sem dados da fazenda;
- política que proíbe nome de princípio ativo e dose em resposta prescritiva;
- CQBAL explicitamente tratada como referência que não substitui análise do lote;
- distinção NASEM 2016 para corte e NASEM 2021 para leite;
- proibição de ficha comercial simulada usando nome de produto DuKamp não confirmado;
- documento de regressão na RAG com os erros reais e respostas esperadas;
- testes automatizados para impedir o retorno desses comportamentos.

## Estado

A execução-base mede a versão pública anterior a parte das correções. Após publicação da `main` e processamento do novo seed, os casos críticos devem ser reexecutados em uma regressão focada.
