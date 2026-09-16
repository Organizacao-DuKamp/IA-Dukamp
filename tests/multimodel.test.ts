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
    if (provider === "deepseek" && calls[0].includes("perplexity") && !fail)
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
    assert.deepEqual(calls, ["api.perplexity.ai", "api.deepseek.com"]);
    assert.equal(result.provider, "deepseek");
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