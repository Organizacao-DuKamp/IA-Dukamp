// Domain types shared between Chat Core and channel adapters.
// Kept free of runtime dependencies so both client (WebChatAdapter) and
// server (Perplexity service, future WhatsAppAdapter) can import them.

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface IncomingMessage {
  /** Stable id of the end-user in the channel (session id on web, phone on WhatsApp). */
  sessionId: string;
  /** Raw user text. Chat Core will validate/sanitize. */
  text: string;
  /** Prior turns for this session (channel keeps ephemeral context only). */
  history: ChatMessage[];
}

export interface OutgoingMessage {
  sessionId: string;
  text: string;
}

/**
 * ChannelAdapter — contract every channel (web, WhatsApp, etc.) must fulfill.
 * Implementations translate channel-specific payloads into IncomingMessage
 * and deliver OutgoingMessage back to the user.
 */
export interface ChannelAdapter {
  readonly name: string;
  send(message: OutgoingMessage): Promise<void> | void;
}

export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_TURNS = 20;
