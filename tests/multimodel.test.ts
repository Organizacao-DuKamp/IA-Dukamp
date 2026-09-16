import assert from "node:assert/strict";
import test from "node:test";
import { routeAIRequest } from "../src/lib/ai/router.ts";
import { createProviderRegistry } from "../src/lib/ai/registry.server.ts";
import { orchestrateAI, citationText } from "../src/lib/ai/orchestrator.server.ts";
import { AIProviderError, type AIRequest, type ProviderId } from "../src/lib/ai/types.ts";
import { modelFor } from "../src/lib/ai/config.server.ts";
import { withAIUsageContext, eventCost } from "../src/lib/chat/usage.server.ts";
import { summarizeProviders } from "../src/lib/ai/provider-summary.ts";
import { normalizeCitations } from "../src/lib/ai/providers/shared.server.ts";
import { conversationIdFor } from "../src/lib/ai/context.ts";

test("conversa autenticada preserva ID após vários turnos e isola contas", () => {
  const id = conversationIdFor("account-a", "conversation");
  assert.equal(conversationIdFor("account-a", id), id);
  assert.notEqual(conversationIdFor("account-b", id), id);
});

test("anexos são enviados em formato multimodal e não como URLs externas", async () => {
  const registry = createProviderRegistry();
  for (const id of ["gemini", "openai"] as const) {
    const provider = registry.get(id)!;
    const attachment = { mimeType: "application/pdf", base64: "YWJj", name: "tecnico.pdf" };
    const req = { ...request, attachments: [attachment] };
    assert.equal(provider.supports(req), true);
    await provider.generate(req, {
      env,
      fetchImpl: async (_url, init) => {
        assert.ok(String(init?.body).includes("YWJj"));
        assert.ok(String(init?.body).includes("application/pdf"));
        return Response.json(fixture[id]);
      },
    });
  }
  assert.equal(
    registry
      .get("deepseek")!
      .supports({ ...request, attachments: [{ mimeType: "image/jpeg", base64: "YWJj" }] }),
    false,
  );
});

test("Gemini indisponível usa OpenAI multimodal, sem enviar imagem a modelo textual", async () => {
  const calls: string[] = [];
  const result = await orchestrateAI(
    {
      ...input("Analise a condição corporal"),
      attachments: [{ mimeType: "image/jpeg", base64: "YWJj" }],
    },
    { env, fetchImpl: responder(calls, "googleapis") },
  );
  assert.equal(result.provider, "openai");
  assert.deepEqual(calls, ["generativelanguage.googleapis.com", "api.openai.com"]);
});

test("secret ausente evita chamada e registra motivo do fallback", async () => {
  await withAIUsageContext(async (events) => {
    const calls: string[] = [];
    await orchestrateAI(input("Calcule GMD"), {
      env: { OPENAI_API_KEY: env.OPENAI_API_KEY },
      fetchImpl: responder(calls),
    });
    assert.deepEqual(calls, ["api.openai.com"]);
    assert.equal(events[0].fallbackFrom, "deepseek");
    assert.equal(events[0].fallbackReason, "missing_secret");
  });
});

const cases = [
  { message: "Qual a diferença entre confinamento e semiconfinamento?", provider: "openai" },
  {
    message: "Tenho 150 animais com 380 kg e quero chegar a 450 kg em 90 dias. Qual GMD?",
    provider: "deepseek",
  },
  { message: "Qual é o preço atual da arroba do boi gordo?", provider: "perplexity" },
  {
    message: "Analise a condição corporal desse animal.",
    attachments: [{ mimeType: "image/jpeg", base64: "YWJj" }],
    provider: "gemini",
  },
  {
    message: "Resuma esse material e destaque recomendações.",
    attachments: [{ mimeType: "application/pdf", text: "x".repeat(26000) }],
    provider: "gemini",
  },
  {
    message:
      "Pesquise o preço atual da arroba e estime quanto valem meus 100 animais de 20 arrobas.",
    provider: "perplexity",
    synthesize: true,
  },
  {
    message: "Faça uma análise dos estudos mais recentes sobre determinado protocolo nutricional.",
    mode: "deep_research" as const,
    provider: "perplexity",
    synthesize: true,
  },
];
for (const [index, scenario] of cases.entries())
  test(`roteamento solicitado: caso ${index + 1}`, () => {
    const route = routeAIRequest(scenario);
    assert.equal(route.primary, scenario.provider);
    assert.equal(route.synthesize, scenario.synthesize ?? false);
  });
