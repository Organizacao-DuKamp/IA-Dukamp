// WebChatAdapter — browser-side ChannelAdapter implementation.
// Wraps the server function so the UI stays channel-agnostic.
// Keeps history ONLY in memory of the current tab (no localStorage, no cookies).

import { sendChatMessage } from "../chat.functions";
import type { ChannelAdapter, ChatMessage, OutgoingMessage } from "./types";

export class WebChatAdapter implements ChannelAdapter {
  readonly name = "web";
  private sessionId: string;
  private onDeliver?: (m: OutgoingMessage) => void;

  constructor(onDeliver?: (m: OutgoingMessage) => void) {
    this.sessionId = generateSessionId();
    this.onDeliver = onDeliver;
  }

  getSessionId() {
    return this.sessionId;
  }

  resetSession() {
    this.sessionId = generateSessionId();
  }

  async ask(text: string, history: ChatMessage[]): Promise<{ reply: string }> {
    const result = (await sendChatMessage({
      data: { sessionId: this.sessionId, text, history },
    })) as { reply?: string; error?: string; status?: number };
    if (result.error) throw new Error(result.error);
    const reply = result.reply ?? "";
    this.send({ sessionId: this.sessionId, text: reply });
    return { reply };
  }

  send(message: OutgoingMessage) {
    this.onDeliver?.(message);
  }
}

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
