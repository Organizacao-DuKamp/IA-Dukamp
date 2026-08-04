import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePublicChatRequest } = await import("@/lib/chat/http.server");
        return handlePublicChatRequest(request);
      },
    },
  },
});
