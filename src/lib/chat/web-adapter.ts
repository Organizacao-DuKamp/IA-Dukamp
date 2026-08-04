// WebChatAdapter — browser-side ChannelAdapter implementation.
// Mantém conversation_id estável, o estado estruturado da conversa e o
// histórico persistidos em localStorage (só neste navegador), para que um
// reload não perca o contexto nem a confirmação pendente.

import type { ChannelAdapter, ChatMessage, OutgoingMessage } from "./types";

const STORAGE_KEY = "tpec-ia:conversation:v1";

export interface PersistedConversation {
  conversationId: string;
  sessionId: string;
  messages: Array<ChatMessage & { id: string }>;
  state: string | null;
  updatedAt: string;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function loadConversation(): PersistedConversation {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedConversation;
        if (parsed?.conversationId && Array.isArray(parsed.messages)) {
          return { ...parsed, sessionId: parsed.sessionId || parsed.conversationId };
        }
      }
    } catch {
      /* storage corrompido: começa nova conversa */
    }
  }
  const id = newId();
  return {
    conversationId: id,
    sessionId: id,
    messages: [],
    state: null,
    updatedAt: new Date().toISOString(),
  };
}

export function saveConversation(conv: PersistedConversation) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...conv, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota cheia: ignora, a conversa segue em memória */
  }
}

export function clearConversation() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

type PublicChatResponse = {
  reply?: string;
  error?: string;
  code?: string;
  state?: string;
  conversationId?: string;
};

export class WebChatAdapter implements ChannelAdapter {
  readonly name = "web";
  private conversationId: string;
  private sessionId: string;
  private state: string | null;
  private onDeliver?: (m: OutgoingMessage) => void;

  constructor(conv: PersistedConversation, onDeliver?: (m: OutgoingMessage) => void) {
    this.conversationId = conv.conversationId;
    this.sessionId = conv.sessionId;
    this.state = conv.state;
    this.onDeliver = onDeliver;
  }

  getConversationId() {
    return this.conversationId;
  }
  getSessionId() {
    return this.sessionId;
  }
  getState() {
    return this.state;
  }

  resetSession() {
    const id = newId();
    this.conversationId = id;
    this.sessionId = id;
    this.state = null;
    clearConversation();
  }

  async ask(
    text: string,
    history: ChatMessage[],
    clientMessageId: string,
  ): Promise<{ reply: string; state: string | null }> {
    const response = await fetch("/api/public/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        conversationId: this.conversationId,
        clientMessageId,
        text,
        history,
        state: this.state ? safeParse(this.state) : undefined,
      }),
    });

    let result: PublicChatResponse;
    try {
      result = (await response.json()) as PublicChatResponse;
    } catch {
      throw new Error("O servidor retornou uma resposta inválida.");
    }
    if (!response.ok || result.error) {
      throw new Error(result.error || "Erro ao consultar a IA.");
    }

    const reply = result.reply ?? "";
    if (result.state) this.state = result.state;
    if (result.conversationId) this.conversationId = result.conversationId;
    this.send({ sessionId: this.sessionId, text: reply });
    return { reply, state: this.state };
  }

  send(message: OutgoingMessage) {
    this.onDeliver?.(message);
  }
}
