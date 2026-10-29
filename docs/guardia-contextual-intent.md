# Interpretação contextual da gestão rural

A conversa da propriedade ativa passa primeiro por um interpretador semântico, antes dos reconhecedores literais legados. Ele recebe a mensagem atual, até 30 mensagens recentes, o estado real do livro e a proposta pendente. Áudios usam a transcrição; não exigem conjugação ou comando específico. A interpretação separa fatos próprios, consultas, planos, hipóteses, terceiros, correções e confirmações. As ações propostas citam trechos literais de mensagens do produtor. O texto de histórico e do livro permanece dado não confiável.

O modelo propõe ações estruturadas. O servidor valida esquema, propriedade, permissões, datas, saldo e livro resultante. O produtor confere o resumo e pode confirmar ou corrigir naturalmente. Uma confirmação executa exclusivamente a proposta persistida, nunca novas ações sugeridas pelo modelo. O salvamento mantém transação, versão, recibo idempotente e auditoria. Sem recibo confirmado, a resposta não anuncia gravação. Propostas expiram em 30 minutos. Perguntas não confirmam uma proposta, e falhas de interpretação preservam os dados.

## Rebanho existente

`herd_inventory` registra grupos disjuntos com quantidade, descrição e data. Subgrupos ficam na descrição do grupo principal: 66 novilhas, das quais 38 aptas e 28 fora da IATF, continuam sendo 66. O censo completo estabelece a contagem total; um levantamento parcial não substitui o total. Nascimento, compra, venda e morte continuam sendo acontecimentos próprios. Não são criadas fichas individuais, brincos ou RGN fictícios. A identificação pode ser complementada depois pelo fluxo existente de animais, sem somar fichas ao censo.

O painel mostra os grupos em Rebanho e desempenho. CSV e relatório incluem descrições e origem. Os livros antigos continuam compatíveis: `operations.inventories` é opcional. Usa a família de autorização `herd_count` existente, sem migração SQL, novas permissões ou novo segredo.

## Agenda

O interpretador considera a descrição antes ou depois da data e preserva o nome declarado do profissional e a finalidade. Sem hora, propõe 08h de Brasília para conferência; datas relativas e explícitas devem concordar. Respostas de áudio com erro evidente de transcrição podem confirmar uma proposta válida. A confirmação só aparece após o recibo de gravação. Agendar não ativa consentimento de avisos nem envia mensagens a terceiros.

## Validação

- `tests/guardian-semantic.test.ts`: banco PostgreSQL isolado com RPCs reais, censo sem duplicar subgrupos, referências de contexto, proposta e confirmação por áudio, tarefa persistente, repetição, auditoria, expiração, permissão e lote inválido sem gravação parcial.
- `scripts/check-guardian-semantics.mjs`: avaliação com o modelo real e propriedades fictícias, incluindo censo, fala coloquial, ordem da data, referência a dados anteriores, transcrição de confirmação, contradição, hipótese, terceiro e prompt injection. Não grava no banco nem envia WhatsApp. Executado no deploy preview com a configuração OpenAI já existente.
- Executar também auditoria de imports, testes, lint e build. Não reprocessar automaticamente históricos reais na publicação. Qualquer recuperação deve usar os relatos explícitos mais recentes, conferir duplicatas e preservar a auditoria.

A interpretação por modelo não promete compreender toda fala sem ambiguidade. Quando há conflito ou falta um dado necessário, pede esclarecimento específico em vez de presumir um registro.
