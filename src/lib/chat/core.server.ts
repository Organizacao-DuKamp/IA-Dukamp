// Chat Core — channel-agnostic orchestration.
// 1) Sanitize + rate limit.
// 2) Run query router: structural answers short-circuit; product hints inject
//    a structured product block; explanatory queries fall through to RAG.
// 3) Ask Perplexity with the assembled context.

import { askPerplexity, PerplexityError } from "./perplexity.server";
import { checkRateLimit } from "./rate-limit.server";
import { productContextBlock, routeQuery } from "./query-router.server";
import {
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  type ChatMessage,
  type IncomingMessage,
} from "./types";

function sanitize(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

// Detects casual reactions/acknowledgments/greetings that should NOT be sent
// to Perplexity's grounded search model (which would turn "ah que legal" into
// a dictionary entry with citations). Returns a natural human reply, or null.
function detectSmallTalk(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/[!.?…]+$/g, "").replace(/\s+/g, " ");
  if (!t || t.length > 60) return null;

  // Greetings
  if (/^(oi|ol[aá]|e\s?a[ií]|opa|bom\s+dia|boa\s+tarde|boa\s+noite|hey|hi|hello)$/i.test(t)) {
    return "Oi! Sou a TPEC-IA, assistente da DuKamp. Como posso te ajudar hoje — dúvidas sobre produtos, manejo, vendedores ou preços?";
  }
  // Thanks
  if (/^(obrigad[ao]|valeu|vlw|thanks|obg|grat[oa])$/i.test(t)) {
    return "Por nada! Se precisar de mais alguma coisa, é só chamar.";
  }
  // Positive reactions
  if (/^(ah\s+)?(que\s+)?(legal|bacana|[óo]timo|show|massa|top|bom|dahora|maneiro|interessante|bem\s+legal|muito\s+bom)$/i.test(t) ||
      /^(nossa|uau|wow|caramba|s[eé]rio|puxa)$/i.test(t) ||
      /^ah\s+(sim|ok|entendi|legal|bacana)$/i.test(t)) {
    return "Que bom! 😊 Precisa de mais alguma coisa sobre os produtos DuKamp, manejo ou algum vendedor?";
  }
  // Acknowledgements
  if (/^(ok|okay|beleza|blz|certo|entendi|ciente|t[áa]\s+bom|t[áa]|sim|isso|perfeito)$/i.test(t)) {
    return "Combinado! Estou aqui se precisar de mais algo.";
  }
  // Farewells
  if (/^(tchau|at[eé]\s+mais|falou|flw|adeus|bye)$/i.test(t)) {
    return "Até mais! Qualquer dúvida sobre DuKamp, é só voltar. 👋";
  }
  return null;
}

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function handleIncoming(
  input: IncomingMessage,
): Promise<{ reply: string }> {
  const text = sanitize(input.text ?? "");
  if (!text) throw new ChatError("Mensagem vazia.", 400);
  if (text.length > MAX_MESSAGE_CHARS) {
    throw new ChatError(`Mensagem excede ${MAX_MESSAGE_CHARS} caracteres.`, 400);
  }

  const rl = checkRateLimit(input.sessionId || "anon");
  if (!rl.ok) {
    throw new ChatError(
      `Muitas mensagens em pouco tempo. Tente novamente em ${rl.retryAfterSec}s.`,
      429,
    );
  }

  const trimmedHistory: ChatMessage[] = (input.history ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.length <= MAX_MESSAGE_CHARS)
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: sanitize(m.content) }));

  // 0) Small-talk / reactions short-circuit — never send these to Perplexity
  // (its search model turns "ah que legal" into a dictionary definition with citations).
  const smallTalk = detectSmallTalk(text);
  if (smallTalk) return { reply: smallTalk };

  // 1) Router: structural = direct DB answer (no LLM).
  // Contextual follow-up: reuse the topic from the last turn so that short
  // messages like "quem são eles?" or "e em monte aprazível?" don't lose context.
  const trimmedText = text.trim();
  const isBareFollowUp = /^(quem\s+s[aã]o(\s+eles|\s+elas)?|quais\s+s[aã]o(\s+eles|\s+elas)?|me\s+diga(\s+os)?(\s+nomes?)?|diga(\s+os)?(\s+nomes?)?|os?\s+nomes?|liste(\s+eles|\s+elas)?|todos|todas)\s*[?.!]*$/i.test(trimmedText);
  // Region-only follow-up: "e em monte aprazivel?", "em rio preto?", "e no interior?"
  const regionFollowUp = trimmedText.match(/^(?:e\s+)?(?:em|no|na|nos|nas)\s+([a-zà-ú][a-zà-ú\s.'-]{2,60})\s*[?.!]*$/i);
  const lastAssistant = [...trimmedHistory].reverse().find((m) => m.role === "assistant");
  const lastUser = [...trimmedHistory].reverse().find((m) => m.role === "user");
  const prevBlob = ((lastAssistant?.content ?? "") + " " + (lastUser?.content ?? "")).toLowerCase();
  const prevTopic: "vendedores" | "categorias" | "produtos" | "unidades" | null =
    /vendedor|vendedores|representante/.test(prevBlob) ? "vendedores"
    : /unidade|filial|matriz|endere/.test(prevBlob) ? "unidades"
    : /categoria|categorias/.test(prevBlob) ? "categorias"
    : /produto|produtos|destaque/.test(prevBlob) ? "produtos"
    : null;

  let routerInput = text;
  if (isBareFollowUp) {
    if (prevTopic === "vendedores") routerInput = `liste todos os vendedores`;
    else if (prevTopic === "categorias") routerInput = `liste todas as categorias`;
    else if (prevTopic === "produtos") routerInput = `liste os produtos`;
  } else if (regionFollowUp && prevTopic) {
    const region = regionFollowUp[1].trim();
    const prevWasCount = /\b(quanto|quantos|quantas|quantidade|n[uú]mero|total)\b/i.test(lastUser?.content ?? "");
    const verb = prevWasCount ? "quantos" : "quais";
    if (prevTopic === "vendedores") routerInput = `${verb} vendedores em ${region}`;
    else if (prevTopic === "unidades") routerInput = `${verb} unidades em ${region}`;
    else if (prevTopic === "produtos") routerInput = `${verb} produtos em ${region}`;
    else if (prevTopic === "categorias") routerInput = `${verb} categorias em ${region}`;
  }

  let routed;
  try {
    routed = await routeQuery(routerInput);
  } catch (err) {
    console.error("[router] falhou:", err instanceof Error ? err.message : err);
    routed = { kind: "passthrough" as const };
  }
  if (routed.kind === "structural") {
    return { reply: routed.text };
  }

  // 2) Build context: structured product info (if any) + RAG passages + site data.
  const contextParts: string[] = [];
  if (routed.productHint) {
    contextParts.push(productContextBlock(routed.productHint.product));
  }

  // 2a) Site Dukamp lookups (commercial data: price, stock, sellers, categories).
  try {
    const { siteIntentHints, searchSiteProducts, listSiteSellers, findSellersByRegion, listSiteCategories, siteBlock } =
      await import("../site/site-lookup.server");
    const hints = siteIntentHints(text);
    const lookup: { products?: any[]; sellers?: any[]; categories?: string[] } = {};

    if (hints.price || routed.productHint) {
      const query = routed.productHint ? routed.productHint.product.official_name : text;
      const prods = await searchSiteProducts(query, 6);
      if (prods.length > 0) lookup.products = prods;
    }
    if (hints.seller) {
      const byRegion = await findSellersByRegion(text);
      lookup.sellers = byRegion.length > 0 ? byRegion : await listSiteSellers(20);
      if (byRegion.length > 0) {
        contextParts.push(
          `INSTRUÇÃO DE ATENDIMENTO (obrigatório): O usuário informou uma cidade/região e demonstrou intenção de compra. Recomende de forma DIRETA **um vendedor específico** da lista de vendedores acima que atende a região citada (escolha o primeiro da lista da mesma região), informando NOME e WhatsApp/telefone, e justifique em 1 frase (ex.: "porque atende sua região"). NÃO mande o usuário ligar para a matriz. NÃO explique detalhes técnicos do produto a menos que o usuário peça. Termine perguntando se pode ajudar com algo mais.`
        );
      }
    }
    if (hints.category) {
      lookup.categories = await listSiteCategories();
    }
    const block = siteBlock(lookup);
    if (block) contextParts.push(block);
  } catch (err) {
    console.error("[site] lookup falhou:", err instanceof Error ? err.message : err);
  }

  try {
    const { searchKnowledge } = await import("../rag/search.server");
    const matches = await searchKnowledge(text, 6);
    const good = matches.filter((m) => m.similarity >= 0.55);
    if (good.length > 0) {
      const rag = good
        .map(
          (m, i) =>
            `[${i + 1}]\n${m.content}`,
        )
        .join("\n\n---\n\n");
      contextParts.push(`TRECHOS TÉCNICOS DA BASE INTERNA (uso interno; NÃO cite fontes, nomes de arquivos, categorias ou porcentagens ao usuário):\n\n${rag}`);
    }
  } catch (err) {
    console.error("[RAG] busca falhou:", err instanceof Error ? err.message : err);
  }

  const contextBlock = contextParts.length > 0 ? contextParts.join("\n\n") : undefined;
  const conversation: ChatMessage[] = [...trimmedHistory, { role: "user", content: text }];

  try {
    const reply = await askPerplexity(conversation, contextBlock);
    return { reply };
  } catch (err) {
    if (err instanceof PerplexityError) throw new ChatError(err.message, err.status);
    throw new ChatError("Erro inesperado ao processar a mensagem.", 500);
  }
}
