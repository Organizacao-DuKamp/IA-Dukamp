import assert from "node:assert/strict";
import test from "node:test";

import {
  researchPerplexity,
  researchProfileForQuery,
} from "../src/lib/chat/perplexity.server.ts";

test("pesquisa externa escolhe perfil pecuário especializado", () => {
  assert.equal(researchProfileForQuery("previsão para amanhã", { weatherSearch: true }), "weather");
  assert.equal(
    researchProfileForQuery("cotação do boi gordo em SP", { currentMarketSearch: true }),
    "current_market",
  );
  assert.equal(researchProfileForQuery("qual portaria do MAPA está vigente?"), "regulation");
  assert.equal(
    researchProfileForQuery("qual o status atual dos focos de febre aftosa?"),
    "animal_health_status",
  );
  assert.equal(
    researchProfileForQuery("como está a tendência do mercado do boi gordo e exportação?"),
    "market_intelligence",
  );
  assert.equal(
    researchProfileForQuery("qual manejo nutricional para semi-confinamento?"),
    "technical_livestock",
  );
  assert.equal(researchProfileForQuery("qual a notícia atual sobre o tema?"), "general_current");
});

test("deep research executa três rodadas em paralelo e entrega evidência consolidada", async () => {
  const previous = process.env.PERPLEXITY_API_KEY;
  process.env.PERPLEXITY_API_KEY = "perplexity-deep-test-key";
  const requestBodies: Array<Record<string, unknown>> = [];
  let call = 0;

  try {
    const evidence = await researchPerplexity("panorama atual do mercado do boi gordo", {
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requestBodies.push(body);
        call += 1;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: `Evidência independente ${call}.` } }],
            citations: [`https://fonte${call}.example.test/dado`],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    assert.equal(requestBodies.length, 3);
    assert.ok(requestBodies.every((body) => body.search_mode === "web"));
    assert.ok(
      requestBodies.every(
        (body) =>
          JSON.stringify(body.web_search_options) === JSON.stringify({ search_context_size: "high" }),
      ),
    );
    assert.ok(requestBodies.every((body) => body.search_recency_filter === "month"));
    assert.match(evidence, /PERFIL: market_intelligence/);
    assert.match(evidence, /RODADAS CONCLUÍDAS: 3/);
    assert.match(evidence, /RODADA primary-data/);
    assert.match(evidence, /RODADA independent-crosscheck/);
    assert.match(evidence, /RODADA counterevidence-drivers/);
    assert.match(evidence, /https:\/\/fonte1\.example\.test\/dado/);
    assert.match(evidence, /https:\/\/fonte2\.example\.test\/dado/);
    assert.match(evidence, /https:\/\/fonte3\.example\.test\/dado/);
  } finally {
    if (previous === undefined) delete process.env.PERPLEXITY_API_KEY;
    else process.env.PERPLEXITY_API_KEY = previous;
  }
});

test("deep research degrada parcialmente quando uma rodada falha", async () => {
  const previous = process.env.PERPLEXITY_API_KEY;
  process.env.PERPLEXITY_API_KEY = "perplexity-partial-test-key";

  try {
    const evidence = await researchPerplexity("qual portaria do MAPA está vigente para este tema?", {
      timeoutMs: 1_000,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = String(init?.body ?? "");
        if (body.includes("implementação oficial que possam mudar a interpretação")) {
          return new Response(JSON.stringify({ error: "temporary failure" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Evidência oficial disponível." } }],
            citations: ["https://www.gov.br/mapa/"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    assert.match(evidence, /PERFIL: regulation/);
    assert.match(evidence, /RODADAS CONCLUÍDAS: 2/);
    assert.match(evidence, /RODADAS INCOMPLETAS: amendments-revocations/);
    assert.match(evidence, /https:\/\/www\.gov\.br\/mapa\//);
  } finally {
    if (previous === undefined) delete process.env.PERPLEXITY_API_KEY;
    else process.env.PERPLEXITY_API_KEY = previous;
  }
});
