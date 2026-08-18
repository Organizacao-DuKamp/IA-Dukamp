import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/whatsapp-control")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInternalWhatsAppControlRequest } = await import(
          "@/lib/whatsapp/internal-http.server"
        );
        return handleInternalWhatsAppControlRequest(request);
      },
    },
  },
});
