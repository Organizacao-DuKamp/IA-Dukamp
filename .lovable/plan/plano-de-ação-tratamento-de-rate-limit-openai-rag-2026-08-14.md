# Plano de Ação: Tratamento de Rate Limit OpenAI (RAG)

O processamento da base de conhecimento está atingindo os limites de tokens por minuto (TPM) da OpenAI (erro 429). Este plano implementa resiliência no pipeline de embeddings com retries inteligentes, backoff exponencial e recuperação automática de documentos em erro por este motivo específico.

## Alterações Técnicas

### 1. Backend: Resiliência em Embeddings
No arquivo `src/lib/rag/embeddings.server.ts`:
- Adicionar lógica de retry na função `embedBatch`.
- Detectar HTTP 429 e respeitar os headers `Retry-After` ou headers específicos da OpenAI (`x-ratelimit-reset-tokens`, `x-ratelimit-reset-requests`).
- Implementar fallback de exponential backoff com jitter (2s, 4s, 8s, 16s, 30s, 60s) caso os headers não estejam presentes.
- Limitar a 7 tentativas antes de desistir e lançar erro permanente.
- Adicionar um pequeno delay (throttling) entre lotes para evitar picos de TPM.

### 2. Recuperação de Dados (SQL)
- Identificar documentos com `status = 'erro'` e `error_message` contendo "429" ou "rate limit".
- Resetar esses documentos para `status = 'aguardando'` e limpar a mensagem de erro.
- **Importante:** Apenas documentos afetados por rate limit serão resetados; os concluídos com sucesso (59) não serão tocados.

### 3. Interface Administrativa
No arquivo `src/routes/_authenticated/admin.base-conhecimento.tsx`:
- Ajustar a exibição do status. Documentos em retry/aguardando limite serão exibidos de forma mais clara se possível (ex: mensagem amigável no log de processamento).

## Plano de Teste
1. **Verificação de Recuperação:** Confirmar via SQL/Admin que os 93 documentos voltaram para "aguardando".
2. **Teste Controlado:** Executar o processamento manual de 3 documentos via interface.
3. **Validação de Logs:** Observar se o sistema aguarda corretamente ao encontrar um erro 429 simulado ou real, e se prossegue após a espera.
4. **Verificação de Provider:** Garantir que os trechos gerados mantêm o padrão `openai:text-embedding-3-large:3072`.

## Detalhes Adicionais
- **Segurança:** Nenhuma alteração no RLS ou nas chaves de API.
- **Integridade:** O sistema não apagará chunks já gerados para documentos "concluido".
- **Fluxo:** Após a aplicação, o usuário poderá clicar em "Processar pendentes" e o sistema deverá terminar os 93 restantes sem interrupção definitiva por rate limit.
