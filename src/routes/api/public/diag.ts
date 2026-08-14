// Diagnóstico de ambiente protegido por token.
// Nunca retorna valores de segredos — apenas se cada variável está configurada.
// Uso: POST/GET com o cabeçalho `x-tpec-diag-token: <QA_TEST_TOKEN>`.

import { createFileRoute } from "@tanstack/react-router";

const CHECKED_VARS = [
  "TPEC_BACKEND_MODE",
  "LOVABLE_BACKEND_URL",
  "TPEC_PROXY_SECRET",
  "PERPLEXITY_API_KEY",
  "PERPLEXITY_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_FAST_MODEL",
  "OPENAI_CAPABLE_MODEL",
  "OPENAI_EMBEDDING_MODEL",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DUKAMP_SITE_SUPABASE_URL",
  "DUKAMP_SITE_SUPABASE_ANON_KEY",
  "MARKET_INGEST_TOKEN",
  "QA_TEST_TOKEN",
] as const;

function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function handle(request: Request): Response {
  const expected = process.env.QA_TEST_TOKEN?.trim();
  const provided = request.headers.get("x-tpec-diag-token")?.trim() ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return json({ error: "not_found" }, 404);
  }

  const env: Record<string, "configurada" | "ausente"> = {};
  for (const name of CHECKED_VARS) {
    env[name] = process.env[name]?.trim() ? "configurada" : "ausente";
  }

  const mode = process.env.TPEC_BACKEND_MODE?.trim().toLowerCase() || "local (padrão)";
  return json({ backend_mode: mode, env });
}

export const Route = createFileRoute("/api/public/diag")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
