import type { ChatMessage } from "./types.ts";

export type AdaptiveModelTier = "luna" | "terra" | "sol";
export type AdaptiveReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface AdaptiveRouteOptions {
  sourcePolicy?: string | null;
  context?: string | null;
  researchDepth?: "none" | "medium" | "high";
  reasoningEffort?: AdaptiveReasoningEffort;
}

export interface AdaptiveModelRoute {
  tier: AdaptiveModelTier;
  reasoningEffort: AdaptiveReasoningEffort;
  reason: string;
  escalated: boolean;
}

function lastUserText(history: ChatMessage[]): string {
  return [...history].reverse().find((message) => message.role === "user")?.content?.trim() ?? "";
}

function isCorrection(sourcePolicy: string): boolean {
  return /CORREÇÃO (?:OBRIGATÓRIA|METEOROLÓGICA|COMERCIAL)/i.test(sourcePolicy);
}

function isLightweightTurn(text: string, sourcePolicy: string): boolean {
  if (/CONVERSA CASUAL|CLIMA SEM LOCALIZAÇÃO/i.test(sourcePolicy)) return true;
  if (text.length > 90) return false;
  return /^(?:oi|ol[aá]|opa|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|vlw|ok|beleza|entendi|show|top|tchau|falou|sim|n[aã]o)[!.?\s]*$/i.test(
    text,
  );
}

function needsFrontierReasoning(text: string): boolean {
  return /\b(?:diagn[oó]stico diferencial|dose|dosagem|medicamento|antibi[oó]tico|intoxica[cç][aã]o|convuls|mortalidade|surto cl[ií]nico|protocolo terap[eê]utico|calcule|c[aá]lculo|dimensione|formule|balanceie|formula[cç][aã]o de dieta|simule|otimize|compare cen[aá]rios|an[aá]lise aprofundada|aprofundadamente|estrat[eé]gia complexa)\b/i.test(
    text,
  );
}

function isMediaAnalysis(text: string): boolean {
  return /\b(?:analise|interprete|avalie)\b.{0,50}\b(?:imagem|foto|documento|pdf|[aá]udio|v[ií]deo)\b/i.test(
    text,
  );
}

/**
 * Roteamento local e determinístico: evita gastar uma chamada adicional de LLM
 * apenas para descobrir qual modelo chamar. O modelo barato atende turnos leves,
 * Terra resolve a maior parte do trabalho e Sol fica reservado para tarefas em
 * que capacidade extra tem ganho de qualidade mensurável.
 */
export function selectAdaptiveModelRoute(
  history: ChatMessage[],
  options: AdaptiveRouteOptions = {},
): AdaptiveModelRoute {
  const text = lastUserText(history);
  const sourcePolicy = options.sourcePolicy ?? "";
  const context = options.context ?? "";
  const explicitEffort = options.reasoningEffort;

  if (isCorrection(sourcePolicy)) {
    return {
      tier: "sol",
      reasoningEffort: explicitEffort ?? "high",
      reason: "validation_correction",
      escalated: true,
    };
  }

  if (options.researchDepth === "high" || /DEPTH:\s*high/i.test(context)) {
    return {
      tier: "sol",
      reasoningEffort: explicitEffort ?? "high",
      reason: "deep_research",
      escalated: true,
    };
  }

  if (needsFrontierReasoning(text) || isMediaAnalysis(text)) {
    return {
      tier: "sol",
      reasoningEffort: explicitEffort ?? "medium",
      reason: isMediaAnalysis(text) ? "media_analysis" : "complex_reasoning",
      escalated: false,
    };
  }

  if (isLightweightTurn(text, sourcePolicy)) {
    return {
      tier: "luna",
      reasoningEffort: explicitEffort ?? "low",
      reason: "lightweight_turn",
      escalated: false,
    };
  }

  return {
    tier: "terra",
    reasoningEffort: explicitEffort ?? "medium",
    reason: /CHATGPT_WEB_SEARCH_REQUIRED/i.test(context) ? "current_research" : "default_balanced",
    escalated: false,
  };
}
