import { createFileRoute } from '@tanstack/react-router';
import { handleInternalChatRequest } from '@/lib/chat/http.server';

export const Route = createFileRoute('/api/internal/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // O handleInternalChatRequest já valida o TPEC_PROXY_SECRET e o TPEC_BACKEND_MODE
        return handleInternalChatRequest(request);
      }
    }
  }
});
