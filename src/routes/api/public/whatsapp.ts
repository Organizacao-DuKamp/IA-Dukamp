import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleEnhancedWhatsAppWebhookRequest } = await import(
          "@/lib/whatsapp/enhanced-http.server"
        );
        return handleEnhancedWhatsAppWebhookRequest(request);
      },
      POST: async ({ request }) => {
        const { handleEnhancedWhatsAppWebhookRequest } = await import(
          "@/lib/whatsapp/enhanced-http.server"
        );
        return handleEnhancedWhatsAppWebhookRequest(request);
      },
    },
  },
});
