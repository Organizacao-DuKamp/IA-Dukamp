// Diagnóstico público — não vaza valores, apenas presença/tamanho e resultado
// de um teste de conexão contra o Supabase do site DuKamp.
// URL: /api/public/diag
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function envInfo(name: string) {
  const v = process.env[name];
  if (!v) return { present: false };
  return {
    present: true,
    length: v.length,
    prefix: v.slice(0, 8),
    suffix: v.slice(-4),
  };
}

export const Route = createFileRoute("/api/public/diag")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const envs = {
          SUPABASE_URL: envInfo("SUPABASE_URL"),
          SUPABASE_PUBLISHABLE_KEY: envInfo("SUPABASE_PUBLISHABLE_KEY"),
          SUPABASE_SERVICE_ROLE_KEY: envInfo("SUPABASE_SERVICE_ROLE_KEY"),
          DUKAMP_SITE_SUPABASE_URL: envInfo("DUKAMP_SITE_SUPABASE_URL"),
          DUKAMP_SITE_SUPABASE_ANON_KEY: envInfo("DUKAMP_SITE_SUPABASE_ANON_KEY"),
          PERPLEXITY_API_KEY: envInfo("PERPLEXITY_API_KEY"),
          LOVABLE_API_KEY: envInfo("LOVABLE_API_KEY"),
        };

        const siteTests: Record<string, unknown> = {};
        try {
          const { isSiteConfigured, siteSupabase } = await import(
            "@/lib/site/site-client.server"
          );
          siteTests.isSiteConfigured = isSiteConfigured();

          if (siteTests.isSiteConfigured) {
            const client = siteSupabase();
            const started = Date.now();
            const { data, error, count } = await client
              .from("products")
              .select("id", { count: "exact", head: true })
              .eq("active", true);
            siteTests.productsQuery = {
              ok: !error,
              ms: Date.now() - started,
              count: count ?? null,
              error: error?.message ?? null,
              sample: Array.isArray(data) ? data.length : null,
            };

            const s2 = Date.now();
            const sellersRes = await client
              .from("sellers")
              .select("id", { count: "exact", head: true });
            siteTests.sellersQuery = {
              ok: !sellersRes.error,
              ms: Date.now() - s2,
              count: sellersRes.count ?? null,
              error: sellersRes.error?.message ?? null,
            };
          }
        } catch (err) {
          siteTests.exception = err instanceof Error ? err.message : String(err);
        }

        const body = {
          ok: true,
          now: new Date().toISOString(),
          runtime: {
            hasProcessEnv: typeof process !== "undefined" && !!process.env,
            userAgent:
              typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
          envs,
          siteTests,
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
