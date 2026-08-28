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

test("família GPT-5.6 usa Luna Terra Sol com seleção adaptativa", () => {
  const previous = {
    luna: process.env.OPENAI_TPEC_LUNA_MODEL,
    terra: process.env.OPENAI_TPEC_TERRA_MODEL,
    sol: process.env.OPENAI_TPEC_SOL_MODEL,
    legacyTpec: process.env.OPENAI_TPEC_MODEL,
    legacyCapable: process.env.OPENAI_CAPABLE_MODEL,
    legacyModel: process.env.OPENAI_MODEL,
  };
  delete process.env.OPENAI_TPEC_LUNA_MODEL;
  delete process.env.OPENAI_TPEC_TERRA_MODEL;
  delete process.env.OPENAI_TPEC_SOL_MODEL;
  delete process.env.OPENAI_TPEC_MODEL;
  process.env.OPENAI_CAPABLE_MODEL = "gpt-5";
  process.env.OPENAI_MODEL = "gpt-5-mini";

  try {
    assert.equal(openAIModel("luna"), "gpt-5.6-luna");
    assert.equal(openAIModel("terra"), "gpt-5.6-terra");
    assert.equal(openAIModel("sol"), "gpt-5.6-sol");
    assert.equal(openAIModel("fast"), "gpt-5.6-terra");
    assert.equal(openAIModel("capable"), "gpt-5.6-sol");
    assert.equal(openAIModel("adaptive"), "adaptive:gpt-5.6");
    assert.equal(chatModelKindForChannel("whatsapp"), "adaptive");
    assert.equal(chatModelKindForChannel("web"), "adaptive");
  } finally {
    for (const [key, value] of Object.entries({
      OPENAI_TPEC_LUNA_MODEL: previous.luna,
      OPENAI_TPEC_TERRA_MODEL: previous.terra,
      OPENAI_TPEC_SOL_MODEL: previous.sol,
      OPENAI_TPEC_MODEL: previous.legacyTpec,
      OPENAI_CAPABLE_MODEL: previous.legacyCapable,
      OPENAI_MODEL: previous.legacyModel,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("variáveis exclusivas permitem trocar cada tier sem afetar os demais", () => {
  const previousTerra = process.env.OPENAI_TPEC_TERRA_MODEL;
  const previousSol = process.env.OPENAI_TPEC_SOL_MODEL;
  const previousLegacy = process.env.OPENAI_TPEC_MODEL;
  process.env.OPENAI_TPEC_TERRA_MODEL = "gpt-5.6-terra-custom";
  process.env.OPENAI_TPEC_SOL_MODEL = "gpt-5.6-sol-custom";
  process.env.OPENAI_TPEC_MODEL = "gpt-5.6-sol-legacy";

  try {
    assert.equal(openAIModel("terra"), "gpt-5.6-terra-custom");
    assert.equal(openAIModel("sol"), "gpt-5.6-sol-custom");
  } finally {
    if (previousTerra === undefined) delete process.env.OPENAI_TPEC_TERRA_MODEL;
    else process.env.OPENAI_TPEC_TERRA_MODEL = previousTerra;
    if (previousSol === undefined) delete process.env.OPENAI_TPEC_SOL_MODEL;
    else process.env.OPENAI_TPEC_SOL_MODEL = previousSol;
    if (previousLegacy === undefined) delete process.env.OPENAI_TPEC_MODEL;
    else process.env.OPENAI_TPEC_MODEL = previousLegacy;
  }
});

test("turno normal sem evidência privada usa Terra medium com Web Search limitado", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousTerra = process.env.OPENAI_TPEC_TERRA_MODEL;
  process.env.OPENAI_API_KEY = "openai-test-key";
  delete process.env.OPENAI_TPEC_TERRA_MODEL;
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
    assert.equal(requestBody.model, "gpt-5.6-terra");
    assert.equal(requestBody.store, false);
    assert.deepEqual(requestBody.reasoning, { effort: "medium" });
    assert.equal(requestBody.tool_choice, "auto");
    assert.deepEqual(requestBody.tools, [
      { type: "web_search_preview", search_context_size: "medium" },
    ]);
    assert.equal(requestBody.max_tool_calls, 2);
    assert.deepEqual(requestBody.include, ["web_search_call.action.sources"]);
    assert.equal(requestBody.max_output_tokens, 3_200);
    assert.equal(requestBody.prompt_cache_key, "tpec-terra-whatsapp");
    assert.deepEqual(requestBody.text, { verbosity: "low" });
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousTerra === undefined) delete process.env.OPENAI_TPEC_TERRA_MODEL;
    else process.env.OPENAI_TPEC_TERRA_MODEL = previousTerra;
  }
});

test("conversa casual usa Luna low sem pesquisa", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-luna-test-key";
  let requestBody: Record<string, unknown> = {};

  try {
    await askOpenAI([{ role: "user", content: "Bom dia" }], {
      channel: "whatsapp",
      sourcePolicy: "CONVERSA CASUAL: responda naturalmente.",
      researchDepth: "none",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return openAIResponse("Bom dia!");
      }) as typeof fetch,
    });

    assert.equal(requestBody.model, "gpt-5.6-luna");
    assert.deepEqual(requestBody.reasoning, { effort: "low" });
    assert.equal("tools" in requestBody, false);
    assert.equal(requestBody.max_output_tokens, 1_800);
    assert.ok(String(requestBody.instructions).length < 4_000);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("pesquisa aprofundada escala para Sol high e limita ferramentas", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "openai-deep-test-key";
  let requestBody: Record<string, unknown> = {};

  try {
    await askOpenAI([{ role: "user", content: "Faça uma análise aprofundada do mercado." }], {
      context:
        "PESQUISA EXTERNA ATUAL\nCHATGPT_WEB_SEARCH_REQUIRED\nPROFILE: market_intelligence\nDEPTH: high\nQUERY: mercado do boi gordo",
      fetchImpl: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return openAIResponse("Pesquisa aprofundada concluída.");
      }) as typeof fetch,
    });

    assert.equal(requestBody.model, "gpt-5.6-sol");
    assert.deepEqual(requestBody.reasoning, { effort: "high" });
    assert.equal(requestBody.tool_choice, "required");
    assert.equal(requestBody.max_tool_calls, 3);
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

test("evidência privada explícita usa Terra sem forçar pesquisa externa", async () => {
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

    assert.equal(requestBody.model, "gpt-5.6-terra");
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
    assert.equal(requestBody.model, "gpt-5.6-terra");
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
