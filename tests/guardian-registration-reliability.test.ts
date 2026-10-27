import assert from "node:assert/strict";
import test from "node:test";
import { automaticFarmEvent } from "../src/lib/guardian/automatic.ts";
import { herdStatement } from "../src/lib/guardian/herd-language.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm, PreferencesSchema, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import { emptyOperations, farmIndicators, stockAt } from "../src/lib/guardian/operations.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "5517999991111",
  now = new Date("2026-10-27T14:50:00Z");
const first = "Tpec-ia nasceu +2 bezerros novos hoje na minha fazenda ok";
const second = "Hoje mesmo nasceu 2 bezerros aqui na minha fazenda";
const noAI = async () => {
  throw new Error("This registration must not call AI");
};
function snapshot(): GuardianSnapshot {
  return {
    accountVersion: 0,
    preferences: PreferencesSchema.parse({}),
    pending: null,
    properties: [{ id: "p", name: "Boa Vista", role: "owner" }],
    active: {
      id: "p",
      version: 0,
      role: "owner",
      book: { ...emptyFarm("Boa Vista", "Tanabi", "SP"), operations: emptyOperations() },
    },
  };
}
async function seed(f: Awaited<ReturnType<typeof farmIntegration>>, day = "2026-10-25T15:00:00Z") {
  await f.observe(
    phone,
    "baseline",
    "Minha fazenda se chama Boa Vista. Minha fazenda fica em Tanabi/SP. Tenho 82 cabeças.",
    day,
  );
}
const send = (f: Awaited<ReturnType<typeof farmIntegration>>, id: string, text: string, at = now) =>
  handleGuardianMessage(
    { phone, messageId: id, text, sentAt: at.toISOString() },
    { store: f.guardian, now: at, extract: noAI },
  );

test("the exact failed phrases and ordinary word orders have identical, explicit event semantics", () => {
  for (const text of [
    first,
    second,
    "Hoje mesmo, nasceram +2 bezerros aqui na minha fazenda.",
    "TPEC IA, nasceu + 2 novos bezerros hoje.",
    "Na minha fazenda nasceram dois bezerros hoje mesmo.",
    "Aqui na fazenda Boa Vista nasceram dois novos bezerros.",
    "Dois bezerros novos nasceram aqui na minha fazenda hoje.",
    "Hoje, dois bezerros nasceram.",
    "Tpec-ia, registre que hoje mesmo nasceram mais dois novos bezerros, ok",
    "Anota: hoje mesmo nasceram dois novos bezerros.",
  ]) {
    const result = automaticFarmEvent({ text, at: now }, snapshot());
    assert.equal(result.status, "action", herdStatement(text));
    if (result.status === "action")
      assert.deepEqual(
        result.action.kind === "herd_event" && [
          result.action.type,
          result.action.count,
          result.action.date,
        ],
        ["birth", 2, "2026-10-27"],
        text,
      );
  }
});

test("birth, death, sale and purchase parsing covers combinations of time, quantities, modifiers and cattle nouns", () => {
  for (const [verb, type] of [
    ["nasceram", "birth"],
    ["morreram", "death"],
    ["comprei", "purchase"],
    ["vendi", "sale"],
  ])
    for (const [number, count] of [
      ["2", 2],
      ["+2", 2],
      ["dois", 2],
      ["vinte e dois", 22],
    ])
      for (const prefix of ["Hoje mesmo", "Aqui na minha fazenda", "Na fazenda Boa Vista, hoje"])
        for (const noun of ["bezerros", "bovinos", "novilhos"]) {
          const text = `${prefix} ${verb} ${number} ${noun}.`;
          const parsed = automaticFarmEvent({ text, at: now }, snapshot());
          assert.equal(parsed.status, "action", text);
          if (parsed.status === "action")
            assert.deepEqual(
              parsed.action.kind === "herd_event" && [parsed.action.type, parsed.action.count],
              [type, count],
              text,
            );
        }
});

test("flexible ordering does not turn questions, supplies, negatives, fractions, quotations or third parties into cattle movements", () => {
  for (const text of [
    "Será que hoje mesmo nasceu +2 bezerros?",
    "Estou verificando se nasceram 2 bezerros hoje.",
    "Não nasceram 2 bezerros hoje.",
    "Hoje comprei 2 sacos de ração para os 4 bezerros.",
    "Comprei 2 kg de sal para 10 vacas.",
    "Hoje nasceu -2 bezerros.",
    "Hoje nasceu 2,5 bezerros.",
    "Hoje nasceu 2.5 bezerros.",
    "Meu vizinho disse que hoje nasceram dois bezerros.",
    '"Hoje mesmo nasceu 2 bezerros."',
    "Suponha que nasceram 2 bezerros.",
    "Se hoje nasceram dois bezerros, registre.",
    "Acho que nasceram dois bezerros hoje.",
  ]) {
    const result = automaticFarmEvent({ text, at: now }, snapshot());
    assert.ok(result.status !== "action" && result.status !== "batch", text);
  }
  assert.equal(
    automaticFarmEvent({ text: first, at: now, mediaType: "image" }, snapshot()).status,
    "none",
  );
});

