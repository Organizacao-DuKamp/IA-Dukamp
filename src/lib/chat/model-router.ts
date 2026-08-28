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
  return (
    [...history]
      .reverse()
      .find((message) => message.role === "user")
      ?.content?.trim() ?? ""
  );
}

function isCorrection(sourcePolicy: string): boolean {
  return /CORREÇÃO (?:OBRIGATÓRIA|METEOROLÓGICA|COMERCIAL)/i.test(sourcePolicy);
}

const DOMAIN_OR_RESEARCH_RE =
  /\b(?:pecu[aá]ria|gado|boi|vaca|novilha|bezerro|animal|ra[cç][aã]o|suplement\w*|mineral|proteinad\w*|pastagem|pasto|confinament\w*|reprodu[cç][aã]o|sanidade|veterin\w*|produto|pre[cç]o|valor|estoque|dukamp|cat[aá]logo|vendedor\w*|mercado|cota[cç][aã]o|clima|tempo|previs[aã]o|chuva|temperatura|pesquis\w*|an[aá]ise|calcul\w*|dieta|fonte\w*|legisla[cç][aã]o|regulament\w*)\b/i;
const CASUAL_CONVERSATION_RE =
  /^(?:oi|ol[aá]|opa|e\s*a[ií]|bom\s+dia|boa\s+tarde|boa\s+noite|hey|hi|hello|obrigad\w*|valeu|vlw|tchau|falou|at[eé]\s+mais|tudo\s+(?:bem|certo)(?:\s+(?:com\s+voc[eê]|por\s+a[ií]))?|como\s+(?:voc[eê]|voc[eê]\s+est[aá])|e\s+voc[eê]|estou\s+(?:bem|tranquilo)|qual\s+[ée]\s+seu\s+nome|quem\s+[ée]\s+voc[eê]|podemos\s+conversar|vamos\s+conversar|o\s+que\s+voc[eê]\s+acha(?:\s+disso)?|tudo\s+tranquilo)[!.?…\s]*$/i;

export function isConversationalTurn(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, " ");
  const clauses = normalized
    .split(/[!?]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  return (
    normalized.length <= 180 &&
    !DOMAIN_OR_RESEARCH_RE.test(normalized) &&
    clauses.length > 0 &&
    clauses.length <= 3 &&
    clauses.every((clause) => CASUAL_CONVERSATION_RE.test(clause))
  );
}

function isLightweightTurn(text: string, sourcePolicy: string): boolean {
  // A política do core é o sinal mais seguro. Respostas como "sim", "não" e
  // "ok" podem confirmar uma pergunta anterior e, por isso, não são baratas
  // automaticamente sem o contexto do turno.
  if (/CONVERSA CASUAL|CLIMA SEM LOCALIZAÇÃO/i.test(sourcePolicy)) return true;
  return isConversationalTurn(text);
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
