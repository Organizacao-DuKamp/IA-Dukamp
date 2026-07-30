## Diagnóstico da arquitetura atual

O que existe hoje:

- `market_quotes` guarda cotações genéricas (produto, praça, unidade, data, fonte). Serve para grãos, câmbio e boi, tudo no mesmo formato.
- `src/lib/market/market.server.ts` reconhece o produto por regex (`TARGETS`), detecta cidade por uma lista fixa de ~40 municípios com lat/lon e escolhe a praça mais próxima por distância em linha reta (`getSeriesNearest`).
- `src/lib/chat/query-router.server.ts` chama `marketAnswer()` antes de tudo; se houver bloco de mercado, devolve como contexto para o modelo.
- Coletores automáticos existentes: apenas Banco Central (dólar PTAX, Selic, IPCA). **Não há nenhum coletor de boi gordo, vaca, bezerro** — a tabela está praticamente vazia para pecuária, o que explica a IA cair na web e trazer preço de outra região/data.

Causas-raiz dos erros relatados:

1. **Base vazia de pecuária** → sem dado local, sobra a busca web genérica.
2. **Categorias insuficientes**: só existem `boi-gordo`, `vaca-gorda`, `bezerro`. Não há novilha, garrote, boi magro, boi china, bezerra, vaca boiadeira → regex mistura tudo.
3. **Hierarquia frágil**: distância em linha reta entre 40 cidades, sem noção de praça pecuária real nem de região/mesorregião.
4. **Sem controle de frescor**: uma cotação de 40 dias entra como se fosse de hoje.
5. **Sem selo de abrangência**: a resposta não distingue municipal, regional e estadual.

## Solução proposta

### 1. Modelo de dados novo (banco)

**`livestock_categories`** — catálogo canônico: `slug`, `nome`, `especie`, `unidade_padrao` (@ / kg / cabeça), `sinonimos[]`, `ordem`. Cobre: boi gordo, vaca gorda, novilha gorda, boi china, bezerro desmamado, bezerra, garrote, boi magro, vaca boiadeira.

**`livestock_places`** — hierarquia geográfica: `slug`, `municipio`, `uf`, `regiao` (ex.: "Noroeste Paulista"), `is_praca_pecuaria`, `lat`, `lon`, `ibge_code`.

**`livestock_place_links`** — vizinhança explícita e ordenada: `origem_slug`, `praca_slug`, `ordem`, `distancia_km`. Permite exatamente o exemplo pedido: Monte Aprazível → Rio Preto → Mirassol → Araçatuba → Barretos → SP. Semeada com as praças do Noroeste Paulista e das regiões onde a DuKamp atua, e complementada por cálculo de distância quando não houver link manual.

**`cotacoes_pecuarias`** — a tabela pedida: `categoria`, `estado`, `cidade`, `regiao`, `preco_minimo`, `preco_maximo`, `preco_referencia`, `unidade`, `condicao_pagamento`, `data_cotacao`, `fonte`, `url_fonte`, `nivel_confiabilidade`, `data_coleta`, `abrangencia` (municipal | regional | estadual | nacional). Índices por (categoria, estado, cidade, data_cotacao) e chave única para upsert idempotente.

RLS: leitura pública apenas de leitura; escrita só por service role / admin.

### 2. Motor de resolução (`src/lib/market/livestock.server.ts`)

Função única `resolveLivestockQuote({ categoria, cidade, uf, unidade })` que percorre a cascata e devolve sempre um resultado tipado com nível de confiança:

```text
1. cidade exata, cotação recente          → 🟢 Cotação Local
2. praça pecuária vinculada (ordem 1..n)  → 🟡 Referência Regional
3. mesma região                            → 🟡 Referência Regional
4. indicador estadual                      → 🟠 Referência Estadual
5. nada recente                            → 🔴 Sem cotação recente
```

Regras de frescor por categoria: cotação com mais de N dias (7 para boi gordo/vaca, 15 para reposição) sai do nível principal e, se usada, é marcada como "referência antiga" — nunca como preço atual. Nada é inventado: sem linha no banco, o motor devolve `null` e a instrução explícita de não citar valores.

### 3. Extração de intenção determinística

`parseLivestockQuery(texto)` extrai categoria (por sinônimos das `livestock_categories`, com desambiguação boi × vaca × novilha × bezerro), cidade (match contra `livestock_places`, incluindo acentuação e apelidos como "Rio Preto"), UF e unidade. Roda **antes** de RAG e de busca web, dentro de `query-router.server.ts`, substituindo o caminho atual de `marketAnswer` para categorias pecuárias.

### 4. Contexto entregue ao modelo

Bloco estruturado, não texto livre, com selo, categoria, faixa de preço, data, fonte, URL e a justificativa da substituição de praça. O prompt do sistema ganha regra rígida: para preços pecuários, usar **exclusivamente** os números do bloco; se o bloco disser "sem cotação", declarar isso abertamente e oferecer a fonte oficial. Formato de saída alinhado ao exemplo que você mandou, com o selo no início.

### 5. Coleta e atualização

- `src/lib/market/collectors/` com coletores por fonte confiável (CEPEA/ESALQ para indicadores nacionais e estaduais, B3 para futuros, fontes regionais aprovadas). Somente fontes do catálogo `market_sources`; blogs ficam de fora por lista de permissão.
- `POST /api/public/market-ingest` continua sendo o gatilho protegido por token, agora rodando também os coletores pecuários; ideal apontar um cron externo diário.
- Painel `/admin/cotacoes` ganha aba de cotações pecuárias: lançamento manual por praça, visualização do frescor de cada categoria e alerta visual quando um dado passou da validade.
- Busca web fica como **complemento**: só é acionada quando o banco não tem nada recente, e o resultado é apresentado com selo 🟠/🔴, com data e link, nunca como cotação oficial da praça.

### 6. Preservação do restante

Grãos, câmbio, combustível e futuros continuam no fluxo atual de `market_quotes`. Produtos, vendedores, unidades, RAG e o motor de contexto conversacional não são tocados.

## Detalhes técnicos

- Migração SQL única criando as 4 tabelas com GRANTs, RLS e seeds das categorias e das praças/vínculos do Noroeste Paulista.
- Novos arquivos: `src/lib/market/livestock.server.ts` (resolução em cascata), `src/lib/market/livestock-parse.ts` (extração de categoria/cidade/unidade), `src/lib/market/collectors/*.ts`.
- Alterados: `src/lib/chat/query-router.server.ts` (nova precedência), `src/lib/chat/system-prompt.ts` (regras de selo e proibição de valor sem fonte), `src/lib/market/ingest.server.ts` (registro dos coletores), `src/routes/_authenticated/admin.cotacoes.tsx` (aba pecuária).
- Testes de fumaça cobrindo: cidade com cotação, cidade sem cotação com praça vizinha, UF sem dado municipal, categoria inexistente e dado vencido.

## Ordem de execução

1. Migração do banco com categorias, praças, vínculos e `cotacoes_pecuarias`.
2. Parser de intenção + motor de cascata com testes.
3. Integração no roteador e no prompt, com os selos.
4. Coletores e aba admin de lançamento/monitoramento.
