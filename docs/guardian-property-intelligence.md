# Seleção contextual e animais por espécie

A seleção de fazenda antes dependia de correspondência literal no reconhecedor legado. Uma transcrição como Tamburi podia chegar à conversa geral, que respondia como se tivesse selecionado Tambori, enquanto o banco mantinha Eduardo. O intérprete seguinte recusava o registro por escopo divergente.

A interpretação contextual agora retorna uma intenção explícita de seleção. O servidor resolve somente propriedades autorizadas, preserva o nome cadastrado e confirma depois do recibo da operação. Nomes próximos com uma única correspondência podem ser resolvidos; alternativas plausíveis exigem esclarecimento. Não há criação ou renomeação implícita.

Pedidos com seleção e lançamento recarregam o caderno da propriedade escolhida antes de interpretar e validar o lançamento. O servidor mantém o pedido original em um rascunho temporário quando falta esclarecimento, permitindo respostas naturais sem repetir todos os fatos. Uma ordem explícita e suficientemente informada pode ser aplicada diretamente; propostas com preenchimento presumido ou correções sensíveis continuam sujeitas à revisão. Versões concorrentes e recibos idempotentes protegem a gravação.

Inventários e movimentos têm espécie. Livros antigos sem esse campo continuam bovinos. Novas ações do modelo exigem espécie explicitamente. Um inventário de 20 PO, 40 comuns, mais 20 vacas e 20 bois, 40 porcos e 2 galinhas resulta em 100 bovinos, 40 suínos e 2 aves. Contagens completas se aplicam às espécies relatadas; espécies omitidas não viram zero. Grupos parciais não substituem contagens completas. O painel e a exportação preservam essas distinções. Não são criadas fichas individuais ou identificadores fictícios.

## Validação

Os testes determinísticos usam os RPCs reais em PostgreSQL isolado para seleção por áudio, pedido combinado, recarga do caderno, resposta a esclarecimento, ausência de seleção ativa, falha de gravação, repetição de mensagem e preservação da fazenda anterior. Testes de domínio verificam saldos independentes, estoque negativo por espécie, compatibilidade com livros antigos e rejeição de espécie ausente no contrato do modelo.

O Deploy Preview executa também o provedor real com uma conversa sintética e banco isolado, incluindo seleção Tamburi→Tambori, inventário misto e lançamento de combustível com troca de propriedade. Não envia WhatsApp nem grava em fazendas reais. Um recibo técnico contém o resultado da avaliação para diagnóstico do deploy.
