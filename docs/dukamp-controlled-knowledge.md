# Conhecimento de produtos Dukamp com revisão técnica

A base estruturada preserva 116 identidades de produtos/variantes, 120 versões de relatórios, 124 arquivos originais, 7.016 perguntas, 1.962 seções e 189 casos de aceitação. A implementação amplia o fluxo existente de `knowledge_documents`, `knowledge_chunks`, bucket privado `knowledge-base`, busca lexical/semântica e embeddings do projeto. Não faz fine-tuning.

## Representação e importação

O pacote fica fora do Git. MD, documentos originais e respostas do FAQ não são indexados novamente como evidências independentes. Cada seção documental é um documento e um chunk canônico com produto, variante, fonte, hash, seção, versão, restrições e status. As perguntas ficam em registros de apoio por produto e acrescentam vocabulário de busca às seções referenciadas. `avaliacao.jsonl` é exclusivamente um conjunto de testes.

A aplicação administrativa reconhece o ZIP estruturado, valida o conjunto e envia os originais com hash para caminhos imutáveis `dukamp/originals/<sha256>.<ext>` no bucket privado existente. Depois importa o catálogo, perguntas, manifesto e seções em lotes de 15 registros. São 2.195 documentos planejados: 1.962 seções, 116 fichas, 116 registros de perguntas e um manifesto. A seção mantém seu conteúdo completo, tabela e unidades; as restrições da mesma versão ficam também nos metadados.

Identidade de documento usa UUIDv5 do caminho canônico. Um reenvio igual preserva vetores e revisão humana; mudança da ficha invalida a liberação e conserva seu histórico. Um envio interrompido pode ser repetido para reparar seções sem chunk. Importar flags, aliases ou texto alegando aprovação não concede liberação.

## Execução no ambiente administrativo

Validação local, sem credenciais:

```sh
node --experimental-strip-types scripts/dukamp-package-cli.mjs --package /caminho/DUKAMP_BASE_TPEC_IA --report dukamp-validacao.json
```

Aplicação, com `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` configuradas somente no servidor:

```sh
node --experimental-strip-types scripts/dukamp-package-cli.mjs --package /caminho/DUKAMP_BASE_TPEC_IA --apply --report dukamp-importacao.json
```

Não colar chaves no chat ou versioná-las. A CLI verifica bucket privado e hashes, reutiliza `embedTexts`, `embeddingProvider` e `toPgVector`, processa lotes de até dez seções, verifica as escritas e distingue concluídos, erros e pendentes. Uma falha interrompe o processamento para correção e retomada idempotente; status concluído sem vetor não comprova vetorização. A interface utiliza a mesma fila administrativa existente. Falhas de embedding preservam evidência lexical e restrições.

## Controles na conversa

O controle roda antes da recuperação e volta a conferir a revisão depois da resposta. A busca hidrata metadados e filtra versões, inclusive resultados de cache. Sem acesso ao catálogo, um registro local de segurança mantém todas as liberações falsas. Documentos antigos duplicados não podem contornar a ficha canônica.

As espécies vêm da indicação literal, com fronteiras de palavras: `bovinos` não autoriza `ovinos`. Nomes parecidos permanecem separados; nome ou alias não define estação, superioridade ou autorização. O contexto considera espécie, categoria/fase, idade, peso, objetivo, sistema, estação, volumoso, dieta, adaptação e produtos/medicamentos concomitantes. Restrições de espécie/idade, núcleo puro, tiamulina, uréia adicional e reprodução precedem a indicação. Sinais clínicos priorizam atendimento veterinário.

Ficha pendente permite explicação documental com fonte e divergências, sem cálculo operacional. Histórico/obsoleto e não lançado ficam fora de candidatos comerciais e podem ser explicados em consultas históricas explícitas. Catálogo de 2012 ou nome de pasta não comprova estoque atual. Campos comerciais seguem a fonte comercial atual existente.

Depois de revisão completa, consultas operacionais reproduzem o modo de usar, restrições e unidades conferidos na mesma versão. A aplicação não delega novos cálculos/conversões de dose a texto gerado. Um motor de cálculo futuro exigirá fórmula, bases, limites e testes específicos por versão.

## Revisão humana

O painel aparece na administração da base. Reutiliza a autorização `admin` existente, exige declaração de responsabilidade técnica e vincula autoria à sessão autenticada. A organização deve conceder esse acesso somente a responsáveis técnicos autorizados; não há verificação automática de registro profissional.

O registro preserva os campos de `REVISAO_DUKAMP.json`: produto, vigência, fonte aprovada, evidência atual, responsável, data, bloqueios resolvidos, campos corrigidos com evidência, liberação e observações. `resolucoes` e `campos_validados` oferecem a representação detalhada desses campos; hash da fonte, fingerprint da ficha, espécies, disponibilidade e usuário autenticado reforçam a validação. Nenhuma revisão do arquivo recebido é aplicada automaticamente.

Liberar exige todos os campos, resolução de todas as divergências, disponibilidade atual confirmada e fonte compatível. Uma revisão incompleta não libera. Revisões e revogações preservam o histórico; alterações concorrentes são rejeitadas pelo número da versão. Informação recuperada ou mensagem de usuário não registra revisão.

## Verificações e limites

O arquivo `tests/evals/dukamp-product-cases.jsonl` é cópia dos 189 casos de aceitação, sem indexação. Os testes cobrem todas as identidades, todos os produtos pendentes, os cenários especiais, reimportação, recuperação de falhas, hashes e storage, dimensão do vetor, autenticação e mudança de versão. A CLI verifica que todas as evidências esperadas nos testes existem no conjunto canônico.

Testes determinísticos e vetores artificiais de fixture verificam o código; não comprovam importação no banco, comportamento de modelo ao vivo ou embeddings reais. Confirmar esses resultados no ambiente implantado é etapa obrigatória. Sem credenciais administrativas e de IA, os dados efetivamente importados e vetorizados permanecem zero.