test("dates and complete batches preserve the day of each event and reject invalid or incomplete batches", () => {
  for (const [text, date] of [
    ["Hoje mesmo nasceram 2 bezerros.", "2026-10-27"],
    ["Na minha fazenda nasceram 2 bezerros ontem mesmo.", "2026-10-26"],
    ["2 bezerros nasceram em 2026-10-26.", "2026-10-26"],
    ["Nasceram dois bezerros em 26/10/2026.", "2026-10-26"],
  ]) {
    const result = automaticFarmEvent({ text, at: now }, snapshot());
    assert.equal(result.status, "action", text);
    if (result.status === "action")
      assert.equal("date" in result.action && result.action.date, date);
  }
  const batch = automaticFarmEvent(
    { text: "Aqui na minha fazenda nasceram +2 bezerros ontem e hoje mesmo morreram 1.", at: now },
    snapshot(),
  );
  assert.equal(batch.status, "batch");
  if (batch.status === "batch")
    assert.deepEqual(
      batch.actions.map((a) => a.kind === "herd_event" && [a.type, a.count, a.date]),
      [
        ["birth", 2, "2026-10-26"],
        ["death", 1, "2026-10-27"],
      ],
    );
  for (const text of [
    "Nasceram 2 bezerros em 31/02/2026.",
    "Nasceram 2 bezerros em 2026-02-30.",
    "Nasceram 2 bezerros ontem hoje.",
    "Nasceram 2 bezerros entre 25/10 e 26/10.",
    "2 bezerros nasceram há dois anos.",
    "Comprei 2 vacas na segunda-feira.",
    "Nasceram 2 bezerros hoje e morreram alguns.",
    "Nasceram 2 bezerros hoje. Morreram alguns bezerros.",
  ])
    assert.equal(automaticFarmEvent({ text, at: now }, snapshot()).status, "pending", text);
});

test("real SQL: each exact phrase independently updates stock and replies with the persisted new balance", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    for (const [id, text] of [
      ["first", first],
      ["second", "Hoje mesmo nasceu mais 2 bezerros aqui na minha fazenda"],
    ]) {
      const result = await send(f, id, text);
      assert.equal(result!.persisted, true, result!.reply ?? "");
      assert.match(result!.reply!, /código\/brinco e RGN/);
      await send(f, id, text);
    }
    const s = await f.guardian.load(phone),
      book = s.active!.book;
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 86);
    assert.equal(book.operations!.movements.length, 2);
    assert.equal(book.records.length, 0);
    assert.equal(farmIndicators(book, "2026-10-01", "2026-10-27").births, 4);
    const other = "5517999992222";
    await f.observe(
      other,
      "baseline",
      "Minha fazenda fica em Tanabi e tenho 82 cabeças.",
      "2026-10-25T15:00:00Z",
    );
    const exactSecond = await handleGuardianMessage(
      { phone: other, messageId: "exact-second", text: second },
      { store: f.guardian, now, extract: noAI },
    );
    assert.equal(exactSecond!.persisted, true, exactSecond!.reply ?? "");
    assert.match(exactSecond!.reply!, /84 animais/);
    assert.equal(
      stockAt((await f.guardian.load(other)).active!.book.operations!, "2026-10-27").count,
      84,
    );
  } finally {
    await f.db.close();
  }
});

test("real SQL: a rephrased request is clarified without duplication, and an explicitly additional entry is saved exactly once", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "first", first);
    const again = await send(f, "rephrase", second);
    assert.equal(again!.persisted, false);
    assert.match(again!.reply!, /mesmos animais ou de mais 2/);
    assert.equal(
      stockAt((await f.guardian.load(phone)).active!.book.operations!, "2026-10-27").count,
      84,
    );
    await send(f, "same", "são os mesmos");
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.movements.length, 1);
    await send(f, "rephrase-again", second);
    const more = await send(f, "more-confirm", "são mais dois");
    assert.equal(more!.persisted, true, more!.reply ?? "");
    await send(f, "more-confirm", "são mais dois");
    const s = await f.guardian.load(phone);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 86);
    assert.equal(s.active!.book.operations!.movements.length, 2);
    assert.equal(s.active!.book.operations!.movements[1].source.messageId, "rephrase-again");
    await send(f, "ids", "código B01, RGN KBU 601\ncódigo B02, RGN KBU 602");
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 2);
    assert.equal(
      stockAt((await f.guardian.load(phone)).active!.book.operations!, "2026-10-27").count,
      86,
    );
  } finally {
    await f.db.close();
  }
});

