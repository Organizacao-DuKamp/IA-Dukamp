// Server function mantida por compatibilidade com integrações existentes.
// A UI web usa /api/public/chat para preservar o status HTTP do backend.

import { createServerFn } from "@tanstack/react-start";
import { ChatInputSchema } from "./chat/input";

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ChatInputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // A decisão local/proxy ocorre antes de qualquer import do core privilegiado.
      const { dispatchChat } = await import("./chat/backend.server");
      const result = await dispatchChat(data);
      if (result.status < 200 || result.status >= 300) {
        const body = result.body as { error?: string; code?: string };
        return {
          error: body.error ?? "Erro ao consultar a IA.",
          code: body.code,
          status: result.status,
        } as const;
      }
      const body = result.body as {
        reply: string;
        conversationId: string;
        state: unknown;
      };
      return {
        reply: body.reply,
        conversationId: body.conversationId,
        state: JSON.stringify(body.state),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      return { error: message, status: 500 } as const;
    }
  });
