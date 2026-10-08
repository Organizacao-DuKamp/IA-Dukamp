import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  checkProviderHealth,
  classifyHealthError,
  createHealthChecker,
} from "../src/lib/ai/health.server.ts";

const env = {
  OPENAI_API_KEY: "secret-openai",
  GEMINI_API_KEY: "secret-gemini",
  DEEPSEEK_API_KEY: "secret-deepseek",
  PERPLEXITY_API_KEY: "secret-perplexity",
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("classifica créditos, cobrança, autenticação e rate limit separadamente", () => {
  assert.equal(
    classifyHealthError("openai", 429, {
      error: { code: "credit_balance_exhausted", type: "insufficient_quota" },
    }),
    "no_credits",
  );
  assert.equal(
    classifyHealthError("openai", 429, {
      error: { code: "project_spend_limit_exceeded", type: "insufficient_quota" },
    }),
    "billing_limit",
  );
  assert.equal(
    classifyHealthError("openai", 429, { error: { code: "insufficient_quota" } }),
    "billing_limit",
  );
  assert.equal(
    classifyHealthError("openai", 429, { error: { code: "rate_limit_exceeded" } }),
    "quota_limited",
  );
  assert.equal(
    classifyHealthError("gemini", 429, { error: { status: "RESOURCE_EXHAUSTED" } }),
    "quota_limited",
  );
  assert.equal(classifyHealthError("perplexity", 402, {}), "no_credits");
  assert.equal(classifyHealthError("perplexity", 401, {}), "billing_limit");
  assert.equal(
    classifyHealthError("perplexity", 401, { error: { message: "Insufficient credits" } }),
    "no_credits",
  );
  assert.equal(
    classifyHealthError("perplexity", 401, { error: { code: "invalid_api_key" } }),
    "invalid_key",
  );
  assert.equal(classifyHealthError("deepseek", 401, {}), "invalid_key");
  assert.equal(classifyHealthError("gemini", 404, {}), "configuration_error");
  assert.equal(classifyHealthError("openai", 503, {}), "unavailable");
});

test("sem chave não faz chamada", async () => {
  const result = await checkProviderHealth("openai", {}, async () => {
    throw Error("unexpected fetch");
  });
  assert.equal(result.status, "not_configured");
});

test("DeepSeek consulta saldo sem gerar tokens, preservando moeda e saldo zero", async () => {
  for (const available of [true, false]) {
    const result = await checkProviderHealth("deepseek", env, async (url, init) => {
      assert.equal(url, "https://api.deepseek.com/user/balance");
      assert.equal(init?.method, "GET");
      assert.equal(init?.body, undefined);
      return response({
        is_available: available,
        balance_infos: [
          { currency: "USD", total_balance: available ? "1.2345" : "0" },
          { currency: "CNY", total_balance: "NaN" },
        ],
      });
    });
    assert.equal(result.status, available ? "balance_available" : "no_credits");
    assert.deepEqual(result.balances, [{ currency: "USD", amount: available ? 1.2345 : 0 }]);
  }
});

test("testes mínimos não usam histórico, ferramentas, retries ou fallback", async () => {
  for (const provider of ["openai", "gemini", "perplexity"] as const) {
    let calls = 0;
    const result = await checkProviderHealth(provider, env, async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      assert.equal(body.tools, undefined);
      if (provider === "openai") {
        assert.equal(body.max_output_tokens, 16);
        assert.equal(body.input, "Reply OK.");
        assert.equal(body.store, false);
        return response({
          status: "incomplete",
          output: [],
          incomplete_details: { reason: "max_output_tokens" },
        });
      }
      if (provider === "gemini") {
        assert.equal(body.generationConfig.maxOutputTokens, 1);
        return response({ candidates: [{ finishReason: "MAX_TOKENS" }] });
      }
      assert.equal(body.max_tokens, 1);
      assert.equal(body.disable_search, true);
      return response({ choices: [{ finish_reason: "length" }] });
    });
    assert.equal(result.status, "operational");
    assert.equal(calls, 1);
    assert.deepEqual(result.balances, []);
  }
});

test("erros e respostas inesperadas não vazam segredos nem viram sucesso", async () => {
  const result = await checkProviderHealth("openai", env, async () =>
    response({ error: { code: "invalid_api_key", message: env.OPENAI_API_KEY } }, 401),
  );
  assert.equal(result.status, "invalid_key");
  assert.ok(!JSON.stringify(result).includes(env.OPENAI_API_KEY));
  assert.equal(
    (await checkProviderHealth("openai", env, async () => response({}))).status,
    "unavailable",
  );
  assert.equal(
    (await checkProviderHealth("deepseek", env, async () => response({ is_available: true })))
      .status,
    "unavailable",
  );
  assert.equal(
    (
      await checkProviderHealth("gemini", env, async () => {
        throw Error(env.GEMINI_API_KEY);
      })
    ).status,
    "unavailable",
  );
});

test("cache deduplica consultas concorrentes e expira; rotação de chave invalida", async () => {
  const check = createHealthChecker();
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    return response({ status: "completed", output: [] });
  };
  const keys = { OPENAI_API_KEY: "test" };
  const [a, b] = await Promise.all([check(keys, fetchImpl, 1000), check(keys, fetchImpl, 1000)]);
  assert.equal(calls, 1);
  assert.equal(a.cached, false);
  assert.equal(b.cached, true);
  await check(keys, fetchImpl, 1001);
  assert.equal(calls, 1);
  await check(keys, fetchImpl, 301001);
  assert.equal(calls, 2);
  await check({ OPENAI_API_KEY: "rotated" }, fetchImpl, 301002);
  assert.equal(calls, 3);
});

test("verificação exige autenticação e papel admin antes de importar backend", async () => {
  const source = await readFile(
    new URL("../src/lib/ai-health.functions.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /method: "POST"/);
  assert.match(source, /middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(source, /_role: "admin"/);
  assert.ok(
    source.indexOf("if (error || !data)") < source.indexOf('await import("./ai/health.server")'),
  );
});
