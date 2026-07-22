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

export async function handleIncoming(input: IncomingMessage): Promise<{ reply: string }> {
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

  const conversation: ChatMessage[] = [...trimmedHistory, { role: "user", content: text }];

  try {
    const reply = await askPerplexity(conversation);
    return { reply };
  } catch (err) {
    if (err instanceof PerplexityError) throw new ChatError(err.message, err.status);
    throw new ChatError("Erro inesperado ao processar a mensagem.", 500);
  }
}
