import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import {
  emptyFarm,
  type GuardianAction,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import { supplyBalances } from "../src/lib/guardian/supplies.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import {
  resolveAnimalRegistryTurn,
  extractAnimalRegistrations,
} from "../src/lib/chat/animal-registry.ts";
import {
  createConversationState,
  applyUserTurn,
  classifyUserIntent,
} from "../src/lib/chat/state.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import type { ConversationState } from "../src/lib/chat/state.ts";
const phone = "000000000000585",
  now = new Date("2026-10-29T19:00:00Z");
const source = {
  actor: phone,
  messageId: "original",
  at: now.toISOString(),
  confirmed: true as const,
};
const audio = (s: string) =>
  `[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: ${s}`;
async function fixture() {
  const f = await farmIntegration();
  const base = prepareFarmBatch({
    book: emptyFarm("Eduardo", "Tanabi", "SP"),
    actions: [
      { kind: "herd_count", species: "cattle", count: 120, date: "2026-10-28" },
      { kind: "animal", code: "b01", sex: "male" },
      { kind: "animal", code: "b02", sex: "male" },
    ],
    role: "owner",
    propertyId: "seed",
    source,
    executedByMessageId: "seed",
  }).book;
  await f.guardian.commit({
    phone,
    messageId: "fixture",
    accountVersion: 0,
    propertyId: randomUUID(),
    propertyVersion: null,
    operation: "create",
    pending: null,
    reply: "Criada",
    book: base,
  });
  return f;
}
function grounded(
  c: { propertyId: string | null; messages: Array<{ role: string; content: string }> },
  actions: GuardianAction[],
  intent = "apply",
) {
  return {
    intent,
    propertyId: c.propertyId,
    question: "",
    entries: actions.map((action) => ({
      action,
      evidence: [{ messageIndex: c.messages.length - 1, quote: c.messages.at(-1)!.content }],
    })),
  };
}
test("audio prose never promotes a herd count to genealogy or the WhatsApp wrapper to a commercial topic", () => {
  for (const message of [
    "Tá legal, era pra ficar 190, não? Por conta dessas novas adições.",
    "Eu quero que você altere de 120 cabeças para 190 cabeças.",
    "mais 50 bovinos e 20 porcos",
    "Pode somar esses quatro ao rebanho",
  ]) {
    assert.deepEqual(extractAnimalRegistrations(message), []);
    assert.equal(resolveAnimalRegistryTurn(message).active, false);
  }
  const raw = audio("Na minha fazenda tenho 120 cabeças de gado.");
  const state = createConversationState("qa");
  const result = applyUserTurn(state, raw, classifyUserIntent(raw, state));
  assert.equal(result.current_topic, "gestão da fazenda");
  assert.equal(resolveAnimalRegistryTurn("Consulte na ABCZ GTRT 2551").active, true);
});
test("one contextual request commits purchase, diesel, expense and task atomically, and a later correction replaces the real purchase", async () => {
  const f = await fixture();
  try {
    const actions: GuardianAction[] = [
      {
        kind: "herd_event",
        species: "cattle",
        type: "purchase",
        count: 4,
        date: "2026-10-29",
        description: "Compra no leilão",
      },
      { kind: "fuel_expense", fuel: "diesel", amountCents: 60000, date: "2026-10-29" },
      { kind: "task_create", title: "Visita do veterinário", dueAt: "2026-10-30T16:00:00Z" },
    ];
    const r = await handleGuardianMessage(
      {
        phone,
        messageId: "multi",
        text: audio(
          "Hoje fui num leilão e comprei quatro bois. Gastei uns 600 reais de diesel hoje. Amanhã às 13h vem o veterinário.",
        ),
        mediaType: "audio",
      },
      { store: f.guardian, now, interpret: async (c) => grounded(c, actions) },
    );
    assert.equal(r!.persisted, true, r!.reply!);
    assert.equal(r!.trace!.status, "completed");
    let s = await f.guardian.load(phone),
      b = s.active!.book;
    assert.equal(stockAt(b.operations!, "2026-10-29").count, 124);
    assert.equal(b.ledger.length, 1);
    assert.equal(b.ledger[0].amountCents, 60000);
    assert.equal(b.tasks.length, 1);
    assert.deepEqual(b.lastOperation!.actions, actions);
    assert.equal(b.lastOperation!.resultIds.length, 3);
    const bought = b.operations!.movements[0].id;
    await handleGuardianMessage(
      {
        phone,
        messageId: "correction",
        text: "Na verdade foram cinco.",
        history: [{ role: "assistant", content: "A compra foi de quatro bois?" }],
      },
      {
        store: f.guardian,
        now,
        interpret: async (c) => {
          assert.equal(c.snapshot.active!.book.lastOperation!.resultIds[0], bought);
          return grounded(c, [
            {
              ...(actions[0] as Extract<GuardianAction, { kind: "herd_event" }>),
              count: 5,
              replaces: bought,
            },
          ]);
        },
      },
    );
    s = await f.guardian.load(phone);
    b = s.active!.book;
    assert.equal(stockAt(b.operations!, "2026-10-29").count, 125);
    assert.equal(b.operations!.movements.length, 2);
    assert.equal(b.ledger.length, 1);
    assert.equal(b.tasks.length, 1);
    assert.equal(b.animals.length, 2);
  } finally {
    await f.db.close();
  }
});
test("inventory additions and declared correction retain history, other species and real animal identities", async () => {
  const f = await fixture();
  try {
    const actions: GuardianAction[] = [
      {
        kind: "herd_inventory",
        date: "2026-10-29",
        mode: "additional",
        complete: false,
        groups: [
          {
            name: "Nelore",
            species: "cattle",
            count: 50,
            description: "Já existentes não informados.",
          },
        ],
      },
      {
        kind: "herd_inventory",
        date: "2026-10-29",
        complete: true,
        groups: [
          { name: "Porcos", species: "pig", count: 20, description: "Todos os suínos declarados." },
        ],
      },
    ];
    await handleGuardianMessage(
      {
        phone,
        messageId: "existing",
        text: "Os 50 novos gados e 20 porcos já existiam aqui, só não tinha te contado.",
      },
      { store: f.guardian, now, interpret: async (c) => grounded(c, actions) },
    );
    let b = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(b.operations!, "2026-10-29").count, 170);
    assert.equal(stockAt(b.operations!, "2026-10-29", undefined, "pig").count, 20);
    await handleGuardianMessage(
      {
        phone,
        messageId: "total-correction",
        text: "Quero corrigir só os bovinos para 190, não 170. Os porcos continuam 20.",
      },
      {
        store: f.guardian,
        now,
        interpret: async (c) =>
          grounded(c, [{ kind: "herd_count", species: "cattle", date: "2026-10-29", count: 190 }]),
      },
    );
    b = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(b.operations!, "2026-10-29").count, 190);
    assert.equal(stockAt(b.operations!, "2026-10-29", undefined, "pig").count, 20);
    assert.equal(b.animals.length, 2);
    assert.equal(b.operations!.movements.length, 0);
    assert.equal(b.operations!.counts.length, 4);
  } finally {
    await f.db.close();
  }
});
test("supply movements share real SQL books and atomic batches cannot persist a negative stock or financial side effect", async () => {
  const f = await fixture();
  try {
    await handleGuardianMessage(
      {
        phone,
        messageId: "supplies",
        text: "Tenho dez sacos de ração no estoque e usei três no lote 2 hoje.",
      },
      {
        store: f.guardian,
        now,
        interpret: async (c) =>
          grounded(c, [
            {
              kind: "supply_movement",
              item: "Ração",
              unit: "saco",
              type: "balance",
              quantity: 10,
              date: "2026-10-29",
            },
            {
              kind: "supply_movement",
              item: "Ração",
              unit: "saco",
              type: "out",
              quantity: 3,
              date: "2026-10-29",
              destination: "lote 2",
            },
          ]),
      },
    );
    let s = await f.guardian.load(phone);
    assert.deepEqual(supplyBalances(s.active!.book), [
      { item: "Ração", unit: "saco", quantity: 7 },
    ]);
    const before = structuredClone(s.active!.book);
    const r = await handleGuardianMessage(
      { phone, messageId: "bad-stock", text: "Paguei 100 reais de ração e saíram oito sacos." },
      {
        store: f.guardian,
        now,
        interpret: async (c) =>
          grounded(c, [
            {
              kind: "ledger",
              date: "2026-10-29",
              direction: "expense",
              amountCents: 10000,
              description: "Ração",
            },
            {
              kind: "supply_movement",
              item: "Ração",
              unit: "saco",
              type: "out",
              quantity: 8,
              date: "2026-10-29",
            },
          ]),
      },
    );
    assert.equal(r!.persisted, false);
    assert.equal(r!.trace!.status, "error");
    s = await f.guardian.load(phone);
    assert.deepEqual(s.active!.book, before);
    assert.throws(
      () =>
        prepareFarmBatch({
          book: before,
          actions: [
            {
              kind: "supply_movement",
              item: "Ração",
              unit: "kg",
              type: "out",
              quantity: 1,
              date: "2026-10-29",
            },
          ],
          role: "owner",
          propertyId: s.active!.id,
          source,
          executedByMessageId: "unknown-unit",
        }),
      /saldo inicial/,
    );
  } finally {
    await f.db.close();
  }
});
test("conflict retries preserve selected animal targets even when a new last animal arrives concurrently", async () => {
  const f = await fixture();
  try {
    let calls = 0,
      conflicts = 0;
    const store = {
      ...f.guardian,
      commit: async (t: Parameters<typeof f.guardian.commit>[0]) => {
        if (t.operation === "update" && conflicts++ === 0) {
          const s = await f.guardian.load(phone),
            next = prepareFarmBatch({
              book: s.active!.book,
              actions: [{ kind: "animal", code: "b03", sex: "male" }],
              role: "owner",
              propertyId: s.active!.id,
              source: { ...source, messageId: "concurrent" },
              executedByMessageId: "concurrent",
            }).book;
          await f.guardian.commit({
            ...t,
            messageId: "concurrent",
            accountVersion: s.accountVersion,
            propertyVersion: s.active!.version,
            book: next,
            reply: "Cadastrado",
          });
          return "conflict";
        }
        return f.guardian.commit(t);
      },
    };
    const r = await handleGuardianMessage(
      {
        phone,
        messageId: "last-two",
        text: "Os dois últimos animais cadastrados podem ficar no lote três.",
      },
      {
        store,
        now,
        interpret: async (c) => {
          calls++;
          const targets = c.snapshot.active!.book.animals.slice(-2);
          return grounded(
            c,
            targets.map((a) => ({ kind: "move", code: a.code, lot: "3" })),
          );
        },
      },
    );
    assert.equal(r!.persisted, true);
    assert.equal(calls, 1);
    const animals = (await f.guardian.load(phone)).active!.book.animals;
    assert.deepEqual(
      animals.map((a) => [a.code, a.lot]),
      [
        ["b01", "3"],
        ["b02", "3"],
        ["b03", undefined],
      ],
    );
  } finally {
    await f.db.close();
  }
});
test("executor receipts synchronize WhatsApp state without a second model or stale commercial/registry goals", async () => {
  const f = await fixture();
  try {
    const old = createConversationState("qa-wa");
    old.current_topic = "vendedores e atendimento comercial";
    old.confirmed_data.animal_registry_codes = "FICAR 190";
    old.conversation_summary.known_facts = ["animal_registry_codes=FICAR 190"];
    let saved: ConversationState | undefined;
    await processClaimedWhatsAppChat(
      { phone, messageId: "state-sync", text: "Informe que o total de bovinos é 190." },
      {
        loadConversation: async () => ({ conversationId: "qa-wa", state: old, history: [] }),
        resolveUserText: async (i) => i.text,
        processGuardian: async (i) =>
          handleGuardianMessage(i, {
            store: f.guardian,
            now,
            interpret: async (c) =>
              grounded(c, [
                { kind: "herd_count", species: "cattle", count: 190, date: "2026-10-29" },
              ]),
          }),
        executeChat: async () => {
          throw Error("response model must not execute");
        },
        saveConversation: async (_p, s) => {
          saved = s.state as ConversationState;
        },
        completeMessage: async () => {},
      },
    );
    assert.equal(saved!.current_topic, "gestão da fazenda");
    assert.equal(saved!.guardian!.status, "completed");
    assert.equal(saved!.confirmed_data.animal_registry_codes, undefined);
    assert.equal(
      saved!.conversation_summary.last_completed_action,
      (await f.guardian.load(phone)).active!.book.lastOperation!.id,
    );
  } finally {
    await f.db.close();
  }
});

