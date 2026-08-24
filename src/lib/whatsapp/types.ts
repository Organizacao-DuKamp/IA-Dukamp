import { z } from "zod";

export const WhatsAppMediaSchema = z.object({
  id: z.string().min(1).max(256),
  type: z.enum(["audio", "image", "video", "document"]),
  mimeType: z.string().min(1).max(160),
  sha256: z.string().min(1).max(256).optional(),
  filename: z.string().min(1).max(255).optional(),
  caption: z.string().max(2000).optional(),
});

export type WhatsAppMedia = z.infer<typeof WhatsAppMediaSchema>;

export const WhatsAppChatInputSchema = z.object({
  phone: z.string().regex(/^\d{6,20}$/),
  messageId: z.string().min(1).max(128),
  text: z.string().min(1).max(2000),
  media: WhatsAppMediaSchema.optional(),
});

export type WhatsAppChatInput = z.infer<typeof WhatsAppChatInputSchema>;

export const WhatsAppChatResultSchema = z.object({
  reply: z.string().optional(),
  duplicate: z.boolean().default(false),
  shouldSend: z.boolean().default(true),
});

export type WhatsAppChatResult = z.infer<typeof WhatsAppChatResultSchema>;

export const WhatsAppControlRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("claim"),
    phone: z.string().regex(/^\d{6,20}$/),
    messageId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("complete"),
    messageId: z.string().min(1).max(128),
    reply: z.string().min(1).max(12_000),
  }),
  z.object({
    action: z.literal("release"),
    messageId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("claim_presence"),
    messageId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("claim_delivery"),
    messageId: z.string().min(1).max(128),
  }),
  z.object({
    action: z.literal("delivered"),
    messageId: z.string().min(1).max(128),
    reply: z.string().min(1).max(12_000),
  }),
  z.object({
    action: z.literal("release_delivery"),
    messageId: z.string().min(1).max(128),
    reply: z.string().min(1).max(12_000),
  }),
]);

export type WhatsAppControlRequest = z.infer<typeof WhatsAppControlRequestSchema>;

export const WhatsAppControlResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("claimed"), reply: z.string().optional() }),
  z.object({ kind: z.literal("completed"), reply: z.string() }),
  z.object({ kind: z.literal("processing") }),
  z.object({ kind: z.literal("delivered") }),
  z.object({ kind: z.literal("missing") }),
  z.object({ kind: z.literal("ok") }),
]);

export type WhatsAppControlResult = z.infer<typeof WhatsAppControlResultSchema>;
