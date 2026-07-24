// Server function exposed to the WebChatAdapter (browser).
// Future WhatsAppAdapter would live in src/routes/api/public/whatsapp.ts
// and call the same handleIncoming() from core.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RoleSchema = z.enum(["user", "assistant", "system"]);
const MessageSchema = z.object({
  role: RoleSchema,
  // Assistant replies (fichas técnicas, listagens) podem ultrapassar 2000 chars
  // quando voltam no histórico. Aceitamos até 8000 aqui; o core trunca depois.
  content: z.string().min(1).max(8000),
});

const InputSchema = z.object({
  sessionId: z.string().min(1).max(128),
  text: z.string().min(1).max(2000),
  history: z.array(MessageSchema).max(40).default([]),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { handleIncoming } = await import("./chat/core.server");
    const { ChatError } = await import("./chat/core.server");
    try {
      return await handleIncoming(data);
    } catch (err) {
      if (err instanceof ChatError) {
        return { error: err.message, status: err.status } as const;
      }
      return { error: "Erro inesperado.", status: 500 } as const;
    }
  });
