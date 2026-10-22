# Registros persistentes do rebanho

O atendimento WhatsApp encaminha anotações de animais para um livro estruturado antes do chat geral. A confirmação é retornada somente depois do commit atômico. Os registros são privados, separados por remetente autenticado pela Meta e data em America/Sao_Paulo. A janela curta do chat não é usada para reconstruir totais.

- `herd/book.ts`: interpretação determinística de códigos, pesos, sexo, lotes, decisões reprodutivas e correções; cálculo e relatório completos a partir dos registros individuais.
- `herd/handler.server.ts`: fronteira do WhatsApp, confirmação de gravação, prévias de importação e recuperação do histórico original.
- `herd/store.server.ts`: leituras privadas e commit com controle de versão. A transação serializa operações do mesmo usuário, rejeita versões antigas e devolve o recibo original em retries.
- `herd/recover.ts`: recupera entradas do usuário; nunca aceita totais gerados por respostas da IA como fatos. Reconstruções são parciais e exigem conferência explícita.

As tabelas `whatsapp_herd_books` e `whatsapp_herd_events` têm RLS e acesso revogado de PUBLIC/anon/authenticated. Só o backend com service_role pode ler/gravar. O RPC usa SECURITY INVOKER e registra mensagem de origem, versão e resposta no mesmo commit. Não há alteração das tabelas e conversas existentes.

Exemplos:

1. “Vamos registrar a pesagem do gado”, depois “DUKN 542”, “250 kilo”.
2. “DUKN 599 macho 213 kg”. Código repetido exige confirmar atualização, sem nova cabeça.
3. “Corrigi 697 kilos” corrige a última anotação; correção ambígua pede identificação.
4. “Lista geral” consulta todos os registros da data; “lista geral de 21/10/2026” consulta outra data.
5. “Histórico do DUKN 542” consulta pesagens por data; uma pesagem em outra data preserva a anterior e apresenta a diferença.
6. “Essa lista vai ser para inseminar”, “Todas são DUKN”, “554 306 não”. A decisão é a informada pelo usuário, sem inferir aptidão clínica.
7. Fotos/documentos/tabelas são prévias; “CONFIRMAR IMPORTACAO” inclui só as linhas exibidas, sem substituir códigos existentes. Importações históricas usam a data explicitamente confirmada.

Pesos ausentes são pendências. Estimativas ficam marcadas e fora dos totais e médias de pesos informados. Procedimentos são anotados pelo nome informado, sem deduzir indicação ou dose; novo lote não herda aplicação sanitária automaticamente. Animais sem número recebem chaves distintas. Falha de banco/concorrência não gera confirmação nem fallback de IA inventando dados.

Limites explícitos: 5.000 entradas por data, 1.000 linhas por prévia, 60.000 caracteres de mídia, 110.000 caracteres de relatório. Saídas maiores são identificadas como parciais. Datas de consulta devem ser DD/MM/AAAA; não é feita tradução de datas relativas para importações antigas. Mensagens fora da gramática suportada pedem esclarecimento preservando os registros. Um reset da memória de conversa não apaga o livro persistente de animais.

Validação: `tests/herd-book.test.ts`, suíte geral, typecheck, lint, build com verificação de segredos e auditoria de imports privilegiados. O teste SQL transacional valida gravação, replay idempotente, conflito e bloqueio de anon, com ROLLBACK. Testes simulados não substituem conferência dos dados reais de campo; OCR e transcrição continuam sujeitos a erro e não são aceitos como cadastro sem confirmação.
