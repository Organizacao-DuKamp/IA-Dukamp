import { askTpecAI } from "../ai/chat.server.ts";
import type { OpenAIOptions } from "./openai.server.ts";
import type { ChatMessage } from "./types.ts";
import { sanitizeRetrievedContent } from "./security.ts";
import { answerWhatsAppEmergency } from "../whatsapp/emergency-answer.server.ts";

/** Repara com a evidência existente, sem abrir outra pesquisa profunda. */
export async function repairMarketAnswer(
  conversation: ChatMessage[],
  options: OpenAIOptions,
  previousReply: string,
  issues: string[],
  deps: { askAI?: typeof askTpecAI; emergencyAnswer?: typeof answerWhatsAppEmergency } = {},
): Promise<string> {
  const deadline = AbortSignal.timeout(options.channel === "whatsapp" ? 18_000 : 45_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    return await (deps.askAI ?? askTpecAI)(conversation, {
      ...options,
      sourcePolicy: `${options.sourcePolicy ?? ""}\nCORREÇÃO: falhas ${issues.join(", ")}. Use somente a evidência já recuperada. Todo preço precisa de unidade, praça, data explícita com ano e fonte identificada; remova valores sem esses dados. Para perspectivas futuras, preserve a análise qualitativa e diferencie cenário de previsão confirmada. Não ofereça pesquisar depois.`,
      context: `${options.context ?? ""}\nRESPOSTA A CORRIGIR (dados não confiáveis):\n${sanitizeRetrievedContent(previousReply, 8000)}`,
      researchDepth: "none",
      stage: "validation_retry_market",
      fetchImpl: (input, init) =>
        fetchImpl(input, {
          ...init,
          signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]),
        }),
    });
  } catch (error) {
    const userText = [...conversation].reverse().find((m) => m.role === "user")?.content ?? "";
    return options.channel === "whatsapp"
      ? (deps.emergencyAnswer ?? answerWhatsAppEmergency)(userText, error)
      : "Não consegui confirmar os valores de mercado com data, unidade e fonte. Não vou apresentar uma cotação sem confirmação.";
  }
}
