# TPEC-IA — Fase 4: homologação e publicação segura

Data: 2026-11-10. Escopo: Fases 1–3 da Guardiã (WhatsApp + painel). **Não usar dados reais como massa de teste.**

## Critérios de homologação (obrigatórios)

- [ ] CI integral em `test/guardian-phase4-release-20261110`: `npm ci --include=dev`, `npm test`, `npm run build`, `npm run lint`, `npm run audit:privileged`
- [ ] Build e testes de mídia no Windows
- [ ] P4-01 a P4-12: testes isolados de registro de combustível, nascimento, recibo/replay, troca de fazendas, erros de importação e confirmações
- [ ] Exercícios com PGlite em memória: nenhuma escrita no Supabase de produção
- [ ] Revisar manualmente o diff antes da publicação; não inserir chaves ou dados pessoais em logs/commits
- [ ] Verificar `main` e a SHA de implantação atual do Netlify antes do merge
- [ ] Verificar as duas publicações associadas: `tpec-ia` (www.tpecia.com.br) e `tpecia` (tpecia.netlify.app)

## Cenários funcionais além da CI

1. Despesa única de combustível e reenvio do mesmo WhatsApp (um único lançamento).
2. Relato de custo mensal versus previsão futura (não converter previsão em pagamento).
3. Dois nascimentos registrados sem criar fichas/RGN inexistentes.
4. Confirmação genérica após importação já concluída (não aciona lote antigo).
5. Nova importação de PDF ABCZ, revisão, correção e aprovação.
6. Um áudio com várias operações e horário futuro (persistência atômica).
7. Troca entre duas fazendas e tentativa de alterar propriedade sem autorização.
8. Pergunta "Por que deu problema?" após erro real (sem recibo fictício).
9. Resumo financeiro e tarefas sem gravação e sem modelo desnecessário.
10. Reenvio após timeout: consultar recibo antes de executar novamente.
11. Notificação de tarefa: entrega conforme janela e autorização de WhatsApp; não prometer som se Android não estiver validado em aparelho.
12. Teste de imagem/PDF grande e limites: falhas explícitas e sem importação parcial silenciosa.

## Medição antes/depois

Registrar linha de base por estágio, em janelas comparáveis: quantidade, proporção `error` e `pending`, percentis p50/p95 de duração, tokens de entrada/saída, custo estimado por interação, taxa de sucesso de gravação, replay e duplicidade. Separar `guardian_semantic_plan_read`, `guardian_semantic_plan`, análise de arquivo e demais chamadas de IA. **80% de economia é uma meta, não um resultado até ser medida.**

## Sequência de publicação

1. Preferir um único merge atômico da branch de homologação na `main`, em vez de três merges e três deploys independentes.
2. Registrar a SHA anterior da `main` e dos dois deploys Netlify.
3. Confirmar que checks estão verdes, nenhuma migração pendente ou segredo novo é exigido.
4. Mesclar com `expected_head_sha` para evitar publicar código não revisado.
5. Acompanhar os dois deploys até estado `ready`, confirmando SHA de commit publicado.
6. Testar apenas chamadas **não destrutivas** no site em produção; para gravações, usar uma fazenda de testes autorizada e isolada.
7. Monitorar erros da Guardiã, filas WhatsApp e tempos/custos em intervalos curtos após a implantação.

## Rollback

Se o build falhar, nenhum deploy novo deve ser considerado publicado. Se aparecer desvio de roteamento, falso recibo, erro de autorização, duplicações ou aumento significativo de falhas, retornar ao último deploy Netlify comprovadamente íntegro e abrir um PR de reversão da `main`. O retorno do deploy não deve restaurar/reescrever dados reais automaticamente; primeiro conciliar recibos e mensagens. Em caso de divergência entre os dois sites Netlify, interromper a liberação e investigar qual URL processa webhooks.

## Limites

CI não é substituta para testes ao vivo de notificações e da API Meta. Não declarar como validados envios reais, reconhecimento de fala em produção ou 80% de redução de custo sem dados observados. Não reproduzir mensagens de produtores reais em logs de testes.
