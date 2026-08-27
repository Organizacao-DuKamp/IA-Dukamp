import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  askOpenAI,
  chatModelKindForChannel,
  openAIModel,
  researchPlanForRequest,
} from "../src/lib/chat/openai.server.ts";
import { embeddingProvider, embedTexts } from "../src/lib/rag/embeddings.server.ts";

function openAIResponse(text: string) {
  return new Response(JSON.stringify({ output_text: text, status: "completed" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("GPT-5.6 Sol é o cérebro padrão em web e WhatsApp", () => {
  const previousTpec = process.env.OPENAI_TPEC_MODEL;
  const previousLegacyCapable = process.env.OPENAI_CAPABLE_MODEL;
  const previousLegacyModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_TPEC_MODEL;
  process.env.OPENAI_CAPABLE_MODEL = "gpt-5";
  process.env.OPENAI_MODEL = "gpt-5-mini";

  try {
    assert.equal(openAIModel("capable"), "gpt-5.6-sol");
    assert.equal(openAIModel("fast"), "gpt-5.6-sol");
    assert.equal(chatModelKindForChannel("whatsapp"), "capable");
    assert.equal(chatModelKindForChannel("web"), "capable");
  } finally {
    if (previousTpec === undefined) delete process.env.OPENAI_TPEC_MODEL;
    else process.env.OPENAI_TPEC_MODEL = previousTpec;
    if (previousLegacyCapable === undefined) delete process.env.OPENAI_CAPABLE_MODEL;
    else process.env.OPENAI_CAPABLE_MODEL = previousLegacyCapable;
    if (previousLegacyModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousLegacyModel;
  }
});

test("OPENAI_TPEC_MODEL permite trocar explicitamente o cérebro da TPEC", () => {
  const previous = process.env.OPENAI_TPEC_MODEL;
  process.env.OPENAI_TPEC_MODEL = "gpt-5.6-sol-custom";
  try {
    assert.equal(openAIModel(), "gpt-5.6-sol-custom");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_TPEC_MODEL;
    else process.env.OPENAI_TPEC_MODEL = previous;
  }
});

test("turno sem evidência privada recebe Web Search do ChatGPT em modo auto", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_TPEC_MODEL;
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.OPENAI_TPEC_MODEL = "gpt-5.6-sol";
  let requestBody: Record<string, unknown> = {};

  try {
    const reply = await askOpenAI([{ role: "user", content: "Explique esse assunto atual" }], {
      channel: "whatsapp",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return openAIResponse("Resposta pesquisada quando necessário.");
      }) as typeof fetch,
    });

    assert.equal(reply, "Resposta pesquisada quando necessário.");
    assert.equal(requestBody.model, "gpt-5.6-sol");
    assert.equal(requestBody.store, false);
    assert.deepEqual(requestBody.reasoning, { effort: "medium" });
    assert.equal(requestBody.tool_choice, "auto");
    assert.deepEqual(requestBody.tools, [
      { type: "web_search_preview", search_context_size: "medium" },
    ]);
    assert.deepEqual(requestBody.include, ["web_search_call.action.sources"]);
    assert.equal(requestBody.max_output_tokens, 4_000);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_TPEC_MODEL;
    else process.env.OPENAI_TPEC_MODEL = previousModel;
  }
});

test("pesquisa aprofundada é obrigatória e sobe raciocínio para high", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-deep-test-key";
  let requestBody: Record<string, unknown> = {};

  try {
    await askOpenAI([{ role: "user", content: "Qual a situação atual do mercado?" }], {
      context:
        "PESQUISA EXTERNA ATUAL\nCHATGPT_WEB_SEARCH_REQUIRED\nPROFILE: market_intelligence\nDEPTH: high\nQUERY: mercado do boi gordo",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return openAIResponse("Pesquisa aprofundada concluída.");
      }) as typeof fetch,
    });

    assert.deepEqual(requestBody.reasoning, { effort: "high" });
    assert.equal(requestBody.tool_choice, "required");
    assert.deepEqual(requestBody.tools, [
      { type: "web_search_preview", search_context_size: "high" },
    ]);
    assert.match(String(requestBody.instructions), /não existe provedor Perplexity ativo/i);
    assert.match(String(requestBody.instructions), /CHATGPT_WEB_SEARCH_REQUIRED/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("evidência privada explícita é usada sem forçar pesquisa externa", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-private-test-key";
  let requestBody: Record<string, unknown> = {};

  try {
    await askOpenAI([{ role: "user", content: "Qual a composição desse produto?" }], {
      context:
        "TRECHOS TÉCNICOS DA BASE INTERNA\nProduto oficial DuKamp: composição confirmada no contexto.",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return openAIResponse("Resposta com a base oficial.");
      }) as typeof fetch,
    });

    assert.deepEqual(requestBody.reasoning, { effort: "medium" });
    assert.equal("tools" in requestBody, false);
    assert.equal("tool_choice" in requestBody, false);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("plano de pesquisa segue fallback ChatGPT-first", () => {
  const auto = researchPlanForRequest([{ role: "user", content: "pergunta técnica" }], {});
  assert.deepEqual(auto, {
    enabled: true,
    required: false,
    depth: "medium",
    reasoningEffort: "medium",
  });

  const privateEvidence = researchPlanForRequest(
    [{ role: "user", content: "pergunta sobre produto" }],
    { context: "DADOS ESTRUTURADOS DO CATÁLOGO: produto oficial" },
  );
  assert.equal(privateEvidence.enabled, false);

  const deep = researchPlanForRequest([{ role: "user", content: "mercado" }], {
    context: "CHATGPT_WEB_SEARCH_REQUIRED\nDEPTH: high",
  });
  assert.equal(deep.required, true);
  assert.equal(deep.depth, "high");
  assert.equal(deep.reasoningEffort, "high");
});

test("OpenAI recebe histórico, estado e contexto para produzir a resposta final", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-history-test-key";
  let requestUrl = "";
  let requestHeaders = new Headers();
  let requestBody: Record<string, unknown> = {};

  try {
    const reply = await askOpenAI(
      [
        { role: "user", content: "Qual a composição?" },
        { role: "assistant", content: "De qual produto?" },
        { role: "user", content: "Daquele suplemento." },
      ],
      {
        summary: '{"topic":"produto"}',
        state: '{"product":"suplemento"}',
        directive: "Responder a continuação sem repetir perguntas.",
        sourcePolicy: "Não invente dados comerciais.",
        context: "DADOS OFICIAIS PRIVADOS: composição confirmada.",
        fetchImpl: (async (url: RequestInfo | URL, init?: RequestInit) => {
          requestUrl = String(url);
          requestHeaders = new Headers(init?.headers);
          requestBody = JSON.parse(String(init?.body));
          return openAIResponse("Resposta fundamentada.");
        }) as typeof fetch,
      },
    );

    assert.equal(reply, "Resposta fundamentada.");
    assert.equal(requestUrl, "https://api.openai.com/v1/responses");
    assert.equal(requestHeaders.get("authorization"), "Bearer openai-history-test-key");
    assert.match(String(requestBody.instructions), /DADOS OFICIAIS PRIVADOS/);
    assert.match(String(requestBody.instructions), /product/);
    assert.deepEqual(
      (requestBody.input as Array<{ role: string }>).map((message) => message.role),
      ["user", "assistant", "user"],
    );
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("embeddings do RAG continuam usando OpenAI com 3072 dimensões", async () => {
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
