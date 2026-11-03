# Lembretes no horário solicitado

Quando o produtor agenda um lembrete para si, o horário escolhido autoriza aquele
aviso, inclusive à noite ou de madrugada. A janela padrão das 8h às 20h, o máximo
diário e o intervalo mínimo continuam protegendo contra avisos espontâneos. A
exceção não amplia a janela geral da conta.

O caso relatado tinha um lembrete de dar ração às 22h39, dois avisos anteriores no
mesmo dia e expiração após sucessivos adiamentos. Corrigir só a janela deixaria o
limite diário impedindo esse lembrete.

## Implementação

- `applyFarmAction` inclui `requestedBy` na evidência do evento, tanto na criação
  como no reagendamento. O valor vem do ator autenticado, nunca da extração do
  modelo.
- `guardian_is_requested_reminder` verifica tipo, tema, tarefa aberta, versão,
  data, destinatário responsável e solicitante. Eventos anteriores à alteração
  podem usar a origem confirmada da tarefa, quando o identificador da mensagem
  também corresponde. Um aviso meteorológico ou uma tarefa atribuída por outra
  pessoa não ganha a exceção.
- A seleção e a autorização final da entrega aplicam a mesma regra. A tarefa é
  revalidada com bloqueio da propriedade antes do envio. Os avisos espontâneos
  preservam os limites de horário e frequência.
- Permanecem obrigatórios consentimento, avisos ativados, tema habilitado,
  vínculo ativo, validade, limite de tentativas, backoff do provedor, leases,
  deduplicação e recibo de entrega. Uma tarefa cancelada, concluída ou reagendada
  não pode usar seu evento antigo. A janela de atendimento de 24h do WhatsApp e
  a necessidade de template aprovado continuam independentes dessa exceção.
- A migração libera somente lembretes pessoais ainda válidos que estavam
  adiados pelo silêncio noturno. Não reabre eventos expirados, enviados,
  cancelados ou incertos e não remove o backoff de falhas do provedor.
- O contexto da conversa e a explicação nas preferências descrevem essa regra.
  A IA não deve atribuir falhas passadas a uma causa sem evidência recuperada.

## Validação e implantação

Os testes em PostgreSQL isolado congelam o relógio às 22h39, 02h05, meia-noite e
07h59 de Brasília. Exercitam criação por linguagem natural, cota diária já
atingida, aviso recente, bloqueio de envio antecipado, nova validação de
permissões/cancelamento/reagendamento, avisos espontâneos, compatibilidade com
eventos antigos, backoff, template e prevenção de duplicatas. Os envios usam
adaptador simulado; nenhuma mensagem real é enviada por esses testes.

`scripts/guardian-requested-reminders-live-validation.sql` verifica os mesmos
procedimentos de seleção e autorização no PostgreSQL conectado, com dados
sintéticos revertidos por `ROLLBACK`, sem chamar o provedor de WhatsApp.

Aplique a nova migração `guardian_requested_reminder_times` ao Supabase TPEC-IA
e publique o código atualizado. A migração é compatível com eventos do backend
anterior. Não reaplique migrações históricas nem reative o lembrete expirado do
relato; um lembrete novo precisa de data futura escolhida pelo produtor.

## Implantação conectada em 03/11/2026

Migração aplicada ao projeto TPEC-IA `cawgzodelwchccilqeqr` com versão
`20261103032737`. O ensaio SQL conectado passou e reverteu os dados sintéticos.
As três funções permanecem `SECURITY INVOKER`, executáveis apenas pelo servidor;
os advisors de segurança mantiveram somente os apontamentos anteriores.

Validação local: 1.009 testes aprovados, build e auditoria de imports privados
aprovados. Lint sem erros, com os 11 avisos preexistentes de React.
