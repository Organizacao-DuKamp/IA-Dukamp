// Endpoint de coleta programada de dados dinâmicos de mercado.
// Protegido por token — use em cron externo (ex.: cron-job.org) ou pg_cron.
//   POST /api/public/market-ingest        -> roda os coletores automáticos
//   POST /api/public/market-ingest {quotes:[...]} -> ingestão externa (planilha/API própria)
// Header obrigatório: x-ingest-token: <MARKET_INGEST_TOKEN>

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  quotes: z
    .array(
      z.object({
        product: z.string().min(2).max(120),
        category: z.string().min(2).max(60),
        price: z.number().finite().positive(),
        unit: z.string().min(1).max(40),
        locality: z.string().min(2).max(120),
        state: z.string().max(40).nullable().optional(),
        payment_condition: z.string().max(60).nullable().optional(),
        quote_type: z.string().max(40).optional(),
        reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        source_updated_at: z.string().max(60).nullable().optional(),
        source_code: z.string().min(2).max(60),
        source_url: z.string().url().max(500).optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .max(500)
    .optional(),
  syncSources: z.boolean().optional(),
});

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/market-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MARKET_INGEST_TOKEN;
        const provided = request.headers.get("x-ingest-token");
        if (!token || !provided || provided !== token) return unauthorized();

        let body: unknown = {};
        const text = await request.text();
        if (text.trim()) {
          try {
            body = JSON.parse(text);
          } catch {
            return new Response(JSON.stringify({ error: "invalid json" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid payload" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const { runCollectors, upsertQuotes, syncMarketSources } = await import(
            "@/lib/market/ingest.server"
          );
          const result: Record<string, unknown> = {};
          if (parsed.data.syncSources) result.sources = await syncMarketSources();
          if (parsed.data.quotes?.length) {
            result.manual = await upsertQuotes(parsed.data.quotes as any);
          } else {
            result.collectors = await runCollectors();
          }
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[market-ingest]", e);
          return new Response(JSON.stringify({ error: "ingest failed" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
