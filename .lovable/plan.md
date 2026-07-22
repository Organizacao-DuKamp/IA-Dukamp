# Reorganização Estruturada da Base de Conhecimento — TPEC-IA

## Diagnóstico atual

**Estrutura no banco (Lovable Cloud)**
- `knowledge_documents` (134 linhas) — metadados dos arquivos + `content` bruto.
- `knowledge_chunks` (1.982 linhas) — trechos com embeddings 3072d (Gemini).
- `user_roles`, `has_role`, `match_knowledge_chunks` já existem.

**Estrutura no disco (`src/seed/base-conhecimento/`)** — 134 arquivos preservados:
- `01-PRODUTOS/` — 4 espécies (BOVINOS, EQUINOS, OVINOS-E-CAPRINOS, OUTROS) + `05-DESCRICOES-GERAIS/` (folders e docs editáveis).
- `02-CONHECIMENTO-GERAL/` — FAQs.
- `03-REGRAS-DA-IA/` — persona, prompt base, regras.

**Problemas identificados**
1. Toda pergunta cai em busca vetorial — perguntas de contagem/listagem (“quantos produtos?”, “quais equinos?”) dão respostas imprecisas.
2. Não há entidade `products` — não dá para consultar produto por nome oficial nem lidar com aliases (“Dukamp 80s”, “80/S”…).
3. RTPI, descritivo e folder do mesmo produto viram documentos separados sem ligação.
4. Chat expõe “Fontes consultadas” com título/categoria — usuário vê estrutura interna.
5. Só aceita `.txt`/`.md`. PDF/DOCX/XLS/CSV precisam de suporte real.
6. Sem controle de duplicidade, divergência ou revisão manual.

## Tabelas — plano de alteração

**Criar (novas, não-destrutivas)**
- `products` — cadastro oficial (campos do brief: `official_name`, `description`, `category`, `species`, `animal_phase`, `package_weight`, `indication`, `consumption`, `usage_instructions`, `composition`, `guarantee_levels`, `active`, `source_document`, `source_updated_at`, timestamps).
- `product_aliases` — `product_id` + `alias` (único, case-insensitive) + `origin` (manual/auto).
- `product_review_queue` — casos duvidosos: duplicidade suspeita, divergência entre documentos, campos faltantes, produto “antigo”. Nunca modifica dados sem confirmação.
- `import_reports` + `import_report_items` — log de cada importação (arquivos lidos, erros, duplicatas, divergências).

**Alterar (aditivo, sem quebrar)**
- `knowledge_documents`: adicionar `internal_title`, `file_type`, `original_file`, `version`, `content_hash` (SHA-256 para detectar duplicata), `is_duplicate_of`, `requires_review`.
- `knowledge_chunks`: adicionar `product_id` (FK opcional) e `metadata jsonb`.

**Preservar**: nenhuma coluna existente é removida; nenhum dado atual é apagado. Migração 100% aditiva e reversível (script `down` documentado).

## Estratégia de migração (em etapas, sem destruir nada)

**Etapa 1 — Schema (migração SQL única, aditiva)**
Cria tabelas novas + colunas novas + índices + RLS (admin-only para escrita; leitura pública apenas em `products` com `active = true`, colunas seguras). Grants explícitos. Nada é apagado.

**Etapa 2 — Extração e parsing (server-side, sem tocar em arquivos originais)**
Server function `extractProductsFromKnowledge` (admin):
- Lê `knowledge_documents.content` já existente.
- Classifica cada documento por caminho: RTPI, descritivo, folder, FAQ, regra da IA.
- Para RTPI/descritivo: parser regex/heurístico extrai nome oficial, composição, garantias, indicação, consumo, modo de uso, embalagem, espécie (derivada da pasta), fase animal.
- Gera `content_hash`; documentos com hash igual → marcados como duplicata, não removidos.
- Deduplica produto pelo nome normalizado (slug). Divergências entre RTPI e descritivo (mesmo produto, campos diferentes) → entra em `product_review_queue` com status `divergencia`.
- Campos ausentes → produto criado com `requires_review = true`, campo em NULL (nunca inventar).
- Aliases automáticos: variações óbvias (case, hífens, barras, remoção de acentos, “S/” ↔ “S”, sufixos de peso).
- Salva relatório em `import_reports`.

**Etapa 3 — Painel de revisão (`/admin/produtos`)**
- Lista `products` com filtros: ativo, antigo, duplicado, requer revisão.
- Edição inline de campos + gerenciamento de aliases.
- Fila de revisão: aprovar/rejeitar/mesclar divergências.
- Botão “Confirmar substituição” para casos que sobrescrevem dados existentes (confirmação obrigatória).

