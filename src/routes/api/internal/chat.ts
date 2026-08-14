import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/internal/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleInternalChatRequest } = await import('@/lib/chat/http.server');
        return handleInternalChatRequest(request);
      }
    }
  }
});
