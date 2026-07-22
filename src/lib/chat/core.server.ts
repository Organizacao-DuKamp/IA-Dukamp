// Chat Core — channel-agnostic orchestration.
// Validates input, enforces limits, calls the AI service, returns a reply.
// Adapters (WebChatAdapter, future WhatsAppAdapter) call handleIncoming().

import { askPerplexity, PerplexityError } from "./perplexity.server";
import { checkRateLimit } from "./rate-limit.server";
import {
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_CHARS,
  type ChatMessage,
  type IncomingMessage,
} from "./types";

function sanitize(text: string): string {
  // Trim, collapse excessive whitespace, strip control chars.
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

export interface ChatSource {
  title: string;
  category: string;
  subcategory: string | null;
  similarity: number;
}

export async function handleIncoming(
  input: IncomingMessage,
): Promise<{ reply: string; sources: ChatSource[] }> {
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

  // Keep only recent turns; never persist.
  const trimmedHistory: ChatMessage[] = (input.history ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.length <= MAX_MESSAGE_CHARS)
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: sanitize(m.content) }));

  // RAG: retrieve relevant chunks from the knowledge base.
  let contextBlock: string | undefined;
  let sources: ChatSource[] = [];
  try {
    const { searchKnowledge } = await import("../rag/search.server");
    const matches = await searchKnowledge(text, 6);
    const good = matches.filter((m) => m.similarity >= 0.55);
    if (good.length > 0) {
      contextBlock = good
        .map(
          (m, i) =>
            `[${i + 1}] Fonte: ${m.title} (${m.category}${m.subcategory ? " / " + m.subcategory : ""})\n${m.content}`,
        )
        .join("\n\n---\n\n");
      sources = good.map((m) => ({
        title: m.title,
        category: m.category,
        subcategory: m.subcategory,
        similarity: m.similarity,
      }));
    }
  } catch (err) {
    // Do not fail the chat if the KB is unavailable.
    console.error("[RAG] busca falhou:", err instanceof Error ? err.message : err);
  }

  const conversation: ChatMessage[] = [...trimmedHistory, { role: "user", content: text }];

  try {
    const reply = await askPerplexity(conversation, contextBlock);
    return { reply, sources };
  } catch (err) {
    if (err instanceof PerplexityError) throw new ChatError(err.message, err.status);
    throw new ChatError("Erro inesperado ao processar a mensagem.", 500);
  }
}
