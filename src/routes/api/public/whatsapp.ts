import { createFileRoute } from "@tanstack/react-router";

import { enforceDurableWhatsAppStateStore } from "@/lib/whatsapp/state-store-guard.server";

async function handle(request: Request) {
  enforceDurableWhatsAppStateStore();
  const { handleEnhancedWhatsAppWebhookRequest } =
    await import("@/lib/whatsapp/enhanced-http.server");
  return handleEnhancedWhatsAppWebhookRequest(request);
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