test("real SQL: a missing quantity and a missing day can be completed without repeating the whole report", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const question = await send(
      f,
      "incomplete-count",
      "Hoje mesmo nasceram alguns bezerros aqui na minha fazenda",
    );
    assert.match(question!.reply!, /Quantos animais/);
    assert.equal((await f.guardian.load(phone)).pending!.kind, "herd_registration");
    const completed = await send(f, "count-answer", "dois");
    assert.equal(completed!.persisted, true, completed!.reply ?? "");
    const dateQuestion = await send(f, "incomplete-day", "Comprei três novilhas semana passada");
    assert.match(dateQuestion!.reply!, /Em qual dia/);
    const dated = await send(f, "day-answer", "foi ontem");
    assert.equal(dated!.persisted, true, dated!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 87);
    assert.deepEqual(
      book.operations!.movements.map((m) => [m.type, m.count, m.date, m.source.messageId]),
      [
        ["birth", 2, "2026-10-27", "incomplete-count"],
        ["purchase", 3, "2026-10-26", "incomplete-day"],
      ],
    );
  } finally {
    await f.db.close();
  }
});

test("real SQL: cross-farm scope, domain conflicts, future dates and failed persistence never acknowledge a save", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const wrongFarm = await send(
      f,
      "wrong-farm",
      "Na fazenda Santa Rita hoje nasceram +2 bezerros",
    );
    assert.equal(wrongFarm!.persisted, false);
    const tomorrow = await send(f, "future", "Nasceram 2 bezerros em 2026-10-28");
    assert.equal(tomorrow!.persisted, false);
    assert.match(tomorrow!.reply!, /futuro/);
    const failed = await handleGuardianMessage(
      { phone, messageId: "failure", text: first },
      {
        store: {
          ...f.guardian,
          commit: async () => {
            throw new Error("offline");
          },
        },
        now,
      },
    );
    assert.equal(failed!.persisted, false);
    assert.doesNotMatch(failed!.reply!, /Registros salvos/);
    const s = await f.guardian.load(phone);
    assert.equal(s.active!.book.operations!.movements.length, 0);
    await f.guardian.commit({
      phone,
      messageId: "today-count",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "update",
      book: {
        ...s.active!.book,
        operations: {
          ...s.active!.book.operations!,
          counts: [
            ...s.active!.book.operations!.counts,
            {
              id: "end-of-day",
              count: 82,
              date: "2026-10-27",
              source: {
                actor: phone,
                messageId: "today-count",
                at: now.toISOString(),
                confirmed: true,
              },
            },
          ],
        },
      },
      pending: null,
      details: { kind: "herd_count" },
      reply: "ok",
    });
    const ambiguousBaseline = await send(f, "same-day", first);
    assert.equal(ambiguousBaseline!.persisted, false);
    assert.match(ambiguousBaseline!.reply!, /fim desse dia/);
  } finally {
    await f.db.close();
  }
});

test("real SQL: a short quantity answer across midnight retains the original local event date and source", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const askedAt = new Date("2026-10-27T02:55:00Z"),
      answeredAt = new Date("2026-10-27T03:01:00Z");
    await send(f, "before-midnight", "Hoje mesmo nasceram alguns bezerros", askedAt);
    const answer = await send(f, "after-midnight", "dois", answeredAt);
    assert.equal(answer!.persisted, true, answer!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.operations!.movements[0].date, "2026-10-26");
    assert.equal(book.operations!.movements[0].source.messageId, "before-midnight");
    assert.equal(book.operations!.movements[0].source.sourceAt, askedAt.toISOString());
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 84);
  } finally {
    await f.db.close();
  }
});

test("real SQL: competing confirmations cannot duplicate an additional entry", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "first", first);
    await send(f, "again", second);
    const responses = await Promise.all([
      send(f, "confirmation-A", "são mais 2"),
      send(f, "confirmation-B", "são mais 2"),
    ]);
    assert.equal(responses.filter((r) => r!.persisted === true).length, 1);
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.operations!.movements.length, 2);
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 86);
  } finally {
    await f.db.close();
  }
});

test("the actual WhatsApp pipeline returns both failed phrasings as authoritative receipts without extraction or general AI", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    for (const [messageId, text] of [
      ["wa1", first],
      ["wa2", "Hoje mesmo nasceu mais 2 bezerros aqui na minha fazenda"],
    ]) {
      const result = await processClaimedWhatsAppChat(
        { phone, messageId, text },
        {
          loadConversation: async () => null,
          resolveUserText: async (i) => i.text,
          processGuardian: (i) =>
            handleGuardianMessage(i, { store: f.guardian, now, extract: noAI }),
          processHerd: noAI,
          executeChat: noAI,
          completeMessage: async () => {},
          saveConversation: async () => {},
        },
      );
      assert.match(result.reply!, /Registros salvos/);
    }
    assert.equal(
      stockAt((await f.guardian.load(phone)).active!.book.operations!, "2026-10-27").count,
      86,
    );
  } finally {
    await f.db.close();
  }
});