test("financial permission denial and a lost database acknowledgement cannot produce a success receipt", async () => {
  const f = await fixture();
  try {
    const before = await f.guardian.load(phone);
    const denied = await handleGuardianMessage(
      { phone, messageId: "denied", text: "Gastei 200 reais com diesel." },
      {
        store: {
          ...f.guardian,
          load: async () => ({ ...before, active: { ...before.active!, role: "worker" } }),
        },
        now,
        interpret: async (c) =>
          grounded(c, [
            { kind: "fuel_expense", fuel: "diesel", amountCents: 20000, date: "2026-10-29" },
          ]),
      },
    );
    assert.equal(denied!.persisted, false);
    assert.equal(denied!.trace!.status, "rejected");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    const failed = await handleGuardianMessage(
      { phone, messageId: "lost-commit", text: "A contagem é 120 bovinos." },
      {
        store: {
          ...f.guardian,
          commit: async () => {
            throw Error("private database payload must not leak");
          },
        },
        now,
        interpret: async (c) =>
          grounded(c, [{ kind: "herd_count", count: 120, species: "cattle", date: "2026-10-29" }]),
      },
    );
    assert.equal(failed!.persisted, false);
    assert.equal(failed!.trace!.stage, "commit");
    assert.equal(failed!.trace!.reason, "commit_unconfirmed");
    assert.doesNotMatch(failed!.reply!, /private database payload/);
  } finally {
    await f.db.close();
  }
});