test("níveis rápidos e política de fontes internas são respeitados", () => {
  assert.equal(routeAIRequest({ message: "Olá!" }).mode, "quick");
  assert.equal(routeAIRequest({ message: "Explique manejo", mode: "quick" }).mode, "quick");
  assert.equal(
    routeAIRequest({ message: "Pesquise nosso estoque", prohibitWeb: true }).webRequired,
    false,
  );
  assert.equal(
    modelFor("gemini", "base", { AI_GEMINI_BASE_MODEL: "custom-model" }),
    "custom-model",
  );
});

const source = "https://example.org/estudo";
const fixture: Record<ProviderId, unknown> = {
  openai: {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Resultado [1]",
            annotations: [{ type: "url_citation", url: source, title: "Estudo" }],
          },
        ],
      },
    ],
    usage: { input_tokens: 12, output_tokens: 3 },
  },
  gemini: {
    candidates: [{ content: { parts: [{ text: "Resultado" }] } }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
  },
  deepseek: {
    choices: [{ message: { content: "Resultado" } }],
    usage: { prompt_tokens: 12, completion_tokens: 3 },
  },
  perplexity: {
    choices: [{ message: { content: "Resultado [1]" } }],
    citations: [source],
    search_results: [{ url: source, title: "Estudo" }],
    usage: { prompt_tokens: 12, completion_tokens: 3, cost: { total_cost: 0.012 } },
  },
};
const request: AIRequest = {
  messages: [{ role: "user", content: "Calcule GMD" }],
  instructions: "Você é a TPEC-IA, especialista em pecuária.",
  mode: "base",
  category: "GENERAL",
};
const env = {
  OPENAI_API_KEY: "fake-openai",
  GEMINI_API_KEY: "fake-gemini",
  DEEPSEEK_API_KEY: "fake-deepseek",
  PERPLEXITY_API_KEY: "fake-perplexity",
};
for (const provider of createProviderRegistry().values()) {
  test(`adapter ${provider.id}: contrato, autenticação e tokens`, async () => {
    let body = "";
    const fetchImpl: typeof fetch = async (url, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.ok(String(url).startsWith("https://"));
      assert.ok(JSON.stringify(init?.headers).includes(env[provider.keyName as keyof typeof env]));
      body = String(init?.body);
      assert.ok(body.includes("TPEC-IA"));
      assert.ok(body.includes("Calcule GMD"));
      assert.ok(!body.includes("fake-"));
      return Response.json(fixture[provider.id]);
    };
    const result = await provider.generate(request, { env, fetchImpl });
    assert.equal(result.provider, provider.id);
    assert.equal(result.inputTokens, 12);
    assert.equal(result.outputTokens, 3);
    assert.ok(result.latency >= 0);
    if (provider.id === "perplexity") {
      assert.equal(result.cost, 0.012);
      assert.equal(result.citations[0].url, source);
    }
  });
  test(`adapter ${provider.id}: erro não expõe body do provedor`, async () => {
    await assert.rejects(
      provider.generate(request, {
        env,
        fetchImpl: async () => new Response("secret-provider-body", { status: 401 }),
      }),
      (e: Error) => !String(e).includes("secret-provider-body") && e instanceof AIProviderError,
    );
  });
}
function input(message: string) {
  return { message, messages: [{ role: "user" as const, content: message }] };
}
function responder(calls: string[], fail?: string): typeof fetch {
  return async (url, init) => {
    const host = new URL(String(url)).hostname;
    calls.push(host);
    if (host.includes(fail ?? "never-match"))
      return new Response("sensitive body", { status: 503 });
    const provider: ProviderId = host.includes("perplexity")
      ? "perplexity"
      : host.includes("deepseek")
        ? "deepseek"
        : host.includes("googleapis")
          ? "gemini"
          : "openai";
    if (provider === "openai" && calls[0].includes("perplexity") && !fail)
      assert.ok(String(init?.body).includes(source));
    return Response.json(fixture[provider]);
  };
}
test("pipeline preço + cálculo faz exatamente pesquisa e síntese e preserva fontes", async () => {
  const calls: string[] = [];
  await withAIUsageContext(async (events) => {
    const result = await orchestrateAI(input(cases[5].message), {
      env,
      fetchImpl: responder(calls),
    });
    assert.deepEqual(calls, ["api.perplexity.ai", "api.openai.com"]);
    assert.equal(result.provider, "openai");
    assert.ok(result.text.includes(source));
    assert.equal(events.length, 2);
    assert.equal(events[0].stage, "research");
    assert.equal(events[1].stage, "synthesis");
  });
});
for (const [message, failing, fallback] of [
  [cases[1].message, "deepseek", "openai"],
  [cases[0].message, "openai", "gemini"],
  [cases[2].message, "perplexity", "openai"],
] as const)
  test(`fallback ${failing} → ${fallback}`, async () => {
    await withAIUsageContext(async (events) => {
      const result = await orchestrateAI(input(message), {
        env,
        fetchImpl: responder([], failing),
      });
      assert.equal(result.provider, fallback);
      assert.equal(events[0].success, false);
      assert.equal(events[0].errorCode, "http_503");
      assert.equal(events[1].fallbackFrom, failing);
    });
  });
