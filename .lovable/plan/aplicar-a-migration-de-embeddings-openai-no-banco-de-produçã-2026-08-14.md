# Aplicar a migration de embeddings OpenAI no banco de produção

## Situação atual (verificada agora no banco)

- A migration `20260814180000_openai_rag_embeddings.sql` **ainda não foi aplicada**: a função `match_knowledge_chunks` existe apenas com os parâmetros `(query_embedding, match_count)`, sem `embedding_provider`.
- A função `search_knowledge_lexical` **não existe** no banco atual (a busca lexical hoje falha; a migration a cria).
- Base atual: 152 documentos (todos com status `concluido`), 2130 blocos de texto, todos sem marcação de provedor de embedding.

## O que será feito

Aplicar o conteúdo do arquivo do repositório, byte a byte, como uma única migration — sem reset, sem apagar dados:

1. Marca os 2130 blocos existentes como provenientes do provedor antigo (Gemini 3072).
2. Recria `match_knowledge_chunks` com o terceiro parâmetro `embedding_provider`, padrão `openai:text-embedding-3-large:3072`, filtrando por documentos visíveis.
3. Cria/atualiza `search_knowledge_lexical` (busca por palavras), que continua atendendo enquanto a reindexação não termina.
4. Coloca em `aguardando` os documentos cujos blocos usam o provedor antigo — esperado: os 152 documentos. Os blocos antigos **não** são apagados.

## Verificação após a aplicação

Consultas de leitura para confirmar:

- assinatura de `match_knowledge_chunks` inclui `embedding_provider` com o padrão OpenAI;
- `search_knowledge_lexical` existe e responde a uma consulta de teste;
- contagem de documentos em `aguardando`;
- contagem de blocos permanece 2130.

## Observações técnicas

- Nenhum arquivo de código da aplicação será alterado; a integração OpenAI + Perplexity da `main` permanece intacta.
- Enquanto os documentos não forem reprocessados, a busca semântica retorna vazio (nenhum bloco tem vetor OpenAI) e a busca lexical cobre as consultas.
- Após a aplicação, o próximo passo é "Base de conhecimento → Processar pendentes" para reindexar com OpenAI.
