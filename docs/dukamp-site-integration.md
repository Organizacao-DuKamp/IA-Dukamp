# Integração com o Supabase comercial DuKamp

## Causa raiz

O classificador de domínio e os contratos de ferramentas adicionados no PR anterior não estavam conectados ao executor comercial. O `core.server.ts` só consultava produtos quando `siteIntentHints().price` era verdadeiro ou quando o roteador local já havia identificado um produto. Assim, listagens e recomendações sem a palavra “preço” não chamavam `products`. Vendedores ainda dependiam de regex paralela. Além disso, todas as falhas eram convertidas em `[]`, tornando configuração ausente, RLS, schema inválido, rede e resultado realmente vazio indistinguíveis.

## Correção

- `executeCommercialLookup` conecta `product`, `product_recommendation`, `internal_price` e `seller_contact` às consultas reais.
- Produtos consultam `id,name,code,slug,price,active,stock,featured`; se coluna opcional não existir, repetem com `id,name,code,slug,active`.
- Vendedores consultam `id,name,role,region,phone,whatsapp,active,display_order`; se `display_order` não existir, repetem sem a coluna e ordenam por `name`.
- Categorias tentam `name,active,sort_order` e usam `name,active` com ordenação por nome como fallback.
- `site_settings` é verificada pelo health check apenas com a coluna pública `key`.
- Cada operação retorna `ok`, `not_configured`, `unauthorized`, `schema_error`, `timeout`, `internal_error` ou `empty_result` e emite log estruturado sem URL, chave, headers ou registros.

## Diagnóstico seguro

`checkDukampSiteHealth` é um módulo exclusivamente server-side, sem rota pública. Ele devolve somente `configured`, estado/código seguro e contagem para `products`, `sellers`, `categories` e `site_settings`. Uma futura tela administrativa pode chamá-lo após validar papel admin.

No ambiente de validação desta entrega, as duas variáveis comerciais não estavam configuradas. Portanto, não foi possível confirmar o schema do banco remoto ao vivo sem inventar um resultado. A existência e o fallback das colunas foram validados com um cliente Supabase mockado; após deploy, o health check distingue chave inválida/RLS (`unauthorized`), tabela ou coluna ausente (`schema_error`), falha de conexão (`internal_error`), timeout e ausência verdadeira (`empty_result`).

## Deploy

1. Configure `DUKAMP_SITE_SUPABASE_URL` e `DUKAMP_SITE_SUPABASE_ANON_KEY` somente no servidor.
2. Confirme que a URL é HTTPS e que a chave anon pertence ao mesmo projeto.
3. Garanta `SELECT` para anon nas tabelas `products`, `sellers`, `categories` e nos registros institucionais públicos de `site_settings`.
4. Não conceda escrita ao cliente do site usado pela TPEC-IA.
5. Execute o health check por uma tela admin ou console server-side e confirme as quatro consultas.
6. Faça deploy sem ativar OpenAI: Perplexity permanece o provedor principal.

## Antes e depois

| Pergunta                         | Antes                                 | Depois                                                |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| “quais produtos a DuKamp tem?”   | não disparava busca comercial         | lista produtos ativos oficiais                        |
| “tem produto para bezerro?”      | podia cair apenas no RAG              | recupera catálogo oficial e combina com ficha técnica |
| “me recomende um suplemento”     | contrato sem execução                 | consulta produtos oficiais antes de recomendar        |
| “me passe a lista de vendedores” | erro podia virar lista vazia          | consulta vendedores ativos e preserva causa de falha  |
| “vendedor de Rio Preto”          | filtro dependia de caminhos paralelos | consulta ativos e filtra por região/nome              |
