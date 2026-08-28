import assert from "node:assert/strict";
import test from "node:test";

import {
  researchChatGPT,
  researchDepthForQuery,
  researchPerplexity,
  researchProfileForQuery,
} from "../src/lib/chat/perplexity.server.ts";

test("pesquisa escolhe perfil pecuário especializado", () => {
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

test("perfis dinâmicos começam em pesquisa média para reduzir custo e latência", () => {
  assert.equal(researchDepthForQuery("previsão", { weatherSearch: true }), "medium");
  assert.equal(researchDepthForQuery("boi gordo", { currentMarketSearch: true }), "medium");
  assert.equal(researchDepthForQuery("portaria vigente do MAPA"), "medium");
  assert.equal(researchDepthForQuery("status da febre aftosa"), "medium");
  assert.equal(researchDepthForQuery("panorama e tendência do boi gordo"), "medium");
});

test("deepResearch explícito sobe para high", () => {
  assert.equal(
    researchDepthForQuery("panorama e tendência do boi gordo", { deepResearch: true }),
    "high",
  );
});

test("pergunta técnica estável usa pesquisa média quando a base não resolver", () => {
  assert.equal(researchDepthForQuery("manejo nutricional para semi-confinamento"), "medium");
});

test("planejador gera marcador médio para Web Search nativo do ChatGPT", async () => {
  const plan = await researchChatGPT("panorama atual do mercado do boi gordo");

  assert.match(plan, /CHATGPT_WEB_SEARCH_REQUIRED/);
  assert.match(plan, /PROFILE: market_intelligence/);
  assert.match(plan, /DEPTH: medium/);
  assert.doesNotMatch(plan, /QUERY:/);
  assert.match(plan, /use somente a evidência necessária/i);
  assert.match(plan, /pesquise na web antes de responder/i);
  assert.match(plan, /fontes primárias|dados primários/i);
});

test("pesquisa meteorológica preserva localização e exigências de qualidade em medium", async () => {
  const plan = await researchChatGPT("previsão detalhada para amanhã", {
    weatherSearch: true,
    weatherLocation: "Monte Aprazível - SP",
  });

  assert.match(plan, /PROFILE: weather/);
  assert.match(plan, /DEPTH: medium/);
  assert.match(plan, /Monte Aprazível - SP/);
  assert.match(plan, /fontes meteorológicas oficiais/i);
  assert.match(plan, /alertas, chuva, temperatura, vento e incerteza/i);
  assert.match(plan, /manejo pecuário/i);
});

test("nome legado continua compatível sem chamar provedor externo", async () => {
  const legacy = await researchPerplexity("qual portaria do MAPA está vigente?");
  const current = await researchChatGPT("qual portaria do MAPA está vigente?");

  assert.equal(legacy, current);
  assert.match(legacy, /CHATGPT_WEB_SEARCH_REQUIRED/);
  assert.doesNotMatch(legacy, /pplx-|api\.perplexity/i);
});
