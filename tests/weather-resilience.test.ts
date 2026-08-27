import assert from "node:assert/strict";
import test from "node:test";

import { researchPerplexity } from "../src/lib/chat/perplexity.server.ts";

const previousPerplexityKey = process.env.PERPLEXITY_API_KEY;

function restoreEnv() {
  if (previousPerplexityKey === undefined) delete process.env.PERPLEXITY_API_KEY;
  else process.env.PERPLEXITY_API_KEY = previousPerplexityKey;
}

test("cruzamento meteorológico resiliente usa uma única pesquisa web", async () => {
  process.env.PERPLEXITY_API_KEY = "test-weather-resilience-key";
  const bodies: Array<Record<string, unknown>> = [];

  try {
    const evidence = await researchPerplexity(
      "Previsão meteorológica aprofundada para Monte Aprazível, Brasil.",
      {
        weatherSearch: true,
        weatherLocation: "Monte Aprazível",
        deepResearch: false,
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content:
                      "EVIDÊNCIAS: INMET sem alerta relevante; fonte cruzada atual disponível.",
                  },
                },
              ],
              citations: ["https://portal.inmet.gov.br/"],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }) as typeof fetch,
      },
    );

    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]?.search_mode, "web");
    assert.equal(bodies[0]?.search_recency_filter, "day");
    assert.deepEqual(bodies[0]?.web_search_options, { search_context_size: "high" });
    assert.match(evidence, /PERFIL: weather/);
    assert.match(evidence, /RODADAS CONCLUÍDAS: 1/);
    assert.match(evidence, /INMET sem alerta relevante/);
  } finally {
    restoreEnv();
  }
});
