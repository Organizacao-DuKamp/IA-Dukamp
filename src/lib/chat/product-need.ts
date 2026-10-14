import type { ChatMessage } from "./types.ts";
import { shouldSkipGenericProductLookup } from "./product-routing-guard.ts";

function norm(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
const PRODUCT_CONTEXT =
  /\b(?:produto|marca|suplement\w*|proteinado|proteico|mineral|racao|sal|nucleo|concentrado|engord\w*|ganho de peso|gmd|recria|cria|confinamento|pasto|pastagem|volumoso|bagaco|bagacinho|bezerro\w*|nelore|bois?|vaca\w*|novilha\w*|gado|bovino\w*|ovino\w*|ovelha\w*|cavalo\w*|equino\w*|leite|cerca|arame|utensilio\w*|adubo|semente\w*|fertilizante|dukamp)\b/;
const RECOMMEND =
  /\b(?:recomend\w*|indic(?:a|ar|aria|acao|acoes|am|e|o)|suger\w*|sugest\w*|qual (?:a )?marca|que marca|melhor (?:produto|marca|suplemento|racao)|o que (?:usar|dar|comprar))\b/;
const GOAL_REQUEST =
  /\b(?:quero|quiser|preciso|presciso|procuro|busco)\b.{0,100}\b(?:gmd|ganho medio diario|engord\w*|suplement\w*|proteinado|proteico|racao|mineral|ganhar peso|produto|cerca|arame|utensilio\w*|adubo|semente\w*|fertilizante)\b/;
const CONTEXT_CHANGE =
  /\b(?:mudando de assunto|outro assunto|previsao|vai chover|cotacao|mercado do boi|titulo de eleitor|programacao|impressora)\b/;
const ACK = /^(?:sim|nao|ok|entendi|hmm+|obrigad[oa]|valeu|bom dia|boa tarde|boa noite)[!.? ]*$/;
const SPECIES_CONTEXT = [
  /\b(?:bovino\w*|gado|bois?|vaca\w*|nelore|bezerro\w*)\b/,
  /\b(?:ovino\w*|ovelha\w*|carneiro\w*)\b/,
  /\b(?:caprino\w*|cabra\w*|bode\w*)\b/,
  /\b(?:equino\w*|cavalo\w*|egua\w*|potro\w*)\b/,
];

export function isProductRecommendationRequest(text: string): boolean {
  const normalized = norm(text);
  return RECOMMEND.test(normalized) || GOAL_REQUEST.test(normalized);
}

export interface ProductNeed {
  active: boolean;
  query: string;
  needsClarification: boolean;
}

/** Recupera a necessidade dos turnos do usuário; sugestões anteriores da IA não são evidência. */
export function resolveProductNeed(text: string, history: ChatMessage[] = []): ProductNeed {
  const current = norm(text);
  const none = { active: false, query: text, needsClarification: false };
  if (shouldSkipGenericProductLookup(text) || CONTEXT_CHANGE.test(current) || ACK.test(current))
    return none;
  if (!isProductRecommendationRequest(text)) return none;

  const userContext: string[] = [];
  let selectedSpecies = SPECIES_CONTEXT.filter((pattern) => pattern.test(current));
  let anchoredMessages = 0;
  const currentIsSpecific =
    PRODUCT_CONTEXT.test(current.replace(/\b(?:marca|produto|dukamp)\b/g, "")) ||
    /\bmarca de\s+\S+/.test(current);
  // Novo produto explícito não herda uma categoria animal de outro assunto.
  const newNonAnimalTopic = /\b(?:cerca|arame|utensilio|adubo|semente|fertilizante)\b/.test(
    current,
  );
  if (!newNonAnimalTopic) {
    for (const message of [...history].reverse()) {
      if (message.role !== "user") continue;
      const normalized = norm(message.content);
      if (CONTEXT_CHANGE.test(normalized)) break;
      if (ACK.test(normalized)) continue;
      const pastSpecies = SPECIES_CONTEXT.filter((pattern) => pattern.test(normalized));
      if (
        selectedSpecies.length &&
        pastSpecies.length &&
        !pastSpecies.some((pattern) => selectedSpecies.includes(pattern))
      ) {
        userContext.splice(0, Math.max(0, userContext.length - anchoredMessages));
        break;
      }
      if (!selectedSpecies.length) selectedSpecies = pastSpecies;
      if (
        !PRODUCT_CONTEXT.test(normalized) &&
        !/^\d+(?:[.,]\d+)?(?:\s*(?:kg|quilos|cabecas|animais|dias))?[!.? ]*$/.test(normalized)
      ) {
        if (!userContext.length) break;
        continue;
      }
      userContext.unshift(message.content.slice(0, 400));
      if (pastSpecies.length) anchoredMessages = userContext.length;
      if (userContext.length >= 6) break;
    }
  }
  const context = userContext.join("\n");
  const hasNeed = currentIsSpecific || PRODUCT_CONTEXT.test(norm(context));
  return {
    active: true,
    query: hasNeed ? `${context}\n${text}`.trim().slice(-2400) : text,
    needsClarification: !hasNeed,
  };
}
