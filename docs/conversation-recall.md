# Continuidade entre conversas no WhatsApp

O incidente de 22/10/2026 expôs duas falhas: a resposta genérica recebia apenas 40 mensagens recentes, e o estado normalizado descartava o marcador de início da memória. O pedido de uma planilha do gado de **ontem** também não era reconhecido como consulta ao livro do rebanho.

## Comportamento

- O remetente verificado pelo webhook define a identidade da recuperação. O cliente público não pode fornecer `conversationRecall` nem `channelEvidence`.
- Antes da resposta geral, o servidor recupera falas originais, respostas vinculadas e memórias persistentes ativas do mesmo remetente. A pesquisa textual em português inclui identificadores, equivalências de termos pecuários, vizinhos dos trechos encontrados e conversas recentes. Não usa pesquisa na internet para lembrar dados pessoais.
- Referências temporais usam o calendário de São Paulo: ontem, anteontem, há N dias, data explícita, dia da semana passada, semana passada e mês passado. Consultas de período carregam até 1.000 turnos em ordem cronológica, com contagem total e aviso de cobertura parcial.
- A montagem do contexto prioriza as falas originais, preserva perguntas para interpretar respostas curtas e identifica respostas antigas da IA como não verificadas. Correções posteriores para o mesmo item prevalecem. O livro estruturado continua sendo a fonte dos totais do rebanho.
- O orçamento é de 60 mil caracteres de contexto recuperado. Cortes e omissões nas falas originais são explícitos. A resposta não deve chamar uma seleção parcial de listagem completa nem pedir novamente dados presentes na recuperação.
- Os caminhos de contingência do modelo, transporte e watchdog também recuperam contexto. Uma falha na leitura do histórico não pode sobrescrever uma conversa existente com um histórico vazio.
- O marcador do canal sobrevive à normalização do estado. Um reset explícito cria uma fronteira persistente em `context_reset_at`; a recuperação não atravessa essa fronteira. Livros e eventos antigos ficam ocultos do contexto, preservados no banco. Antes de reutilizar um livro de uma geração anterior, seu snapshot completo é arquivado de forma privada.
- Mídias atuais extensas ficam em um campo interno de evidência, separado da pergunta curta. O arquivo privado de turnos passa a preservar até 60 mil caracteres originais, em vez de oito mil.
- Consultas por planilha/PDF/Excel do gado reconhecem a data relativa e reutilizam a data em continuações como “faz em PDF”. Novos lançamentos continuam no dia atual. Pedidos de relatório de outros assuntos seguem para a conversa geral.

## Validação

`tests/conversation-recall.test.ts` cobre datas no limite UTC, 269 turnos, correções, respostas curtas, recusa de contexto forjado pelo cliente, falha de recuperação, preservação do marcador, contingência, cálculos dependentes da conversa, continuidade da data e o texto exato do incidente.

`tests/sql/whatsapp-context-retrieval.sql` verifica busca, vizinhança, isolamento entre remetentes, reset explícito, preservação dos registros antigos e nova geração. Usa remetentes fictícios e termina em ROLLBACK. As permissões de chamada da RPC e leitura das tabelas privadas também foram verificadas para anon, authenticated e service_role.

No replay local, com os dados históricos reais, a recuperação encontrou os 269 turnos de 21/10 e incluiu todas as falas originais no orçamento. O parser determinístico recuperou 156 animais e apontou 18 mensagens para revisão; essa reconstrução permanece **parcial**, sem reutilizar totais antigos incorretos. Nenhuma mensagem foi enviada ao contato durante os testes e nenhum cadastro real foi alterado pelo replay.

## Limites

A busca por assunto é textual em português, com termos equivalentes; não é busca vetorial. Trechos de documentos cortados pelo limite antigo de oito mil caracteres não podem ser reconstruídos a partir do arquivo de turnos. Imagens e afirmações anteriores da IA não viram registros confirmados automaticamente. O reconhecimento do pedido de PDF seleciona os registros corretos; esta mudança não adiciona um serviço de geração ou envio de anexos PDF. Não há promessa de memória ilimitada ou de ausência absoluta de erros.
