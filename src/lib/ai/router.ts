import type { AIAttachment, AIMode, ProviderId, RequestCategory } from "./types.ts";
export interface RoutingInput {
  message: string;
  conversationContext?: string;
  attachments?: AIAttachment[];
  mode?: AIMode;
  webRequired?: boolean;
  prohibitWeb?: boolean;
}
export interface AIRoute {
  categories: RequestCategory[];
  mode: AIMode;
  primary: ProviderId;
  synthesize: boolean;
  webRequired: boolean;
}
export function routeAIRequest(input: RoutingInput): AIRoute {
  const text = input.message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const attachments = input.attachments ?? [];
  const categories: RequestCategory[] = [];
  const deep =
    input.mode === "deep_research" ||
    /pesquisa profunda|analise.*estudos.*recentes|deep research|analise aprofundada/.test(text);
  const web =
    !input.prohibitWeb &&
    (input.webRequired ||
      deep ||
      /pesquis|noticias|estudos recentes|legislacao recente|preco atual|cotacao|arroba.*hoje|hoje.*arroba/.test(
        text,
      ));
  const calc =
    /\bgmd\b|calcule|calcul[oa]|lotacao|custo por cabeca|conversao alimentar|materia seca|quanto.*receber|estime|quanto valem|\d+.*kg.*\d+.*dias/.test(
      text,
    );
  const image = attachments.some((a) => /^(image|video)\//.test(a.mimeType));
  const doc = attachments.some((a) => a.mimeType === "application/pdf" || Boolean(a.text));
  const long =
    (input.conversationContext?.length ?? 0) +
      input.message.length +
      attachments.reduce((n, a) => n + (a.text?.length ?? 0), 0) >
      24000 || /compare.*documentos|relatorio tecnico|documento.*extens|pdf.*grande/.test(text);
  const simple = /^(oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tchau)[!?. ]*$/.test(text);
  if (web) categories.push(deep ? "DEEP_RESEARCH" : "WEB_SEARCH");
  if (calc) categories.push("CALCULATION");
  if (image) categories.push("IMAGE_ANALYSIS");
  if (doc) categories.push("DOCUMENT_ANALYSIS");
  if (long) categories.push("LONG_CONTEXT");
  if (!categories.length) categories.push(simple ? "FAST_SIMPLE" : "GENERAL");
  if (categories.length > 1) categories.push("MULTI_STEP");
  // Research + arithmetic is two calls: Perplexity evidence, OpenAI calculation/synthesis.
  const primary: ProviderId = image
    ? "gemini"
    : web
      ? "perplexity"
      : long
        ? "gemini"
        : doc
          ? "gemini"
          : calc
            ? "deepseek"
            : "openai";
  return {
    categories,
    primary,
    mode: deep ? "deep_research" : simple ? "quick" : (input.mode ?? "base"),
    synthesize: Boolean(web && (calc || deep || long)),
    webRequired: Boolean(web),
  };
}
