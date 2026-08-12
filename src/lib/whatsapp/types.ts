import { z } from "zod";

export const WhatsAppChatInputSchema = z.object({
  phone: z.string().regex(/^\d{6,20}$/),
  messageId: z.string().min(1).max(128),
  text: z.string().min(1).max(2000),
});

export type WhatsAppChatInput = z.infer<typeof WhatsAppChatInputSchema>;

export const WhatsAppChatResultSchema = z.object({
  reply: z.string().optional(),
  duplicate: z.boolean().default(false),
  shouldSend: z.boolean().default(true),
});

export type WhatsAppChatResult = z.infer<typeof WhatsAppChatResultSchema>;
