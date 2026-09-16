import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeProviderAnalytics,
  summarizeSpend,
  ACTIVE_PROVIDERS,
  type SpendRow,
} from "../src/lib/ai/provider-summary.ts";
import { createProviderRegistry } from "../src/lib/ai/registry.server.ts";
import { routeAIRequest } from "../src/lib/ai/router.ts";

function row(user: string, conversation: string, costs: Record<string, number>): SpendRow {
  return {
    user_key: user,
    conversation_id: conversation,
    pricing_configured: true,
    estimated_cost_usd: Object.values(costs).reduce((n, v) => n + v, 0),
    metadata: {
      usage_events: Object.entries(costs).map(([provider, cost]) => ({
        provider,
        estimated_cost_usd: cost,
        pricing_configured: true,
        success: true,
      })),
    },
  };
}
test("apenas quatro providers ativos, documentos longos no Gemini", () => {
  assert.deepEqual(
    [...createProviderRegistry().values()].map((p) => p.id),
    [...ACTIVE_PROVIDERS],
  );
  assert.equal(
    routeAIRequest({
      message: "Analise",
      attachments: [{ mimeType: "text/plain", text: "x".repeat(30000) }],
    }).primary,
    "gemini",
  );
});
test("total, gastos separados, usuário e conversa com maior gasto por valor", () => {
  const summary = summarizeProviderAnalytics([
    row("A", "c1", { openai: 1, perplexity: 3 }),
    row("A", "c1", { openai: 1 }),
    row("A", "c2", { gemini: 8 }),
    row("B", "c1", { deepseek: 4 }),
  ]);
  assert.equal(summary.totalCost, 17);
  assert.equal(summary.leaders[0].provider, "gemini");
  assert.equal(summary.providers.find((p) => p.provider === "openai")?.cost, 2);
  assert.equal(summary.users.find((u) => u.userKey === "A")?.totalCost, 13);
  const conversation = summary.conversations.find(
    (c) => c.userKey === "A" && c.conversationId === "c1",
  )!;
  assert.equal(conversation.totalCost, 5);
  assert.equal(conversation.leaders[0].provider, "perplexity");
  assert.equal(summary.conversations.find((c) => c.userKey === "B")?.totalCost, 4);
});
test("IAs sem uso ficam visíveis com zero sem eleger vencedora", () => {
  const summary = summarizeProviderAnalytics([]);
  assert.equal(summary.providers.length, 4);
  assert.equal(summary.totalCost, 0);
  assert.deepEqual(summary.leaders, []);
});
test("empate e tarifas ausentes não produzem um vencedor falso", () => {
  assert.equal(summarizeSpend([row("A", "c1", { openai: 2, gemini: 2 })]).leaders.length, 2);
  const partial = summarizeSpend([
    {
      pricing_configured: false,
      metadata: {
        usage_events: [{ provider: "gemini", estimated_cost_usd: 0, pricing_configured: false }],
      },
    },
  ]);
  assert.equal(partial.pricingConfigured, false);
  assert.deepEqual(partial.leaders, []);
});
test("histórico OpenAI sem custos por chamada preserva total sem duplicá-lo", () => {
  const summary = summarizeSpend([
    {
      estimated_cost_usd: 5,
      pricing_configured: true,
      model: "gpt-5.6-terra",
      metadata: { usage_events: [{ provider: "openai" }, { provider: "openai" }] },
    },
  ]);
  assert.equal(summary.totalCost, 5);
  assert.equal(summary.providers[0].cost, 5);
  assert.equal(summary.providers[0].calls, 2);
  assert.equal(summary.pricingConfigured, true);
});
test("custo não atribuível fica separado e não inventa divisão", () => {
  const r = row("A", "c1", { openai: 1, gemini: 2 });
  r.estimated_cost_usd = 10;
  const summary = summarizeSpend([r]);
  assert.equal(summary.totalCost, 10);
  assert.equal(summary.providers.find((p) => p.provider === "unassigned")?.cost, 7);
  assert.equal(summary.pricingConfigured, false);
  assert.deepEqual(summary.leaders, []);
});
test("preserva provedores históricos sem reativar chamadas", () => {
  const summary = summarizeSpend([row("A", "c1", { retired_provider: 5 })]);
  assert.equal(summary.totalCost, 5);
  assert.equal(summary.leaders[0].provider, "retired_provider");
});
test("custos de chamadas falhas e fallback não são descartados", () => {
  const summary = summarizeSpend([
    {
      metadata: {
        usage_events: [
          {
            provider: "perplexity",
            estimated_cost_usd: 2,
            success: false,
            pricing_configured: true,
          },
          {
            provider: "openai",
            estimated_cost_usd: 1,
            fallback_from: "perplexity",
            pricing_configured: true,
          },
        ],
      },
    },
  ]);
  assert.equal(summary.totalCost, 3);
  assert.equal(summary.leaders[0].provider, "perplexity");
  assert.equal(summary.providers[0].failures, 1);
});
test("metadados malformados e números inválidos não quebram admin", () => {
  const summary = summarizeSpend([
    { metadata: { usage_events: "invalid" } },
    { metadata: { usage_events: [null, 12, { provider: "openai", estimated_cost_usd: -1 }] } },
    { estimated_cost_usd: Number.NaN },
  ]);
  assert.equal(summary.totalCost, 0);
  assert.deepEqual(summary.leaders, []);
});
