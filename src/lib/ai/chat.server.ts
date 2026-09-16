import { askOpenAI, type OpenAIOptions } from "../chat/openai.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import { multimodelEnabled } from "./config.server.ts";
import { orchestrateAI } from "./orchestrator.server.ts";
import { selectAdaptiveModelRoute } from "../chat/model-router.ts";

const WHATSAPP_REPLY_DIRECTIVE =
  "CANAL WHATSAPP: responda de forma objetiva e prática. Prefira uma única mensagem com até 3.200 caracteres. Preserve cálculos, recomendação principal, modo de uso e alertas importantes; retire repetições e introduções longas.";

export function isSelfContainedCalculation(message: string): boolean {
  const text = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const explicitCalculation =
    /\b(calcule|calcular|calculo|gmd|ganho medio diario|custo total|custo por (?:animal|cabeca)|consumo total|ganho total|quanto (?:o lote|cada animal|cada cabeca|precisa|consome|custa))\b/.test(
      text,
    );
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
  const directive = [baseDirective, options.channel === "whatsapp" ? WHATSAPP_REPLY_DIRECTIVE : null]
    .filter(Boolean)
    .join("\n") || null;

  const result = await orchestrateAI(
    {
      message: currentUserMessage,
      messages: effectiveHistory,
      conversationContext: selfContainedCalculation ? "" : (options.context ?? ""),
      context: selfContainedCalculation ? null : options.context,
      summary: selfContainedCalculation ? null : options.summary,
      state: selfContainedCalculation ? null : options.state,
      directive,
      sourcePolicy: selfContainedCalculation
        ? "Use exclusivamente os dados fornecidos pelo usuário neste turno. Não faça pesquisa externa nem acrescente preços, produtos ou fatos atuais não solicitados."
        : options.sourcePolicy,
      mode: selfContainedCalculation
        ? "base"
        : options.researchDepth === "high"
          ? "deep_research"
          : options.model === "fast" || options.model === "luna" || tier === "luna"
            ? "quick"
            : "base",
      webRequired: selfContainedCalculation
        ? false
        : options.researchDepth === "medium" || options.researchDepth === "high",
      prohibitWeb: selfContainedCalculation ? true : options.researchDepth === "none",
      stage: selfContainedCalculation ? "calculation" : options.stage,
    },
    { fetchImpl: options.fetchImpl },
  );
  return result.text;
}
