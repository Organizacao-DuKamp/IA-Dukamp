import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dispatchChat, type TpecBackendDependencies } from "../src/lib/chat/backend.server.ts";
import { handlePublicChatRequest } from "../src/lib/chat/http.server.ts";
import type { ChatCoreResult, ChatInput } from "../src/lib/chat/input.ts";
import { currentMemoryMarker } from "../src/lib/chat/memory-reset.ts";

const input: ChatInput = {
  sessionId: "session-1",
  conversationId: "conversation-1",
  clientMessageId: "message-1",
  text: "Quais são os vendedores ativos da DuKamp?",
  history: [
    { role: "user", content: "Bom dia" },
    { role: "assistant", content: "Bom dia!" },
  ],
  state: { current_topic: "vendedores" },
};

const coreResult: ChatCoreResult = {
  reply: "Vendedores ativos da DuKamp: Brenda e Andressa.",
  state: { current_topic: "vendedores", turn_count: 2 },
  conversationId: "conversation-1",
  diagnostics: { model: "gpt-5.6-terra", retrieved_blocks: ["site"] },
};

function localDeps(): TpecBackendDependencies {
  return {
    loadLocalBackend: async () => ({
      handleIncoming: async (received) => {
        assert.deepEqual(received, input);
        return coreResult;
      },
    }),
  };
}

test("o backend standalone chama handleIncoming no próprio runtime", async () => {
  const result = await dispatchChat(input, localDeps());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, coreResult);
});

test("o dispatch não faz chamadas externas", async () => {
  let fetched = false;
  const result = await dispatchChat(input, {
    env: {
      UNRELATED_EXTERNAL_BACKEND: "https://example.invalid",
    },
    fetchImpl: async () => {
      fetched = true;
      throw new Error("o backend standalone não deve fazer proxy");
    },
    ...localDeps(),
  });
  assert.equal(fetched, false);
  assert.deepEqual(result.body, coreResult);
});

test("rota pública preserva status HTTP e serializa o estado opaco", async () => {
  const previous = process.env.TPEC_MULTIMODEL_ENABLED;
  process.env.TPEC_MULTIMODEL_ENABLED = "false";
  try {
    const response = await handlePublicChatRequest(
      new Request("https://netlify.example/api/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      {
        loadLocalBackend: async () => ({
          handleIncoming: async (received) => {
            assert.deepEqual(received.history, []);
            assert.equal(received.state, undefined);
            assert.notEqual(received.conversationId, input.conversationId);
            return coreResult;
          },
        }),
      },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      reply: string;
      state: string;
      conversationId: string;
    };
    assert.equal(body.reply, coreResult.reply);
    assert.equal(body.conversationId, coreResult.conversationId);
    const state = JSON.parse(body.state);
    assert.equal(state.current_topic, "vendedores");
    assert.equal(state.turn_count, 2);
    assert.deepEqual(currentMemoryMarker(state)?.history, [
      { role: "user", content: input.text },
      { role: "assistant", content: coreResult.reply },
    ]);
  } finally {
    if (previous === undefined) delete process.env.TPEC_MULTIMODEL_ENABLED;
    else process.env.TPEC_MULTIMODEL_ENABLED = previous;
  }
});

test("código do navegador não referencia segredos de servidor", async () => {
  const source = await readFile("src/lib/chat/web-adapter.ts", "utf8");
  for (const forbidden of ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "PERPLEXITY_API_KEY"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("rota multimodel exige autenticação mesmo com backend de teste", async () => {
  const previous = process.env.TPEC_MULTIMODEL_ENABLED;
  process.env.TPEC_MULTIMODEL_ENABLED = "true";
  try {
    const response = await handlePublicChatRequest(
      new Request("https://netlify.example/api/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
      localDeps(),
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "unauthorized");
  } finally {
    if (previous === undefined) delete process.env.TPEC_MULTIMODEL_ENABLED;
    else process.env.TPEC_MULTIMODEL_ENABLED = previous;
  }
});
