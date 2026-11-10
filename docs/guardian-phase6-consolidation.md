# TPEC-IA — Fase 6: consolidação, segurança e implantação

Data da preparação: 2026-11-10. Branch: `feat/guardian-phase6-consolidation-20261110`.

## 1. Escopo e dependências

A Fase 6 consolida a Etapa 5 de inteligência operacional. **Depende do merge e da publicação aprovados da Etapa 5 (PR #115).** Não mesclar esta branch antes de verificar que o PR #115 passou por completo; o PR da Fase 6 foi criado sobre a branch da Etapa 5.

Entregas: indicadores de fácil leitura no painel desktop e celular, distinção financeira entre realizado e estimado, aviso de falta de contagem inicial e de tarefas vencidas, testes de isolamento por fazenda, read-only e fontes meteorológicas, e este roteiro de publicação.

Os dados mostrados vêm do livro já autorizado ao usuário. Os cartões não fazem requests, não abrem conexão privilegiada nem salvam lançamentos por conta própria.

## 2. Invariantes obrigatórias

1. **Isolamento:** usuário vê somente a propriedade da sessão. A seleção e autorização permanecem validadas no servidor; nunca usar o nome de uma fazenda ou campos de um PDF como prova de acesso.
2. **Leitura não escreve:** relatórios, indicadores e alertas sob demanda jamais chamam `guardian_commit_turn` ou atualizam o livro. Ações explícitas continuam no executor autorizado, com replay e checagem de versão.
3. **Proveniência financeira:** estimativas não integram valores realizados; total mensal declarado substitui os detalhes cobertos conforme `ledgerForTotals`; saldo não é lucro líquido. Recorrência mensal não gera despesas pagas nos meses futuros.
4. **Rebanho:** sem contagem inicial conhecida, não mostrar zero nem somar fichas individuais como se fossem censo da fazenda.
5. **Fontes externas:** preços só com produto, unidade, praça, data e fonte. Avisos oficiais climáticos só para localidade compatível, atualização recente, URL HTTPS autorizada e intervalo válido.
6. **Contexto e custo:** pedidos objetivos de leitura retornam do snapshot autenticado sem chamar a IA. Para planejamento semântico, monitorar `guardian_semantic_plan_read` e `guardian_semantic_plan` separadamente. Jamais truncar contextos operacionais com confirmação pendente a ponto de perder evidências.

## 3. Qualidade e segurança antes do merge

Executar `npm ci --include=dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run audit:privileged`, e testes de mídia no Windows (CI).

Verificar especialmente:
- Fase 4: doze cenários de PGlite e roteamento sem importação antiga.
- Fase 5: comparação financeira, projeções e avisos sob demanda.
- Fase 6: ausência de mistura de propriedades, dados estimados fora do saldo, proteção de consulta, alertas oficiais e fonte hostil bloqueada.
- Manual (desktop e celular): abrir com fazenda com e sem contagem inicial, com saldo negativo e sem lançamentos, com estimativas, tarefas vencidas, com proposta pendente e papel somente leitura; verificar que os cartões apenas navegam e que confirmação exige revisão.
- Auditar o diff inteiro para evitar segredos, telefones reais, URLs de painéis privados e mudanças em permissões.

## 4. Implantação e reversão

1. Esperar o PR #115 aprovado e integrado; sincronizar a base do PR da Fase 6 sem sobrescrever outras alterações.
2. Confirmar status verde para a **SHA final** do PR da Fase 6, e não apenas para um commit anterior.
3. Registrar SHA atual da `main`, estado e identificador do último deploy **ready** de `tpec-ia` e `tpecia`.
4. Fazer merge somente após autorização/revisão e, então, observar os dois projetos Netlify até `ready` para a mesma SHA.
5. Conferir painel público, autenticação de sessão e permissões, relatórios de somente leitura, sem usar a propriedade de cliente para testes de gravação.
6. Se houver regressão crítica, restaurar o último deploy estável dos dois sites e preparar revert do commit; não restaurar o banco automaticamente.

Não declarar publicação ou ganho de custo sem os deploys e as medições reais. Não habilitar novos alertas proativos sem opt-in, limites diários e deduplicação.

## 5. Comparação antes e depois

Comparar períodos equivalentes com a mesma mistura de intenções, usando:
- Interações por área e ações com recibo confirmado / erro / pendência.
- P50/P95 de latência; média e P95 de tokens de entrada; custo estimado total e por operação.
- Taxa de perguntas de esclarecimento desnecessárias e pedidos repetidos.
- Duplicações após reenvio, mudança de fazenda não autorizada, falso recibo e apresentação de cotação sem fonte: tolerância zero.
- Porcentagem de relatórios resolvidos sem IA e percepções de produtores leigos (não medir apenas respostas do modelo).

A redução de 80% do custo de operações simples permanece **meta**, não um resultado comprovado nesta fase. A Etapa 5 de alertas proativos novos e integração adicional de cotações WhatsApp só poderá ser considerada completa após desenvolvimento, testes e publicação específicos.
