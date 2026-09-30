import { askTpecAI } from "../ai/chat.server.ts";
import { orchestrateAI } from "../ai/orchestrator.server.ts";
import type { OpenAIOptions } from "./openai.server.ts";
import type { ChatMessage } from "./types.ts";
import { analyzeWeatherRequest, resolveWeatherTimeWindow } from "./weather-analysis.ts";
import {
  renderWeatherFallbackReply,
  type WeatherIntelligence,
} from "./weather-intelligence.server.ts";
import { validateWeatherGrounding } from "./response-validation.ts";
import { formatReplyForUser } from "./response-format.ts";

interface WeatherResponseDependencies {
  askAI?: typeof askTpecAI;
  research?: typeof orchestrateAI;
  now?: () => number;
}

function boundedFetch(fetchImpl: typeof fetch, ...deadlines: AbortSignal[]): typeof fetch {
  return (input, init) =>
    fetchImpl(input, {
      ...init,
      signal: AbortSignal.any([...deadlines, ...(init?.signal ? [init.signal] : [])]),
    });
}

/** Duas etapas de IA no máximo; dados estruturados válidos evitam outra chamada paga. */
export async function answerWeatherWithRecovery(
  conversation: ChatMessage[],
  options: OpenAIOptions,
  location: string,
  intelligence: WeatherIntelligence | null,
  deps: WeatherResponseDependencies = {},
): Promise<string> {
  // Fontes estruturadas já foram consultadas; reserve tempo para entregar antes do webhook expirar.
  const whatsapp = options.channel === "whatsapp";
  const deadline = AbortSignal.timeout(whatsapp ? 45_000 : 120_000);
  const firstDeadline = AbortSignal.timeout(whatsapp ? 20_000 : 45_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const userText = [...conversation].reverse().find((m) => m.role === "user")?.content ?? "";
  const analysis =
    intelligence?.analysis ?? analyzeWeatherRequest(userText, (deps.now ?? Date.now)());
  const window =
    intelligence?.timeWindow ??
    resolveWeatherTimeWindow(analysis, "America/Sao_Paulo", (deps.now ?? Date.now)());
  const requestedDates = analysis.requestedDates?.length
    ? analysis.requestedDates
    : analysis.dayOffsets?.length || analysis.dayOffset !== null
      ? [...new Set([window.startDate, window.endDate])]
      : [];
  const valid = (reply: string) => validateWeatherGrounding(reply, location, requestedDates).valid;
  const format = (reply: string) => formatReplyForUser(reply, userText);
  const fallback = intelligence ? format(renderWeatherFallbackReply(intelligence)) : null;
  const hasForecast =
    intelligence &&
    (intelligence.daily.length > 0 ||
      intelligence.dailyConsensus.length > 0 ||
      Boolean(intelligence.officialForecastText));

  try {
    const reply = format(
      await (deps.askAI ?? askTpecAI)(conversation, {
        ...options,
        model:
          options.researchDepth === "high" || analysis.depth === "deep" ? options.model : "luna",
        timeoutMs: whatsapp ? 20_000 : 45_000,
        fetchImpl: boundedFetch(fetchImpl, deadline, firstDeadline),
      }),
    );
    if (valid(reply)) return reply;
  } catch {
    // Os adapters registram falha/custo; preservar fontes válidas é mais barato que repetir IA.
  }
  if (fallback && (analysis.asksCurrent || hasForecast) && valid(fallback)) return fallback;

  try {
    // Pesquisa compatível com fontes: Perplexity primeiro, OpenAI com web_search como alternativa.
    // A recuperação também funciona quando o fluxo legado OpenAI está selecionado.
    const result = await (deps.research ?? orchestrateAI)(
      {
        message: userText,
        messages: conversation,
        context: options.context,
        summary: options.summary,
        state: options.state,
        directive: options.directive,
        sourcePolicy: `${options.sourcePolicy ?? ""}\nRECUPERAÇÃO METEOROLÓGICA: consulte agora fontes alternativas atuais para ${location}, período ${window.description}. Entregue temperatura e chuva para cada data solicitada, com fonte e data. Não ofereça pesquisar depois. Se uma fonte falhar, use outra fonte meteorológica reconhecida. Nunca invente previsão nem use climatologia como previsão.`,
        mode: "deep_research",
        webRequired: true,
        stage: "weather_recovery_research",
        skipSynthesis: true,
        maxOutputTokens: options.channel === "whatsapp" ? 1800 : 3000,
      },
      { fetchImpl: boundedFetch(fetchImpl, deadline) },
    );
    const reply = format(result.text);
    if (valid(reply)) return reply;
  } catch {
    // Orçamento de chamadas e prazo do orquestrador continuam limitando a recuperação.
  }

  const unavailable = `Para ${location}, no período ${window.description}, as fontes consultadas não confirmaram a previsão solicitada. Confira a previsão municipal e os avisos atualizados no portal do INMET (tempo.inmet.gov.br) antes de definir manejo ou transporte; informação histórica não deve ser usada como previsão desses dias.`;
  return fallback ? `${fallback}\n\n${unavailable}` : unavailable;
}
