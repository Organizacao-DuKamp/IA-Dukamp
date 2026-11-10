# TPEC-IA · Fase 7 adicional — saúde operacional e melhoria contínua

Preparação: 2026-11-10. Esta é uma etapa adicional após o roteiro original de seis fases, não uma fase definida naquele plano.

## Entrega
Na tela autenticada Administração → IA, o bloco "Operação do WhatsApp" consulta o banco por meio do servidor, após verificar autenticação e papel admin. Mostra duas janelas consecutivas de 24 horas: total de mensagens, falhas, pendências, P95 de duração e tokens de entrada, custo estimado, rastros da Guardiã, recibos e custo por etapa.

A consulta é sob demanda (carregamento inicial e botão Atualizar saúde), não monitoramento autônomo 24/7; não envia notificações, reprocessa mensagens ou corrige dados automaticamente.

## Sinais para investigação
- Pendência há mais de 10 minutos: sinal crítico.
- Falhas de pelo menos 5% em 20 ou mais interações em 24h: investigar.
- P95 de entrada acima de 30 mil tokens (com 10 ou mais interações): investigar custos e contexto.
- Custo médio por interação duplicado frente às 24 horas anteriores (10 ou mais interações em cada janela): investigar.
- Tarifas incompletas, amostra truncada ou ausência de dados: estado desconhecido, nunca assumir disponibilidade.

Os dados são agregados por canal WhatsApp e incluem consultas à IA fora da Guardiã. A cobertura dos rastros indica quantos turnos têm um registro estruturado do executor. Recibos de telemetria não substituem conciliação com operações realmente persistidas.

## Segurança e limites
- Exigir sessão autenticada e has_role(admin) antes do acesso privilegiado.
- O select não traz texto do usuário, respostas, números de telefone, IDs de fazenda, user keys ou tokens de sessão.
- Resposta apenas com contagens, custos, percentis, nomes de etapas validados e códigos de erro higienizados. O campo metadata não é enviado ao navegador.
- Limite de 5.000 interações em 48 horas. Se atingido, informar que os totais podem estar incompletos.
- Não cria migrações nem altera permissões, dados de produtores ou parâmetros do modelo.
- Custos são estimativas conforme a configuração de preços; a própria consulta ao banco consome recursos.

## Liberação e reversão
1. PR #115 (Etapa 5) e PR #116 (Fase 6) homologados e integrados na ordem.
2. PR #117 (Fase 7) com testes, lint, build, auditoria de imports privilegiados e testes Windows verdes na SHA final.
3. Conferir acesso admin e negar acesso a usuário sem papel admin; não usar dados reais para testes de gravação.
4. Registrar a SHA anterior da main e os deploys prontos dos sites tpec-ia e tpecia. Integrar somente após revisão e confirmar ambos em ready.
5. Verificar manualmente primeiras 24–48 horas e conciliar casos de falha com recibos antes de qualquer nova tentativa.
6. Se houver regressão, reversão de deploy e código; não restaurar nem reescrever automaticamente dados das fazendas.

A meta de reduzir 80% do custo de operações simples continua não comprovada até a medição representativa antes e depois. Um futuro monitoramento proativo requer gatilho externo e política de alertas, e não deve ser confundido com a tela criada aqui.
