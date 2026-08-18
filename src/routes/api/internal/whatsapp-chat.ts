import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/whatsapp-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInternalWhatsAppChatRequest } = await import(
          "@/lib/whatsapp/internal-http.server"
        );
        return handleInternalWhatsAppChatRequest(request);
      },
    },
  },
});
