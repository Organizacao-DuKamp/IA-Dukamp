# Orquestração multimodelo da TPEC-IA

## Estrutura existente e compatibilidade

O projeto usa React/TanStack Start, Nitro e Netlify Functions. O Supabase fornece
Auth, dados e persistência; as chamadas novas não usam Supabase Edge Functions.
As credenciais devem ficar nas variáveis privadas das Functions da Netlify.

`chat/core.server.ts` preserva busca interna, contexto, validação de grounding,
limites e correção das respostas. `ai/chat.server.ts` seleciona a implementação.
Com `TPEC_MULTIMODEL_ENABLED` ausente ou `false`, continua o fluxo anterior.
Não há migração nem exclusão de dados. `ai_chat_turns.metadata.usage_events`
recebe os detalhes de cada chamada. O painel existente mantém totais e custos
por usuário, e ganha agregação por provedor, percentual, erros, fallbacks,
modelo, nível, tokens, latência e data. A consulta de gastos percorre todas as
páginas do período, sem limitar o total às primeiras 10 mil perguntas.
Há total consolidado, cartões por IA e maior gasto por usuário, conversa e turno.
Empates são explícitos; custos desconhecidos ficam parciais/não atribuídos.
Registros históricos são preservados, inclusive de provedores desativados.

`whatsapp_conversations` continua guardando histórico e estado independentes de
provedor. `whatsapp_processed_messages` mantém a deduplicação e entrega duráveis.
A assinatura Meta autentica o webhook; os endpoints web exigem Supabase bearer
válido quando o multimodelo está habilitado. O ID autenticado delimita a sessão.
O rate limit existente é por instância; mídia tem limite antes de analisar.
Em múltiplas instâncias, use também limites de tráfego no gateway da hospedagem.

## Roteamento e custos

`ai/router.ts` classifica a mensagem e anexos sem gastar uma chamada de IA.
Perguntas gerais → OpenAI; cálculos → DeepSeek; imagem/vídeo → Gemini;
texto longo e PDF → Gemini; fatos atuais → Perplexity.
Pesquisa + cálculo e Pesquisa Profunda usam Perplexity → OpenAI, com cálculo
e síntese na segunda chamada. Fontes são preservadas e vinculadas à resposta.
Base interna continua prioritária para catálogo, estoque e contatos.

`ai/registry.server.ts` reúne adapters com a mesma interface; para adicionar um,
registre-o e estenda ProviderId/configuração/capacidades/fallback/testes.
O prompt pecuário é compartilhado, junto de histórico recente, resumo e estado.
Não há IDs de sessão proprietários. Resposta Rápida usa modelos econômicos,
Base intermediários e Pesquisa Profunda os avançados. A interface mantém TPEC-IA.

Há no máximo quatro chamadas efetivas por turno, incluindo análise de mídia e
tentativas de correção do fluxo anterior. Cada chamada tem timeout de 45 segundos
(90 para pesquisa profunda), com orçamento total de 180 segundos. Falhas seguem
apenas para adapters compatíveis; pesquisa requer fontes, inclusive no fallback
para OpenAI com web_search obrigatório. Sem pesquisa funcional, há erro controlado.
Uma falha nunca autoriza inventar preço atual. Tokens desconhecidos em falhas
de rede geram custo parcial, não uma falsa garantia de custo zero.

As tarifas são variáveis `AI_PRICE_<PROVIDER>_<MODELO_NORMALIZADO>_INPUT_USD_PER_1M`,
`..._CACHED_INPUT_USD_PER_1M`, `..._OUTPUT_USD_PER_1M`. Normalize o modelo com
maiúsculas e troque caracteres não alfanuméricos por `_`. Configure as tarifas
contratadas para cada modelo usado; custos ausentes ficam explicitamente parciais.
O custo total informado pelo Perplexity prevalece e não recebe taxa duplicada.

## Modelos

IDs e overrides ficam em `ai/config.server.ts`. As famílias foram conferidas nos
catálogos oficiais em setembro de 2026, mas disponibilidade na conta, quotas e
acesso a recursos só podem ser confirmados por chamadas autenticadas.

