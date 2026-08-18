import { z } from "zod";

export const ChatRoleSchema = z.enum(["user", "assistant", "system"]);
export const ChatChannelSchema = z.enum(["web", "whatsapp"]);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1).max(8000),
});

/** Payload compartilhado pelos transportes web, proxy e endpoint interno. */
export const ChatInputSchema = z.object({
  sessionId: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128).optional(),
  clientMessageId: z.string().min(1).max(128).optional(),
  channel: ChatChannelSchema.default("web"),
  text: z.string().min(1).max(2000),
  history: z.array(ChatMessageSchema).max(60).default([]),
  state: z.unknown().optional(),
});

export type ChatInput = z.infer<typeof ChatInputSchema>;

/** Resposta completa produzida por handleIncoming no backend privilegiado. */
export const ChatCoreResultSchema = z.object({
  reply: z.string(),
  state: z.unknown(),
  conversationId: z.string().min(1),
  diagnostics: z.unknown(),
});

export type ChatCoreResult = z.infer<typeof ChatCoreResultSchema>;

export const MAX_CHAT_PROXY_BODY_BYTES = 256 * 1024;
export const MAX_CHAT_PROXY_RESPONSE_BYTES = 1024 * 1024;
