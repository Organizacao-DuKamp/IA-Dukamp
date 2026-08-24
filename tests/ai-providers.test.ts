import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { askOpenAI, chatModelKindForChannel } from "../src/lib/chat/openai.server.ts";
import { researchPerplexity } from "../src/lib/chat/perplexity.server.ts";
import { embeddingProvider, embedTexts } from "../src/lib/rag/embeddings.server.ts";

test("OpenAI recebe histórico, estado, RAG e pesquisa para produzir a resposta final", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-test-key";
  let requestUrl = "";
  let requestHeaders = new Headers();
  let requestBody: Record<string, unknown> = {};

  try {
    const reply = await askOpenAI(
      [
        { role: "user", content: "Qual a cotação atual?" },
        { role: "assistant", content: "Vou verificar." },
        { role: "user", content: "Em São Paulo." },
      ],
      {
        summary: '{"topic":"boi gordo"}',
        state: '{"market_uf":"SP"}',
        directive: "Responder a continuação sem repetir perguntas.",
        sourcePolicy: "Use somente preços com data e fonte.",
        context: "RAG interno e pesquisa atual recuperados.",
        fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
          requestUrl = String(url);
          requestHeaders = new Headers(init?.headers);
          requestBody = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              output: [{ content: [{ type: "output_text", text: "Resposta fundamentada." }] }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }) as typeof fetch,
      },
    );

    assert.equal(reply, "Resposta fundamentada.");
    assert.equal(requestUrl, "https://api.openai.com/v1/responses");
    assert.equal(requestHeaders.get("authorization"), "Bearer openai-test-key");
    assert.equal(requestBody.store, false);
    assert.match(String(requestBody.instructions), /RAG interno e pesquisa atual recuperados/);
    assert.match(String(requestBody.instructions), /market_uf/);
    assert.deepEqual(
      (requestBody.input as Array<{ role: string }>).map((message) => message.role),
      ["user", "assistant", "user"],
    );
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("WhatsApp usa modelo rápido, raciocínio mínimo e resposta curta", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFast = process.env.OPENAI_FAST_MODEL;
  process.env.OPENAI_API_KEY = "openai-whatsapp-test-key";
  process.env.OPENAI_FAST_MODEL = "gpt-5-mini-test";
  let requestBody: Record<string, unknown> = {};

  try {
    assert.equal(chatModelKindForChannel("whatsapp"), "fast");
    assert.equal(chatModelKindForChannel("web"), "capable");

    await askOpenAI([{ role: "user", content: "Responda direto" }], {
      model: chatModelKindForChannel("whatsapp"),
      channel: "whatsapp",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ output_text: "Resposta curta." }), { status: 200 });
      }) as typeof fetch,
    });

    assert.equal(requestBody.model, "gpt-5-mini-test");
    assert.equal(requestBody.max_output_tokens, 2_500);
    assert.deepEqual(requestBody.reasoning, { effort: "minimal" });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousFast === undefined) delete process.env.OPENAI_FAST_MODEL;
    else process.env.OPENAI_FAST_MODEL = previousFast;
  }
});

test("Perplexity executa apenas pesquisa web e devolve as fontes ao orquestrador", async () => {
  const previous = process.env.PERPLEXITY_API_KEY;
  process.env.PERPLEXITY_API_KEY = "perplexity-test-key";
  let requestBody: Record<string, unknown> = {};

  try {
    const evidence = await researchPerplexity("boi gordo em São Paulo", {
      currentMarketSearch: true,
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Cotação confirmada em fonte primária." } }],
            citations: ["https://example.test/cotacao"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    assert.equal(requestBody.search_mode, "web");
    assert.equal(requestBody.search_recency_filter, "week");
    assert.match(
      String((requestBody.messages as Array<{ content: string }>)[0].content),
      /SOMENTE evidências/i,
    );
    assert.match(evidence, /https:\/\/example\.test\/cotacao/);
  } finally {
    if (previous === undefined) delete process.env.PERPLEXITY_API_KEY;
    else process.env.PERPLEXITY_API_KEY = previous;
  }
});

test("embeddings do RAG usam OpenAI com 3072 dimensões", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "openai-embedding-test-key";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    assert.deepEqual(await embedTexts(["conteúdo técnico"]), [[0.1, 0.2, 0.3]]);
    assert.equal(requestBody.model, "text-embedding-3-large");
    assert.equal(requestBody.dimensions, 3072);
    assert.equal(embeddingProvider(), "openai:text-embedding-3-large:3072");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("migração separa espaços vetoriais e mantém RAG privado", async () => {
  const sql = await readFile(
    "supabase/migrations/20260814180000_openai_rag_embeddings.sql",
    "utf8",
  );
  assert.match(sql, /embedding_provider/);
  assert.match(sql, /openai:text-embedding-3-large:3072/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/);
});
