import assert from "node:assert/strict";
import test from "node:test";
import {
  embedPrivateMemory,
  processPrivateSemanticMemory,
  recallPrivateSemantic,
  wantsSemanticRecall,
  type SemanticMemoryStore,
  type SemanticClaim,
} from "../src/lib/chat/context/semantic.server.ts";
import { fuseConversationRecall } from "../src/lib/chat/context/hybrid.ts";
import {
  recallWhatsAppContext,
  renderRecall,
  type RecallArchive,
} from "../src/lib/chat/context/whatsapp.server.ts";

const vector = Array.from({ length: 3072 }, (_, i) => (i === 0 ? 1 : 0));
const now = new Date("2026-10-23T16:00:00Z"),
  phone = "5517999991111";
const empty: RecallArchive = { turns: [], facts: [], total: 0, reset_at: "2026-10-14T00:00:00Z" };
const old = {
  id: "episode",
  created_at: "2026-10-18T10:00:00Z",
  user_text: "A novilha Estrela parou de comer no pasto 3.",
  assistant_text: "Observe os sinais e procure um veterinário.",
  score: 0.8,
};
const correction = {
  id: "correction",
  created_at: "2026-10-22T10:00:00Z",
  user_text: "Atualização: a Estrela voltou a comer; o pasto era 4, não 3.",
  assistant_text: null,
  score: 0.1,
};
const claim: SemanticClaim = {
  turn_id: "00000000-0000-4000-8000-000000000001",
  phone_number: phone,
  user_text: old.user_text,
  source_hash: "a".repeat(64),
  lock_token: "00000000-0000-4000-8000-000000000002",
};
const store: SemanticMemoryStore = {
  claim: async () => [claim],
  finish: async () => true,
  search: async () => ({ ...empty, turns: [old, correction], total: 2 }),
};

