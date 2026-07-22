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
  // Contextual follow-up: bare pronouns ("quem são eles?", "quais são?", "me diga os nomes")
  // reuse the topic from the last assistant message.
  const isBareFollowUp = /^(quem\s+s[aã]o(\s+eles|\s+elas)?|quais\s+s[aã]o(\s+eles|\s+elas)?|me\s+diga(\s+os)?(\s+nomes?)?|diga(\s+os)?(\s+nomes?)?|os?\s+nomes?|liste(\s+eles|\s+elas)?|todos|todas)\s*[?.!]*$/i.test(text.trim());
  let routerInput = text;
  if (isBareFollowUp) {
    const lastAssistant = [...trimmedHistory].reverse().find((m) => m.role === "assistant");
    const prev = lastAssistant?.content.toLowerCase() ?? "";
    if (/vendedor|vendedores|representante/.test(prev)) routerInput = `liste todos os vendedores`;
    else if (/categoria|categorias/.test(prev)) routerInput = `liste todas as categorias`;
    else if (/produto|produtos|destaque/.test(prev)) routerInput = `liste os produtos`;
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
