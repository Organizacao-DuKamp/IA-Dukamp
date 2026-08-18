import assert from "node:assert/strict";
import test from "node:test";

import { askOpenAI } from "../src/lib/chat/openai.server.ts";

const previousKey = process.env.OPENAI_API_KEY;

function restoreKey() {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

test("marcador confiável do WhatsApp ativa estilo conversacional sem ir para o input", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let requestBody: Record<string, unknown> | undefined;

  try {
    const reply = await askOpenAI(
      [
        { role: "system", content: "CANAL ATUAL: WhatsApp. marcador interno" },
        { role: "user", content: "Qual o preço do boi China hoje?" },
      ],
      {
        model: "fast",
        fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
          requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return new Response(JSON.stringify({ output_text: "Resposta natural" }), { status: 200 });
        }) as typeof fetch,
      },
    );

    assert.equal(reply, "Resposta natural");
    assert.match(String(requestBody?.instructions), /ESTILO DO CANAL — WHATSAPP/);
    assert.match(String(requestBody?.instructions), /não um relatório/i);
    assert.deepEqual(requestBody?.input, [
      { role: "user", content: "Qual o preço do boi China hoje?" },
    ]);
  } finally {
    restoreKey();
  }
});

test("chat sem marcador não recebe instrução específica de WhatsApp", async () => {
  process.env.OPENAI_API_KEY = "test-openai-key";
  let instructions = "";

  try {
    await askOpenAI([{ role: "user", content: "Olá" }], {
      model: "fast",
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { instructions?: unknown };
        instructions = String(body.instructions ?? "");
        return new Response(JSON.stringify({ output_text: "Oi" }), { status: 200 });
      }) as typeof fetch,
    });

    assert.doesNotMatch(instructions, /ESTILO DO CANAL — WHATSAPP/);
  } finally {
    restoreKey();
  }
});