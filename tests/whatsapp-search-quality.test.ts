import assert from "node:assert/strict";
import test from "node:test";

import { askOpenAI } from "../src/lib/chat/openai.server.ts";
import {
  researchChatGPT,
  researchDepthForQuery,
  researchProfileForQuery,
} from "../src/lib/chat/perplexity.server.ts";

const previousOpenAIKey = process.env.OPENAI_API_KEY;
const previousModel = process.env.OPENAI_TPEC_MODEL;

function restoreEnv() {
  if (previousOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAIKey;
  if (previousModel === undefined) delete process.env.OPENAI_TPEC_MODEL;
  else process.env.OPENAI_TPEC_MODEL = previousModel;
}

test("WhatsApp recebe instrução conversacional sem contaminar o input do usuário", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_TPEC_MODEL = "gpt-5.6-sol";
  let body: Record<string, unknown> | undefined;

  try {
    const reply = await askOpenAI(
      [{ role: "user", content: "Como está o mercado de carnes hoje?" }],
      {
        model: "capable",
        channel: "whatsapp",
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return new Response(JSON.stringify({ output_text: "Resposta natural" }), { status: 200 });
        }) as typeof fetch,
      },
    );

    assert.equal(reply, "Resposta natural");
    assert.match(String(body?.instructions), /ESTILO DO CANAL — WHATSAPP/);
    assert.match(String(body?.instructions), /conversa real e profissional/i);
    assert.deepEqual(body?.input, [
      { role: "user", content: "Como está o mercado de carnes hoje?" },
    ]);
    // `capable` é um override explícito legado e continua fixando Sol.
    assert.equal(body?.model, "gpt-5.6-sol");
    assert.deepEqual(body?.reasoning, { effort: "medium" });
    assert.equal(body?.tool_choice, "auto");
  } finally {
    restoreEnv();
  }
});

test("estado wa também ativa o estilo de WhatsApp quando o canal não foi propagado", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let instructions = "";

  try {
    await askOpenAI([{ role: "user", content: "Me explica isso" }], {
      model: "capable",
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

test("panorama atual de mercado começa em pesquisa média com fontes fortes", async () => {
  const result = await researchChatGPT("Como está o mercado de carnes no Brasil hoje?");

  assert.equal(
    researchProfileForQuery("Como está o mercado de carnes no Brasil hoje?"),
    "market_intelligence",
  );
  assert.equal(researchDepthForQuery("Como está o mercado de carnes no Brasil hoje?"), "medium");
  assert.match(result, /CHATGPT_WEB_SEARCH_REQUIRED/);
  assert.match(result, /DEPTH: medium/);
  assert.match(result, /Cruze dados primários recentes/i);
});

test("regra sanitária vigente exige fonte oficial sem começar em high", async () => {
  const result = await researchChatGPT(
    "Qual a regra vigente para vacinação contra brucelose hoje?",
  );

  assert.equal(
    researchProfileForQuery("Qual a regra vigente para vacinação contra brucelose hoje?"),
    "regulation",
  );
  assert.equal(
    researchDepthForQuery("Qual a regra vigente para vacinação contra brucelose hoje?"),
    "medium",
  );
  assert.match(result, /DEPTH: medium/);
  assert.match(result, /MAPA, Diário Oficial, órgãos estaduais/i);
  assert.match(result, /alterações, revogações, data de vigência/i);
});

test("pesquisa não depende de chave ou retry de um segundo provedor", async () => {
  delete process.env.PERPLEXITY_API_KEY;
  let calls = 0;

  const result = await researchChatGPT("Notícias do mercado pecuário hoje", {
    fetchImpl: (async () => {
      calls += 1;
      throw new Error("não deveria ser chamado");
    }) as typeof fetch,
  });

  assert.equal(calls, 0);
  assert.match(result, /CHATGPT_WEB_SEARCH_REQUIRED/);
  assert.doesNotMatch(result, /api\.perplexity|pplx-/i);
});
