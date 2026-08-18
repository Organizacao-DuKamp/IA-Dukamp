import assert from "node:assert/strict";
import test from "node:test";

import { askOpenAI } from "../src/lib/chat/openai.server.ts";
import { researchPerplexity } from "../src/lib/chat/perplexity.server.ts";

const previousOpenAIKey = process.env.OPENAI_API_KEY;
const previousPerplexityKey = process.env.PERPLEXITY_API_KEY;

function restoreEnv() {
  if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAIKey;
  if (previousPerplexityKey === undefined) delete process.env.PERPLEXITY_API_KEY;
  else process.env.PERPLEXITY_API_KEY = previousPerplexityKey;
}

test("WhatsApp recebe instrução conversacional sem contaminar o input do usuário", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let body: Record<string, unknown> | undefined;

  try {
    const reply = await askOpenAI(
      [{ role: "user", content: "Como está o mercado de carnes hoje?" }],
      {
        model: "fast",
        channel: "whatsapp",
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return new Response(JSON.stringify({ output_text: "Resposta natural" }), { status: 200 });
        }) as typeof fetch,
      },
    );

    assert.equal(reply, "Resposta natural");
    assert.match(String(body?.instructions), /ESTILO DO CANAL — WHATSAPP/);
    assert.match(String(body?.instructions), /nunca como relatório automático/i);
    assert.deepEqual(body?.input, [
      { role: "user", content: "Como está o mercado de carnes hoje?" },
    ]);
  } finally {
    restoreEnv();
  }
});

test("estado wa também ativa o estilo de WhatsApp quando o canal não foi propagado", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let instructions = "";

  try {
    await askOpenAI([{ role: "user", content: "Me explica isso" }], {
      model: "fast",
      state: JSON.stringify({ conversation_id: "wa:5517999999999" }),
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { instructions?: unknown };
        instructions = String(body.instructions ?? "");
        return new Response(JSON.stringify({ output_text: "Claro." }), { status: 200 });
      }) as typeof fetch,
    });
    assert.match(instructions, /ESTILO DO CANAL — WHATSAPP/);
  } finally {
    restoreEnv();
  }
});

test("panorama atual de mercado limita pesquisa à janela recente", async () => {
  process.env.PERPLEXITY_API_KEY = "test-perplexity-key";
  let body: Record<string, unknown> | undefined;

  try {
    const result = await researchPerplexity("Como está o mercado de carnes no Brasil hoje?", {
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Mercado com dados recentes." } }],
            citations: ["https://example.com/fonte"],
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    });

    assert.equal(body?.search_recency_filter, "week");
    assert.match(result, /Mercado com dados recentes/);
  } finally {
    restoreEnv();
  }
});

test("regra sanitária vigente não recebe filtro semanal que esconderia norma válida", async () => {
  process.env.PERPLEXITY_API_KEY = "test-perplexity-key";
  let body: Record<string, unknown> | undefined;

  try {
    await researchPerplexity("Qual a regra vigente para vacinação contra brucelose hoje?", {
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "Regra oficial encontrada." } }] }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    assert.equal("search_recency_filter" in (body ?? {}), false);
  } finally {
    restoreEnv();
  }
});

test("pesquisa externa repete uma única vez após erro transitório", async () => {
  process.env.PERPLEXITY_API_KEY = "test-perplexity-key";
  let calls = 0;

  try {
    const result = await researchPerplexity("Notícias do mercado pecuário hoje", {
      fetchImpl: (async () => {
        calls += 1;
        if (calls === 1) return new Response("temporarily unavailable", { status: 503 });
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "Pesquisa recuperada." } }] }),
          { status: 200 },
        );
      }) as typeof fetch,
    });

    assert.equal(calls, 2);
    assert.match(result, /Pesquisa recuperada/);
  } finally {
    restoreEnv();
  }
});
