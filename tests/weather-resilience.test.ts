import assert from "node:assert/strict";
import test from "node:test";

import { researchChatGPT } from "../src/lib/chat/perplexity.server.ts";

test("cruzamento meteorológico usa o Web Search nativo do ChatGPT sem segundo provedor", async () => {
  let externalCalls = 0;

  const plan = await researchChatGPT(
    "Previsão meteorológica aprofundada para Monte Aprazível, Brasil.",
    {
      weatherSearch: true,
      weatherLocation: "Monte Aprazível",
      deepResearch: false,
      fetchImpl: (async () => {
        externalCalls += 1;
        throw new Error("o planejador não deve chamar um segundo provedor");
      }) as typeof fetch,
    },
  );

  assert.equal(externalCalls, 0);
  assert.match(plan, /CHATGPT_WEB_SEARCH_REQUIRED/);
  assert.match(plan, /PROFILE: weather/);
  assert.match(plan, /DEPTH: high/);
  assert.match(plan, /Monte Aprazível/);
  assert.match(plan, /fontes meteorológicas oficiais/i);
  assert.doesNotMatch(plan, /api\.perplexity|pplx-/i);
});