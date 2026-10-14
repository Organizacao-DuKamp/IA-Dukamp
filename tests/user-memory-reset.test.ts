import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareWebMemory,
  stampMemoryState,
  currentMemoryMarker,
  currentMemoryInboxText,
  USER_MEMORY_EPOCH,
  MEMORY_INBOX_PREFIX,
  MEMORY_STORAGE_KEY,
} from "../src/lib/chat/memory-reset.ts";
import { normalizeState } from "../src/lib/chat/state.ts";
import type { ChatInput } from "../src/lib/chat/input.ts";
import { handlePublicChatRequest } from "../src/lib/chat/http.server.ts";

const legacy: ChatInput = {
  sessionId: "test-reset",
  conversationId: "old-chat",
  text: "Olá",
  history: [{ role: "user", content: "Meu lote antigo tem 80 vacas" }],
  state: { confirmed_data: { vacas: 80 }, conversation_summary: { known_facts: ["80 vacas"] } },
};
test("primeiro pedido descarta histórico, resumo, fatos confirmados e identidade da conversa anterior", () => {
  const clean = prepareWebMemory(legacy);
  assert.deepEqual(clean.history, []);
  assert.equal(clean.state, undefined);
  assert.notEqual(clean.conversationId, legacy.conversationId);
  assert.equal(clean.text, "Olá");
});
test("aba antiga não reintroduz o prefixo antigo nem quando sua janela de histórico desliza", () => {
  const history = [
    { role: "user" as const, content: "Agora tenho 5 bezerros" },
    { role: "assistant" as const, content: "Qual a idade?" },
  ];
  const state = stampMemoryState({ current_topic: "bezerros" }, history);
  const clean = prepareWebMemory({
    ...legacy,
    state,
    history: Array.from({ length: 60 }, () => ({ role: "user", content: "80 vacas antigas" })),
  });
  assert.deepEqual(clean.history, history);
  assert.equal(clean.conversationId, "old-chat");
});
test("novas mensagens continuam com contexto e preservam o início da geração", () => {
  const first = stampMemoryState({}, [{ role: "user", content: "novo lote" }]);
  const next = stampMemoryState(normalizeState(first, "new"), [
    { role: "user", content: "novo lote" },
    { role: "assistant", content: "idade?" },
  ]);
  assert.equal(currentMemoryMarker(first)?.started_at, currentMemoryMarker(next)?.started_at);
  assert.equal(currentMemoryMarker(next)?.history.length, 2);
});
test("marcador inválido ou de geração anterior não restaura contexto", () => {
  for (const marker of [
    { epoch: "old", started_at: new Date().toISOString() },
    { epoch: USER_MEMORY_EPOCH, started_at: "invalid" },
  ]) {
    assert.deepEqual(prepareWebMemory({ ...legacy, state: { memory_reset: marker } }).history, []);
  }
});
test("estado serializado de uma conversa nova mantém somente seu histórico novo", () => {
  const state = stampMemoryState({}, [{ role: "assistant", content: "Olá, sou a TPEC-IA" }]);
  assert.equal(prepareWebMemory({ ...legacy, state: JSON.stringify(state) }).history.length, 1);
});
test("fila de extração antiga é ignorada e mensagens novas têm o marcador removido antes da IA", () => {
  assert.equal(currentMemoryInboxText("lote antigo"), null);
  assert.equal(currentMemoryInboxText(MEMORY_INBOX_PREFIX + "novo lote"), "novo lote");
});
test("nova geração usa outra chave de navegador e limita o histórico", () => {
  assert.notEqual(MEMORY_STORAGE_KEY, "tpec-ia:conversation:v1");
  const marker = currentMemoryMarker(
    stampMemoryState(
      {},
      Array.from({ length: 70 }, () => ({ role: "user", content: "x".repeat(9000) })),
    ),
  );
  assert.equal(marker?.history.length, 40);
  assert.equal(marker?.history[0].content.length, 4000);
});
test("rota pública reinicia uma vez e continua a conversa nova mesmo com histórico legado no navegador", async () => {
  const previous = process.env.TPEC_MULTIMODEL_ENABLED;
  process.env.TPEC_MULTIMODEL_ENABLED = "false";
  const received: ChatInput[] = [];
  const deps = {
    loadLocalBackend: async () => ({
      handleIncoming: async (input: ChatInput) => {
        received.push(input);
        return {
          reply: received.length === 1 ? "Olá! Como posso ajudar?" : "Qual a idade dos 5 bezerros?",
          state: { turn_count: received.length },
          conversationId: input.conversationId!,
          diagnostics: {},
        };
      },
    }),
  };
  const request = (input: ChatInput) =>
    new Request("https://test.invalid/api/public/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  try {
    const one = await handlePublicChatRequest(request(legacy), deps);
    assert.equal(one.status, 200);
    const first = await one.json();
    const two = await handlePublicChatRequest(
      request({
        ...legacy,
        text: "Tenho 5 bezerros",
        conversationId: first.conversationId,
        state: first.state,
      }),
      deps,
    );
    assert.equal(two.status, 200);
    assert.deepEqual(received[0].history, []);
    assert.equal(received[1].history.length, 2);
    assert.equal(JSON.stringify(received).includes("80 vacas"), false);
  } finally {
    if (previous === undefined) delete process.env.TPEC_MULTIMODEL_ENABLED;
    else process.env.TPEC_MULTIMODEL_ENABLED = previous;
  }
});
