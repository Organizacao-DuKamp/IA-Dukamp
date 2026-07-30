// Endpoint interno de QA. Só responde quando QA_TEST_TOKEN está configurado e
// o header x-qa-token confere. Sem token válido responde 404 (endpoint oculto).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const notFound = () =>
  new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });

const bodySchema = z.object({
  sessionId: z.string().min(1).max(120).optional(),
  conversationId: z.string().min(1).max(120).optional(),
  text: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .optional(),
  state: z.unknown().optional(),
});

export const Route = createFileRoute("/api/public/chat-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.QA_TEST_TOKEN;
        const provided = request.headers.get("x-qa-token") ?? "";
        if (!expected || provided !== expected) return notFound();

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "invalid_request" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const { handleIncoming } = await import("@/lib/chat/core.server");
          const out = await handleIncoming({
            sessionId:
              parsed.sessionId ??
              `qa-${Math.random().toString(36).slice(2)}-${Date.now()}`,
            text: parsed.text,
            history: parsed.history ?? [],
            conversationId: parsed.conversationId,
            state: parsed.state as never,
          });
          return new Response(JSON.stringify(out), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[chat-test] falha", err);
          return new Response(JSON.stringify({ error: "internal_error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