test("pesquisa sem fontes termina controladamente e não usa provedor sem web", async () => {
  let calls = 0;
  await assert.rejects(
    orchestrateAI(input(cases[2].message), {
      env,
      fetchImpl: async (url) => {
        calls++;
        return Response.json(
          String(url).includes("perplexity")
            ? { choices: [{ message: { content: "Preço sem fonte" } }] }
            : { output_text: "Preço sem fonte" },
        );
      },
    }),
    (e: AIProviderError) => e.code === "research_unavailable",
  );
  assert.equal(calls, 2);
});
test("budget de quatro chamadas compartilhado entre mídia e novas tentativas", async () => {
  await withAIUsageContext(async (events) => {
    for (let n = 0; n < 4; n++)
      await orchestrateAI(input("Explique manejo"), { env, fetchImpl: responder([]) });
    await assert.rejects(
      orchestrateAI(input("Explique manejo"), { env, fetchImpl: responder([]) }),
      (e: AIProviderError) => e.code === "call_budget_exceeded",
    );
    assert.equal(events.length, 4);
  });
});
test("histórico neutro, resumo e estado chegam ao especialista", async () => {
  await orchestrateAI(
    {
      ...input("Calcule GMD"),
      messages: [
        { role: "assistant", content: "Peso anterior 380 kg" },
        { role: "user", content: "Calcule GMD" },
      ],
      summary: "Lote A",
      state: "Meta 450 kg",
    },
    {
      env,
      fetchImpl: async (_url, init) => {
        for (const text of ["Peso anterior 380 kg", "Lote A", "Meta 450 kg", "TPEC-IA"])
          assert.ok(String(init?.body).includes(text));
        return Response.json(fixture.deepseek);
      },
    },
  );
});
test("redige secrets antes da resposta e da telemetria de fontes", async () => {
  await withAIUsageContext(async (events) => {
    const result = await orchestrateAI(input(cases[2].message), {
      env,
      fetchImpl: async () =>
        Response.json({
          ...(fixture.perplexity as object),
          choices: [{ message: { content: `Olá ${env.PERPLEXITY_API_KEY}` } }],
          search_results: [{ url: source, title: env.PERPLEXITY_API_KEY }],
        }),
    });
    assert.ok(!JSON.stringify([result, events]).includes(env.PERPLEXITY_API_KEY));
  });
});
test("fontes rejeitam esquemas inseguros e referências inventadas", () => {
  const citations = normalizeCitations(["javascript:alert(1)", source]);
  assert.equal(citations[0].id, 2);
  const text = citationText("Fonte [1] [2] https://invented.invalid/artigo", citations);
  assert.ok(text.includes(source));
  assert.ok(!text.includes("invented.invalid"));
  assert.ok(!text.includes("[1]"));
});
test("limite de contexto recusa sem chamadas cobradas", async () => {
  await assert.rejects(
    orchestrateAI(input("x".repeat(170000)), {
      env,
      fetchImpl: async () => {
        assert.fail("Não deve chamar API");
      },
    }),
    (e: AIProviderError) => e.code === "context_limit",
  );
});
test("custos da API e agregação não duplicam taxas de pesquisa", () => {
  const cost = eventCost({
    provider: "perplexity",
    model: "sonar-pro",
    operation: "chat",
    orchestration: true,
    estimatedCostUsd: 0.012,
    webSearchCalls: 2,
  });
  assert.equal(cost.costUsd, 0.012);
  const stats = summarizeProviders([
    {
      metadata: {
        usage_events: [
          {
            provider: "perplexity",
            success: false,
            estimated_cost_usd: 0.012,
            pricing_configured: true,
          },
          {
            provider: "openai",
            success: true,
            fallback_from: "perplexity",
            estimated_cost_usd: 0.02,
            pricing_configured: true,
          },
        ],
      },
    },
  ]);
  assert.equal(stats[0].failures, 1);
  assert.equal(stats[1].fallbacks, 1);
  assert.equal(stats[0].share, 50);
});
