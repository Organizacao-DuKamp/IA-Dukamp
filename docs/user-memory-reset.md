# Reinício global de memória — 14/10/2026

A geração `reset-2026-10-14-duk-a91f` reinicia uma vez o contexto pessoal de todos os usuários. A base de produtos, embeddings, contas e preferências de opt-out permanecem preservadas. Não há exclusão permanente nem envio de mensagens aos usuários como parte deste procedimento.

- WhatsApp: snapshots sem o marcador da geração atual não são carregados. Histórico, resumo, dados confirmados e ações pendentes anteriores não entram na próxima conversa. Novos snapshots recebem o marcador, permitindo a continuidade das próximas mensagens.
- Navegador: a nova geração utiliza outra chave local. O servidor ignora o histórico enviado por uma aba antiga e usa apenas as mensagens novas registradas no estado da geração atual. A compatibilidade vale também para a função de chat anterior.
- Fatos de acompanhamento: somente metadados com a geração atual entram na extração, no contexto proativo e na contagem ativa. Uma informação pode ser aprendida novamente se o usuário a fornecer nas mensagens novas.
- Extrações pendentes: entradas antigas sem a geração atual são concluídas sem extração. Não reconstroem a memória antiga depois do reset.
- Histórico proativo: a reconciliação não repõe mensagens de filas criadas antes do início da nova conversa; o contexto recente para geração proativa exclui mensagens anteriores aos fatos aprendidos novamente.

O painel administrativo oferece uma conferência somente de leitura com contagens agregadas. Nenhum telefone ou conteúdo pessoal aparece no relatório. As conversas e fatos anteriores ficam fora do contexto da IA; registros de auditoria existentes permanecem disponíveis. O reset não desliga a aprendizagem das próximas conversas.

Validação: testes da primeira mensagem, continuidade de novas mensagens, abas antigas, janela de histórico deslizante, marcadores inválidos, estado serializado, extrações antigas, limites de histórico e comportamento HTTP. A suíte geral também verifica os controles Dukamp e os fluxos WhatsApp existentes.

Rollback antes de novos atendimentos: reverter a publicação restaura o leitor anterior. Atendimentos novos passam a gravar o novo contexto nos registros existentes; não se deve tratar este mecanismo como backup integral das conversas. Os registros de auditoria seguem a retenção do projeto.