- [OpenAI](https://developers.openai.com/api/docs/models): GPT-5.6 Luna/Terra/Sol.
- [Gemini](https://ai.google.dev/gemini-api/docs/models): 3.5 Flash Lite e 3.8 Flash.
- [DeepSeek](https://api-docs.deepseek.com/): V4 Flash e V4 Pro.
- [Perplexity](https://docs.perplexity.ai/api-reference/sonar-post): Sonar, Sonar Pro e Sonar Deep Research.

Override: `AI_<PROVIDER>_<FAST|BASE|ADVANCED>_MODEL`. São usadas apenas as quatro
chaves de OpenAI, Gemini, DeepSeek e Perplexity mostradas em `.env.example`.

## Ativação e verificação

1. Configure as quatro chaves como secrets privados das Functions na Netlify,
   primeiro no deploy preview. Não use variáveis públicas `VITE_`.
2. Configure modelos e tarifas; mantenha `TPEC_MULTIMODEL_ENABLED=false`.
3. No ambiente backend com esses secrets, execute
   `node --experimental-strip-types scripts/smoke-ai.ts`. Faz chamadas pagas,
   uma por provedor, sem imprimir respostas, credenciais ou bodies de erro.
   Ausência de secret ou erro retorna status não zero.
4. Execute `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
   O build inclui scan de identificadores e padrões de secrets no bundle público.
5. Ative a flag no preview. Valide os sete cenários do usuário, incluindo um
   envio real de imagem/PDF pelo WhatsApp e a visualização das métricas no admin.
6. Depois da validação real, ative a flag na produção. Reverter para `false`
   restaura o roteamento anterior sem migração ou perda de histórico.

Os testes automatizados `tests/multimodel.test.ts` usam fetch simulado e verificam
os contratos dos quatro adapters, sete rotas, fontes, síntese, custos, redaction,
falhas e orçamento de chamadas. Eles não comprovam autorização nas contas reais,
qualidade das respostas reais ou disponibilidade dos modelos.

## Limites de mídia

O fluxo atual aceita anexos do WhatsApp com download validado no servidor.
Não foi criada uma nova UI de upload no site. Documentos com texto extraído longo
vão ao Gemini, assim como PDFs sem texto e imagens, com fallback compatível.
Vídeo usa Gemini quando MIME/tamanho são suportados; áudio conserva transcrição
anterior. Mídia é analisada com histórico e seu resumo integra a resposta final.
O contexto total tem limite explícito de 160 mil caracteres; arquivos acima
desse limite precisam ser divididos. Anexos inline Gemini têm teto conservador
de 19 MiB em base64; não há upload remoto para Files API nesta versão.
Os limites recusam entradas excessivas sem enviá-las silenciosamente incompletas.

## Segurança e publicação

`.env` saiu do índice Git e `.env.*`, secrets, chaves privadas e arquivos de
credenciais estão ignorados. O exemplo contém apenas nomes/placeholders.
Erros externos não propagam bodies ou headers. Secrets são removidos de texto
e metadados de fontes antes da telemetria. Nenhuma chave recebida em conversa
deve ser inserida em código, documentação, commit ou chamada frontend.

## Recuperação de previsão meteorológica

Pedidos como “Como está o tempo em São José do Rio Preto dias 30/09 e
01/10/26” usam a intenção meteorológica e preservam os dois dias. Datas não
entram no nome do município; anos com dois dígitos e datas inválidas são tratados
antes da consulta. “Hoje e amanhã” é resolvido no fuso local.

`weather-response.server.ts` valida a resposta inclusive nas consultas rápidas.
Uma recusa acompanhada apenas de cidade/data/nome de instituto não conta como
previsão. A resposta precisa trazer condições concretas e as datas pedidas.
A primeira síntese simples usa o tier econômico configurado. Se ela falhar e as
fontes estruturadas tiverem os dados necessários, esses dados são apresentados
diretamente, evitando outra chamada paga. O fallback preserva também consenso
de modelos ou previsão municipal oficial quando o Best Match não estiver disponível.

Quando faltarem dados utilizáveis, a recuperação chama o orquestrador com
pesquisa profunda: Perplexity e alternativa OpenAI com web_search obrigatório.
Quando a pesquisa já responde ao pedido, não há uma segunda síntese paga.
Isso funciona também com o fluxo legado selecionado; só usa provedores com
credenciais presentes. O orquestrador rejeita recusas de consulta mesmo se vierem
com citações, contabiliza o consumo e tenta alternativa compatível. Gemini e
DeepSeek não recebem pesquisas atuais sem suporte de busca; continuam atendendo
as suas especialidades.

O orçamento compartilhado de quatro chamadas permanece ativo. No WhatsApp,
a primeira etapa tem até 20 segundos e as etapas de resposta/recuperação juntas
têm até 45 segundos, além do tempo usado pela camada de fontes estruturadas.
Os mesmos sinais de cancelamento chegam aos adapters e à síntese da pesquisa.
Em indisponibilidade total, a resposta conserva os dados parciais disponíveis,
identifica o período sem confirmação e indica uma ação concreta no portal do
INMET. Não há garantia de obter dados durante uma indisponibilidade de todas as
fontes, nem autorização para inventar temperatura ou chuva.

Os testes de `weather-recovery.test.ts` reproduzem a frase e a recusa do incidente,
as duas datas, reutilização econômica de dados, falhas de provedores, escalada
de pesquisa e rejeição de recusa com citações. Os dados são simulados; eles não
validam disponibilidade ou qualidade das APIs em produção.
