// Server function mantida por compatibilidade com integrações existentes.
// A UI web usa /api/public/chat para preservar o status HTTP do backend.

import { createServerFn } from "@tanstack/react-start";
import { ChatInputSchema } from "./chat/input";
import { getRequest } from "@tanstack/react-start/server";
import { conversationIdFor } from "./ai/context";
import { TpecBackendError } from "./chat/backend.server";

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ChatInputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      if (process.env.TPEC_MULTIMODEL_ENABLED === "true") {
        const { authenticatedChatUser } = await import("./ai/auth.server");
        const userId = await authenticatedChatUser(getRequest());
        data.sessionId = `web:${userId}`;
        data.conversationId = conversationIdFor(userId, data.conversationId);
        data.channel = "web";
      }
      // O backend privilegiado é executado diretamente no runtime server-side da Netlify.
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
      return {
        error:
          error instanceof TpecBackendError
            ? error.message
            : "Erro inesperado ao consultar a TPEC-IA.",
        status: error instanceof TpecBackendError ? error.status : 500,
      } as const;
    }
  });
