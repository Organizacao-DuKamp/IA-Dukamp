import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleWhatsAppWebhookRequest } = await import("@/lib/whatsapp/http.server");
        return handleWhatsAppWebhookRequest(request);
      },
      POST: async ({ request }) => {
        const { handleWhatsAppWebhookRequest } = await import("@/lib/whatsapp/http.server");
        return handleWhatsAppWebhookRequest(request);
      },
    },
  },
});
