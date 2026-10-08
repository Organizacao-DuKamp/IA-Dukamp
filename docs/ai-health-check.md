# Verificar IA no painel administrativo

O botão laranja **Verificar IA** no topo de `/admin/ia` abre um diálogo e consulta OpenAI, Google Gemini, DeepSeek e Perplexity. O endpoint POST exige sessão Supabase válida e papel `admin` antes de carregar o módulo server-only.

- DeepSeek: `GET /user/balance`, sem geração de texto. Exibe o saldo informado em USD/CNY e o indicador de disponibilidade financeira. Não comprova funcionamento de um modelo específico.
- OpenAI: modelo econômico configurado, prompt fixo `Reply OK.`, limite de 16 tokens de saída, sem ferramentas, histórico ou armazenamento.
- Gemini: modelo econômico configurado e limite de 1 token de saída.
- Perplexity: modelo econômico configurado, limite de 1 token e `disable_search: true`. Pode haver taxa mínima por requisição conforme a cobrança do provedor.

Nenhum teste usa fallback ou retry automático. Cada chamada tem timeout de 12 segundos. Não há consulta não oficial de cobrança nem saldo deduzido a partir do gasto do painel. Os provedores sem consulta de saldo implementada mostram `não disponível` e um link para seu painel.

O resultado distingue falta de créditos confirmada, bloqueio de cobrança, cota/rate limit, autenticação, configuração e indisponibilidade. `insufficient_quota` sozinho é ambíguo e não significa saldo zero. O teste mínimo não verifica todos os modelos, pesquisa web, mídia ou disponibilidade futura.

Consultas concorrentes e resultados recentes são compartilhados por cinco minutos em cada instância do servidor. Rotação de chave ou modelo invalida esse cache. O diálogo também reutiliza o resultado durante esse intervalo, inclusive ao reabrir. Não há scheduler ou testes automáticos em segundo plano. Em múltiplas instâncias ou abas, não existe garantia de um único teste global.

Chaves, corpos de erro e texto gerado nunca são enviados ao navegador nem registrados por este módulo. Os testes de `tests/ai-health.test.ts` usam fetch simulado e não gastam créditos reais.

Referências: [saldo DeepSeek](https://api-docs.deepseek.com/api/get-user-balance/), [erros OpenAI](https://developers.openai.com/api/docs/guides/error-codes), [generateContent Gemini](https://ai.google.dev/api/generate-content), [parâmetros Perplexity](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to).