**Etapa 4 — Ingestão multi-formato**
Estende `uploadKnowledgeZip` + novo `uploadKnowledgeFile`:
- `.txt`/`.md` — já suportado.
- `.csv` — parser nativo (linha vira chunk contextualizado).
- `.pdf` — `unpdf` (compatível com Cloudflare Workers, sem native deps).
- `.docx` — `mammoth` (browser build).
- `.xls`/`.xlsx` — `xlsx` (SheetJS).
- Cada arquivo gera `content_hash`; duplicata detectada é sinalizada, não substitui sem confirmação.
- Reprocessamento individual por documento (já parcialmente existe; adiciono botão por linha).
- Ao atualizar `content` de um documento, embeddings dos chunks daquele documento são regerados automaticamente.

**Etapa 5 — Roteador de perguntas (chat)**
Adiciona camada `queryRouter` antes do RAG:
- Classificador leve (regex + LLM curto): pergunta é *estrutural* (contagem, listagem, filtro por espécie/categoria) ou *explicativa*?
- Estrutural → server function tipada consulta `products` diretamente (ex.: `countProducts({ species: 'equinos', active: true })`).
- Nome de produto detectado → busca em `official_name` + `product_aliases`. Match fraco → resposta usa “Talvez você esteja se referindo a **[nome oficial]**…”. Match ambíguo entre dois produtos → lista opções, não escolhe.
- Explicativa/técnica → RAG atual, mas com `product_id` no filtro quando um produto foi identificado.

**Etapa 6 — Higiene de saída do chatbot**
Remove da UI do chat (`src/routes/index.tsx`) e do prompt do sistema:
- Bloco “Fontes consultadas”, título, categoria, subcategoria, similaridade.
- Instrução no system prompt para nunca citar nome de arquivo, pasta, caminho, % de relevância, trechos brutos, ou estrutura da base.
- Admin continua vendo tudo em `/admin/base-conhecimento` e `/admin/produtos`.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Parser extrair campo errado de RTPI | Produto vai para `requires_review`; nada é publicado sem admin confirmar. |
| Confundir produtos de nomes parecidos (ex.: Dukamp 80/S vs 80s Premium) | Match exato + slug; ambiguidade → fila de revisão, nunca merge automático. |
| Perder dados atuais | Migração só adiciona; `knowledge_documents`/`knowledge_chunks` intocados. `products` é derivado, pode ser reconstruído. |
| Divergência silenciosa entre RTPI e descritivo | Detectada via hash de campos-chave; entra em `product_review_queue`. |
| PDF/XLS parser falhar no Worker | Uso de libs Worker-safe (`unpdf`, `xlsx`, `mammoth` browser build); falha por arquivo é registrada em `import_reports`, não derruba a fila. |

## Plano de implementação (ordem de execução)

1. **Migração SQL aditiva** — cria `products`, `product_aliases`, `product_review_queue`, `import_reports`, `import_report_items`; adiciona colunas em `knowledge_documents`/`knowledge_chunks`; RLS + grants + índices.
2. **Server functions de extração e produtos** — `extractProductsFromKnowledge`, CRUD de `products`/`aliases`, revisão, relatórios.
3. **Parsers multi-formato** — `unpdf`, `mammoth`, `xlsx`, CSV; integrados ao upload existente com hash e detecção de duplicata.
4. **Painel `/admin/produtos`** — listagem, edição, aliases, fila de revisão, relatórios de importação.
5. **Roteador de perguntas + funções estruturais** — `countProducts`, `listProducts`, `getProduct`, `findByAliasOrName`.
6. **Ajuste do chat** — remoção do bloco de fontes na UI; atualização do system prompt; integração com o roteador.
7. **Extração inicial rodada em modo “dry-run”** — gera relatório sem publicar; admin revisa; segunda rodada publica.

## Detalhes técnicos

- Stack: TanStack Start + `createServerFn` com `requireSupabaseAuth` + `has_role('admin')` para tudo administrativo.
- `products.active` default `true`; produtos marcados “antigos” recebem `active = false` mas ficam consultáveis no admin.
- Índices: `products(species)`, `products(active)`, GIN em `product_aliases(lower(alias))`, `knowledge_documents(content_hash)`.
- Embeddings: mantém Gemini 3072d via Lovable AI Gateway; reprocess automático quando `content_hash` muda.
- Nada é apagado — “substituir” sempre pede confirmação e faz snapshot em `import_reports`.

Confirma que posso começar pela **Etapa 1 (migração aditiva)** e seguir na ordem, parando para você validar o relatório da Etapa 2 antes de publicar produtos?
