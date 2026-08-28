import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAIUsage,
  parseOpenAIUsage,
  recordAIUsageEvent,
  withAIUsageContext,
} from "../src/lib/chat/usage.server.ts";

test("parseOpenAIUsage normaliza tokens e detalhes da Responses API", () => {
  const usage = parseOpenAIUsage({
    input_tokens: 120,
    output_tokens: 45,
    total_tokens: 165,
    input_tokens_details: { cached_tokens: 20 },
    output_tokens_details: { reasoning_tokens: 12 },
  });

  assert.deepEqual(usage, {
    inputTokens: 120,
    outputTokens: 45,
    cachedInputTokens: 20,
    reasoningTokens: 12,
    totalTokens: 165,
  });
  assert.deepEqual(parseOpenAIUsage({ prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 }), {
    inputTokens: 7,
    outputTokens: 3,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 10,
  });
});

test("aggregateAIUsage soma tokens, pesquisa e custo configurado", async () => {
  const previous = {
    input: process.env.OPENAI_TPEC_TERRA_INPUT_USD_PER_1M,
    cached: process.env.OPENAI_TPEC_TERRA_CACHED_INPUT_USD_PER_1M,
    output: process.env.OPENAI_TPEC_TERRA_OUTPUT_USD_PER_1M,
    search: process.env.OPENAI_WEB_SEARCH_USD_PER_CALL,
    fx: process.env.TPEC_USD_TO_BRL,
  };
  process.env.OPENAI_TPEC_TERRA_INPUT_USD_PER_1M = "2";
  process.env.OPENAI_TPEC_TERRA_CACHED_INPUT_USD_PER_1M = "0.5";
  process.env.OPENAI_TPEC_TERRA_OUTPUT_USD_PER_1M = "8";
  process.env.OPENAI_WEB_SEARCH_USD_PER_CALL = "0.01";
  process.env.TPEC_USD_TO_BRL = "5";

  try {
    const aggregate = await withAIUsageContext(async (events) => {
      recordAIUsageEvent({
        provider: "openai",
        operation: "chat",
        model: "custom-terra",
        modelTier: "terra",
        routeReason: "deep_research",
        stage: "research_synthesis",
        requestSequence: 1,
        promptCacheKey: "tpec-terra-web",
        researchDepth: "high",
        webSearchEnabled: true,
        webSearchCalls: 2,
        inputTokens: 1_000,
        cachedInputTokens: 200,
        outputTokens: 500,
        totalTokens: 1_500,
        instructionChars: 2_000,
        inputChars: 100,
        contextChars: 300,
        ragMatches: 3,
        ragChars: 900,
        sourceCount: 4,
      });
      return aggregateAIUsage(events);
    });

    assert.equal(aggregate.inputTokens, 1_000);
    assert.equal(aggregate.cachedInputTokens, 200);
    assert.equal(aggregate.outputTokens, 500);
    assert.equal(aggregate.totalTokens, 1_500);
    assert.equal(aggregate.webSearchCalls, 2);
    assert.equal(aggregate.usedDeepResearch, true);
    assert.equal(aggregate.usedQuickResponse, false);
    assert.equal(aggregate.pricingConfigured, true);
    assert.ok(Math.abs(aggregate.costUsd - 0.0257) < 1e-12);
    assert.ok(Math.abs((aggregate.costBrl ?? 0) - 0.1285) < 1e-12);
    assert.equal(aggregate.usdToBrl, 5);
    assert.equal(aggregate.stageBreakdown.research_synthesis.events, 1);
    assert.equal(aggregate.promptMetrics.promptChars, 2_100);
    assert.equal(aggregate.promptMetrics.ragMatches, 3);
  } finally {
    for (const [key, value] of Object.entries({
      OPENAI_TPEC_TERRA_INPUT_USD_PER_1M: previous.input,
      OPENAI_TPEC_TERRA_CACHED_INPUT_USD_PER_1M: previous.cached,
      OPENAI_TPEC_TERRA_OUTPUT_USD_PER_1M: previous.output,
      OPENAI_WEB_SEARCH_USD_PER_CALL: previous.search,
      TPEC_USD_TO_BRL: previous.fx,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("withAIUsageContext coleta eventos da execução atual", async () => {
  const count = await withAIUsageContext(async (events) => {
    recordAIUsageEvent({
      provider: "openai",
      operation: "chat",
      model: "gpt-5.6-luna",
      modelTier: "luna",
      routeReason: "lightweight_turn",
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    });
    return events.length;
  });

  assert.equal(count, 1);
});
