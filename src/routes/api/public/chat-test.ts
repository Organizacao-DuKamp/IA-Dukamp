// Test-only endpoint. Accepts JSON {sessionId,text,history}, calls handleIncoming
// directly, returns {reply} or {error}. Used by internal QA harness.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/chat-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { handleIncoming, ChatError } = await import("@/lib/chat/core.server");
          try {
            const out = await handleIncoming({
              sessionId: String(body.sessionId ?? `qa-${Math.random().toString(36).slice(2)}-${Date.now()}`),
              text: String(body.text ?? ""),
              history: Array.isArray(body.history) ? body.history : [],
            });
            return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
          } catch (err) {
            if (err instanceof ChatError) {
              return new Response(JSON.stringify({ error: err.message, status: err.status }), {
                status: err.status,
                headers: { "content-type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
        } catch (err) {
          return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
