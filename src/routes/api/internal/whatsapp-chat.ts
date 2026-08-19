import { createFileRoute } from "@tanstack/react-router";

import { enforceDurableWhatsAppStateStore } from "@/lib/whatsapp/state-store-guard.server";

export const Route = createFileRoute("/api/internal/whatsapp-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        enforceDurableWhatsAppStateStore();
        const { handleInternalWhatsAppChatRequest } =
          await import("@/lib/whatsapp/internal-http.server");
        return handleInternalWhatsAppChatRequest(request);
      },
    },
  },
});