test("semantic recall targets earlier references and implicit followups while exact dates use the original archive", () => {
  for (const text of [
    "Você lembra do lote 2?",
    "Continua aquela análise.",
    "O problema da novilha melhorou?",
    "Qual ração você tinha me recomendado?",
    "Quanto pesavam meus animais na última pesagem?",
  ])
    assert.equal(wantsSemanticRecall(text, now), true, text);
  for (const text of [
    "O que conversamos ontem?",
    "Mostre as pesagens de 21/10/2026",
    "Explique fotossíntese",
    "Bom dia",
  ])
    assert.equal(wantsSemanticRecall(text, now), false, text);
});
test("private search uses the verified sender and keeps later corrections and source identities", async () => {
  const r = await recallPrivateSemantic(
    { phone, text: "O problema da novilha melhorou?", now },
    {
      enabled: true,
      embed: async () => [vector],
      store: {
        ...store,
        search: async (owner, provider, v, before) => {
          assert.equal(owner, phone);
          assert.match(provider, /^openai:/);
          assert.equal(before, now.toISOString());
          assert.deepEqual(v, vector);
          return { ...empty, turns: [old, correction], total: 2 };
        },
      },
    },
  );
  assert.equal(r.status, "available");
  if (r.status !== "available") return;
  const recall = renderRecall(fuseConversationRecall(empty, r.archive), null, now);
  assert.deepEqual(recall.sourceIds, ["episode", "correction"]);
  assert.match(recall.context, /voltou a comer/);
  assert.match(recall.context, /pasto era 4/);
  assert.match(recall.context, /não fatos automaticamente confirmados/);
  assert.equal(recall.partial, true);
});
test("disabled, dated and unrelated recall makes no private provider call", async () => {
  let calls = 0;
  const embed = async () => {
    calls++;
    return [vector];
  };
  for (const [text, enabled] of [
    ["Lembra do lote 2?", false],
    ["Lembra de ontem?", true],
    ["Explique fotossíntese", true],
  ] as const)
    assert.equal(
      (await recallPrivateSemantic({ phone, text, now }, { enabled, embed, store })).status,
      "skipped",
    );
  assert.equal(calls, 0);
  assert.deepEqual(
    await processPrivateSemanticMemory({
      enabled: true,
      deploymentContext: "deploy-preview",
      store,
      embed,
    }),
    { enabled: false },
  );
  assert.equal(calls, 0);
});
test("private provider or vector failure degrades to lexical originals without saying that history was never sent", async () => {
  const unavailable = await recallPrivateSemantic(
    { phone, text: "Lembra da novilha?", now },
    { enabled: true, store, embed: async () => [[0]] },
  );
  assert.equal(unavailable.status, "unavailable");
  const recall = await recallWhatsAppContext(
    { phone, text: "Lembra da novilha?" },
    {
      now,
      store: async () => ({ ...empty, turns: [old], total: 1 }),
      semantic: async () => unavailable,
    },
  );
  assert.equal(recall.status, "available");
  assert.match(recall.context, /Estrela/);
  assert.match(recall.context, /semântica privada está temporariamente indisponível/);
  assert.equal(recall.partial, true);
});
test("semantic evidence can recover when the lexical service fails, with private history treated as untrusted", async () => {
  const recall = await recallWhatsAppContext(
    { phone, text: "Lembra da novilha?" },
    {
      now,
      store: async () => {
        throw new Error("db timeout");
      },
      semantic: async () => ({
        status: "available",
        archive: { ...empty, turns: [old], total: 1 },
      }),
    },
  );
  assert.equal(recall.status, "available");
  assert.match(recall.context, /Estrela/);
  assert.match(recall.context, /dados históricos não confiáveis/);
});
test("fusion deduplicates, normalizes independent rankings and applies the newest privacy boundary", () => {
  const lexical = {
    ...empty,
    turns: [{ ...old, score: 900 }, correction],
    total: 2,
    reset_at: "2026-10-20T00:00:00Z",
  };
  const fused = fuseConversationRecall(lexical, { ...empty, turns: [old, correction], total: 2 });
  assert.deepEqual(
    fused.turns.map((t) => t.id),
    ["correction"],
  );
  assert.ok(fused.turns[0].score! < 1);
  assert.equal(fused.reset_at, lexical.reset_at);
});
test("budgeted hybrid context retains a relevant older episode alongside current corrections", () => {
  const noise = Array.from({ length: 50 }, (_, i) => ({
    id: `noise${i}`,
    created_at: new Date(Date.parse("2026-10-22T11:00:00Z") + i * 60000).toISOString(),
    user_text: "Conversa sobre chuva. ".repeat(100),
    assistant_text: null,
    score: 0,
  }));
  const fused = fuseConversationRecall(
    { ...empty, turns: [correction, ...noise], total: 51 },
    { ...empty, turns: [old, correction], total: 2 },
  );
  const recall = renderRecall(fused, null, now, 14000);
  assert.match(recall.context, /Estrela parou/);
  assert.match(recall.context, /Estrela voltou/);
  assert.ok(recall.context.length < 16000);
  assert.equal(recall.partial, true);
});
test("hybrid entity ranking distinguishes lote 2 from lote 20 without fuzzy numeric identities", () => {
  const two = { ...old, id: "two", user_text: "Lote 2: novilhas em observação" };
  const twenty = { ...old, id: "twenty", user_text: "Lote 20: novilhas em observação" };
  const fused = fuseConversationRecall(
    empty,
    { ...empty, turns: [twenty, two], total: 2 },
    "Lembra do lote 2?",
  );
  assert.ok(
    fused.turns.find((t) => t.id === "two")!.score! >
      fused.turns.find((t) => t.id === "twenty")!.score!,
  );
});
test("batch indexing has bounded calls and discarded completion cannot claim a successful save", async () => {
  const result = await processPrivateSemanticMemory({
    enabled: true,
    deploymentContext: "production",
    limit: 500,
    dailyBudget: 99,
    embed: async (texts, purpose) => {
      assert.deepEqual(texts, [old.user_text]);
      assert.equal(purpose, "index");
      return [vector];
    },
    store: {
      ...store,
      claim: async (_provider, limit, budget) => {
        assert.equal(limit, 8);
        assert.equal(budget, 99);
        return [claim];
      },
      finish: async () => false,
    },
  });
  assert.deepEqual(result, { enabled: true, claimed: 1, indexed: 0, failed: 0, discarded: 1 });
});
test("embedding failure records a retry outcome without leaking provider text or doing a second call", async () => {
  let calls = 0,
    saved: number[] | null | undefined;
  const result = await processPrivateSemanticMemory({
    enabled: true,
    deploymentContext: "production",
    embed: async () => {
      calls++;
      throw new Error("PRIVATE DATA");
    },
    store: {
      ...store,
      finish: async (_claim, _provider, v) => {
        saved = v;
        return true;
      },
    },
  });
  assert.equal(calls, 1);
  assert.equal(saved, null);
  assert.deepEqual(result, { enabled: true, claimed: 1, indexed: 0, failed: 1, discarded: 0 });
});
test("private embedding client validates dimensions, order and duplicates and sanitizes provider errors", async () => {
  const one = async (payload: unknown, status = 200) =>
    embedPrivateMemory(["Dado privado"], "query", {
      apiKey: "test-key",
      fetch: async () => new Response(JSON.stringify(payload), { status }),
    });
  await assert.rejects(
    one({ error: { message: "Dado privado e segredo" } }, 429),
    (e: Error) => e.message === "private_embeddings_unavailable",
  );
  await assert.rejects(
    one({ data: [{ index: 0, embedding: [1] }] }),
    /private_embeddings_unavailable/,
  );
  await assert.rejects(
    one({ data: [{ index: 0, embedding: Array(3072).fill(0) }] }),
    /private_embeddings_unavailable/,
  );
  assert.deepEqual(await one({ data: [{ index: 0, embedding: vector }] }), [vector]);
  await assert.rejects(
    embedPrivateMemory(["Um registro", "Outro registro"], "index", {
      apiKey: "test-key",
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: [
              { index: 0, embedding: vector },
              { index: 0, embedding: vector },
            ],
          }),
        ),
    }),
    /private_embeddings_unavailable/,
  );
});
