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

  // 1) Router: structural = direct DB answer (no LLM).
  let routed;
  try {
    routed = await routeQuery(text);
  } catch (err) {
    console.error("[router] falhou:", err instanceof Error ? err.message : err);
    routed = { kind: "passthrough" as const };
  }
  if (routed.kind === "structural") {
    return { reply: routed.text };
  }

  // 2) Build context: structured product info (if any) + RAG passages.
  const contextParts: string[] = [];
  if (routed.productHint) {
    contextParts.push(productContextBlock(routed.productHint.product));
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
