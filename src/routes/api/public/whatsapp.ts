import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { handleEnhancedWhatsAppWebhookRequest } = await import(
    "@/lib/whatsapp/enhanced-http.server"
  );
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
