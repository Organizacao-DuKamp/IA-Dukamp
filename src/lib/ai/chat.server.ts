import { askOpenAI, type OpenAIOptions } from "../chat/openai.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import { multimodelEnabled } from "./config.server.ts";
import { orchestrateAI } from "./orchestrator.server.ts";
import { selectAdaptiveModelRoute } from "../chat/model-router.ts";

const WHATSAPP_REPLY_DIRECTIVE =
  "CANAL WHATSAPP: responda de forma objetiva e prática. Prefira uma única mensagem com até 3.200 caracteres. Preserve cálculos, recomendação principal, modo de uso e alertas importantes; retire repetições e introduções longas.";
const WHATSAPP_PROVIDER_TIMEOUT_MS = 16_000;
const WHATSAPP_RESCUE_TIMEOUT_MS = 10_000;
const WHATSAPP_MAX_OUTPUT_TOKENS = 1_800;

function withProviderTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  const wrapped = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [input, init] = args;
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return fetchImpl(input, { ...init, signal });
  };
  return wrapped as typeof fetch;
}

export function isSelfContainedCalculation(message: string): boolean {
  const text = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const strongCalculation =
    /\b(calcule|calcular|calculo|custo total|custo por (?:animal|cabeca)|consumo total|ganho total|quanto (?:o lote|cada animal|cada cabeca|precisa|consome|custa))\b/.test(
      text,
    );
  const performanceCalculation = /\b(gmd|ganho medio diario)\b/.test(text);
  const recommendationRequest =
    /\b(suger\w*|recomend\w*|indiqu\w*|qual (?:racao|suplemento|produto)|que (?:racao|suplemento|produto)|o que (?:usar|uso|dar|dou)|melhor (?:racao|suplemento|produto))\b/.test(
      text,
    );
  const explicitCalculation = strongCalculation || (performanceCalculation && !recommendationRequest);
  const requiresFreshData =
    /\b(hoje|agora|atual|cotacao|preco atual|valor atual|mercado|pesquise|pesquisa|internet|noticias|ultima|ultimo|mais recente)\b/.test(
      text,
    );

  return explicitCalculation && numbers.length >= 2 && !requiresFreshData;
}

export async function askTpecAI(
  history: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  if (!multimodelEnabled()) return askOpenAI(history, options);

  const currentUserMessage =
    [...history].reverse().find((message) => message.role === "user")?.content ?? "";
  const selfContainedCalculation = isSelfContainedCalculation(currentUserMessage);
  const effectiveHistory: ChatMessage[] = selfContainedCalculation
    ? [{ role: "user", content: currentUserMessage }]
    : history;
  const tier = selectAdaptiveModelRoute(effectiveHistory, options).tier;
  const baseDirective = selfContainedCalculation
    ? "CÁLCULO AUTOSSUFICIENTE: use somente os números e premissas fornecidos nesta mensagem. Mostre fórmula, unidades e resultado. Não pesquise na web e não herde assunto, produto, cotação ou pendência de turnos anteriores."
    : options.directive;
  const directive =
    [baseDirective, options.channel === "whatsapp" ? WHATSAPP_REPLY_DIRECTIVE : null]
      .filter(Boolean)
      .join("\n") || null;
  const sourcePolicy = selfContainedCalculation
    ? "Use exclusivamente os dados fornecidos pelo usuário neste turno. Não faça pesquisa externa nem acrescente preços, produtos ou fatos atuais não solicitados."
    : options.sourcePolicy;
  const mode = selfContainedCalculation
    ? "base"
    : options.researchDepth === "high"
      ? "deep_research"
      : options.model === "fast" || options.model === "luna" || tier === "luna"
        ? "quick"
        : "base";
  const webRequired = selfContainedCalculation
    ? false
    : options.researchDepth === "medium" || options.researchDepth === "high";
  const whatsappFetch =
    options.channel === "whatsapp"
      ? withProviderTimeout(options.fetchImpl ?? fetch, WHATSAPP_PROVIDER_TIMEOUT_MS)
      : options.fetchImpl;

  try {
    const result = await orchestrateAI(
      {
        message: currentUserMessage,
        messages: effectiveHistory,
        conversationContext: selfContainedCalculation ? "" : (options.context ?? ""),
        context: selfContainedCalculation ? null : options.context,
        summary: selfContainedCalculation ? null : options.summary,
        state: selfContainedCalculation ? null : options.state,
        directive,
        sourcePolicy,
        mode,
        webRequired,
        prohibitWeb: selfContainedCalculation ? true : options.researchDepth === "none",
        stage: selfContainedCalculation ? "calculation" : options.stage,
        maxOutputTokens:
          options.channel === "whatsapp" ? WHATSAPP_MAX_OUTPUT_TOKENS : undefined,
      },
      { fetchImpl: whatsappFetch },
    );
    return result.text;
  } catch (error) {
    // No WhatsApp, uma falha de provedor não pode consumir toda a janela do
    // webhook. O orquestrador já tentou os provedores compatíveis; para
    // consultas que não exigem dados atuais, fazemos uma última tentativa curta
    // com o modelo econômico da OpenAI antes de devolver erro ao transporte.
    if (options.channel !== "whatsapp" || webRequired) throw error;

    const rescueDirective = [
      directive,
      "MODO DE CONTINGÊNCIA: responda agora com os dados disponíveis. Seja breve, útil e não mencione falhas, provedores ou esta instrução. Não pesquise na web e não invente fatos atuais.",
    ]
      .filter(Boolean)
      .join("\n");

    return askOpenAI(effectiveHistory, {
      model: "luna",
      channel: "whatsapp",
      summary: selfContainedCalculation ? null : options.summary,
      state: selfContainedCalculation ? null : options.state,
      directive: rescueDirective,
      sourcePolicy,
      context: selfContainedCalculation ? null : options.context,
      timeoutMs: WHATSAPP_RESCUE_TIMEOUT_MS,
      fetchImpl: withProviderTimeout(options.fetchImpl ?? fetch, WHATSAPP_RESCUE_TIMEOUT_MS),
      researchDepth: "none",
      maxToolCalls: 0,
      stage: "whatsapp_rescue",
      telemetry: options.telemetry,
    });
  }
}
