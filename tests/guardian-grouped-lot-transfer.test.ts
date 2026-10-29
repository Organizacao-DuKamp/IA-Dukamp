import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import {
  emptyFarm,
  PreferencesSchema,
  type FarmBook,
  type GuardianAction,
} from "../src/lib/guardian/schema.ts";
import { stockAt, farmIndicators } from "../src/lib/guardian/operations.ts";
import { herdGroupsAt } from "../src/lib/guardian/herd-locations.ts";
import { semanticContext } from "../src/lib/guardian/semantic.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "000000000000764",
  now = new Date("2026-10-29T20:30:00Z"),
  day = "2026-10-29";
const source = { actor: phone, messageId: "seed", at: now.toISOString(), confirmed: true as const };
const transfer = (
  fields: Partial<Extract<GuardianAction, { kind: "lot_transfer" }>> = {},
): GuardianAction => ({
  kind: "lot_transfer",
  movementId: "purchase-50",
  species: "cattle",
  to: "4",
  count: 50,
  date: day,
  createDestination: true,
  ...fields,
});
function seed() {
  let book = emptyFarm("Eduardo", "Tanabi", "SP");
  for (const [id, action] of [
    ["base-cattle", { kind: "herd_count", count: 120, species: "cattle", date: "2026-10-28" }],
    ["base-pigs", { kind: "herd_count", count: 20, species: "pig", date: "2026-10-28" }],
    [
      "purchase-50",
      {
        kind: "herd_event",
        species: "cattle",
        type: "purchase",
        count: 50,
        date: day,
        description: "50 bovinos Nelore comprados e chegados hoje",
      },
    ],
  ] as Array<[string, GuardianAction]>)
    book = applyFarmAction(book, action, "owner", source, id).book;
  return book;
}
const apply = (book: FarmBook, action: GuardianAction) =>
  prepareFarmBatch({
    book,
    actions: [action],
    role: "owner",
    propertyId: "farm",
    source,
    executedByMessageId: "transfer",
  }).book;

test("the 2376 group moves into a new lot on arrival day without invented censuses or a second purchase", () => {
  const original = seed(),
    book = apply(original, transfer());
  assert.equal(original.operations!.lotTransfers, undefined);
  assert.equal(stockAt(book.operations!, day).count, 170);
  assert.equal(stockAt(book.operations!, day, undefined, "pig").count, 20);
  assert.equal(stockAt(book.operations!, day, "4").count, 50);
  assert.equal(stockAt(book.operations!, "2026-10-28", "4").count, null);
  assert.equal(book.operations!.movements.length, 1);
  assert.equal(book.operations!.counts.length, 2);
  assert.equal(book.animals.length, 0);
  assert.equal(book.operations!.lotTransfers!.length, 1);
  assert.equal(book.operations!.lotTransfers![0].movementId, "purchase-50");
  assert.deepEqual(book.operations!.lots, [{ name: "4", openedOn: day }]);
  assert.equal(farmIndicators(book, "2026-10-01", day).births, 0);
  assert.match(farmCsv(book), /Transferência de grupo/);
  assert.match(farmCsv(book), /purchase-50/);
});

test("one animal from a collective group and later subgroups retain independent, bounded locations", () => {
  let book = apply(seed(), transfer({ count: 1 }));
  book = apply(book, transfer({ count: 49, to: "2" }));
  assert.equal(stockAt(book.operations!, day, "4").count, 1);
  assert.equal(stockAt(book.operations!, day, "2").count, 49);
  assert.throws(() => apply(book, transfer({ count: 1, to: "5" })), /quantidade disponível/);
  book = apply(book, transfer({ from: "4", count: 1, to: "5" }));
  assert.equal(stockAt(book.operations!, day, "4").count, 0);
  assert.equal(stockAt(book.operations!, day, "5").count, 1);
  assert.equal(stockAt(book.operations!, day).count, 170);
  assert.equal(book.operations!.movements.length, 1);
  assert.equal(book.animals.length, 0);
});

test("existing unknown lots never acquire an invented zero; a real lot named Fazenda remains a distinct location", () => {
  let book = applyFarmAction(seed(), { kind: "lot_update", lot: "4" }, "owner", source, "lot").book;
  book = apply(book, transfer());
  assert.equal(stockAt(book.operations!, day, "4").count, null);
  assert.equal(book.operations!.lots[0].openedOn, undefined);
  assert.equal(herdGroupsAt(book.operations!, day)[0].locations[0].available, 50);
  assert.throws(() => apply(seed(), transfer({ from: "fazenda" })), /quantidade disponível/);
  book = seed();
  book.operations!.movements[0].lot = "Fazenda";
  book.operations!.lots.push({ name: "Fazenda" });
  book = apply(book, transfer({ from: "lote Fazenda" }));
  assert.equal(book.operations!.lotTransfers![0].from, "Fazenda");
  assert.equal(stockAt(book.operations!, day, "4").count, 50);
});

test("missing or replaced groups, species mismatch, missing creation authority and unsafe origin all fail atomically", () => {
  const book = seed();
  for (const action of [
    transfer({ movementId: "from-another-property" }),
    transfer({ count: 51 }),
    transfer({ species: "pig" }),
    transfer({ date: "2026-10-30" }),
    transfer({ date: "2026-10-28" }),
    transfer({ createDestination: undefined }),
  ])
    assert.throws(() => apply(book, action));
  const corrected = applyFarmAction(
    book,
    {
      kind: "herd_event",
      type: "purchase",
      species: "cattle",
      count: 49,
      date: day,
      description: "Correção da compra",
      replaces: "purchase-50",
    },
    "owner",
    source,
    "corrected",
  ).book;
  assert.throws(() => apply(corrected, transfer()), /Não encontrei/);
  for (const role of ["worker", "technician"] as const)
    assert.throws(
      () =>
        prepareFarmBatch({
          book,
          actions: [transfer()],
          role,
          propertyId: "farm",
          source,
          executedByMessageId: "denied",
        }),
      /perfil/,
    );
  assert.equal(book.operations!.lots.length, 0);
  assert.equal(book.operations!.lotTransfers, undefined);
});

test("later departures and recounts constrain the real group instead of guessing its remaining animals", () => {
  const laterSource = { ...source, at: "2026-10-29T20:40:00Z" };
  let book = applyFarmAction(
    seed(),
    {
      kind: "herd_event",
      type: "sale",
      species: "cattle",
      count: 10,
      date: day,
      description: "Venda sem grupo identificado",
    },
    "owner",
    laterSource,
    "sale",
  ).book;
  assert.throws(() => apply(book, transfer()), /quantidade disponível/);
  book = apply(book, transfer({ count: 40 }));
  assert.equal(stockAt(book.operations!, day).count, 160);
  const recounted = applyFarmAction(
    seed(),
    { kind: "herd_count", count: 170, date: day, species: "cattle" },
    "owner",
    source,
    "recount",
  ).book;
  assert.throws(() => apply(recounted, transfer()), /quantidade disponível/);
  assert.throws(
    () =>
      applyFarmAction(
        book,
        {
          kind: "herd_event",
          type: "purchase",
          count: 45,
          date: day,
          description: "Revisão de compra",
          replaces: "purchase-50",
        },
        "owner",
        source,
        "revision",
      ),
    /reconciliar/,
  );
});

test("lot stock and chronology include grouped transfers when a later event is validated", () => {
  const book = apply(seed(), transfer());
  const laterSource = { ...source, at: "2026-10-29T20:40:00Z" };
  const sell = (count: number) =>
    applyFarmAction(
      book,
      {
        kind: "herd_event",
        type: "sale",
        species: "cattle",
        count,
        date: day,
        lot: "4",
        description: "Venda de animais do lote 4",
      },
      "owner",
      laterSource,
      "sale",
    ).book;
  assert.equal(stockAt(sell(10).operations!, day, "4").count, 40);
  assert.throws(() => sell(51), /saldo negativo/);
  assert.equal(stockAt(book.operations!, day, "4").count, 50);
});

test("semantic context retains real group availability outside the partial movement window", () => {
  const book = seed();
  for (let i = 0; i < 20; i++)
    book.operations!.movements.push({
      ...book.operations!.movements[0],
      id: "other-" + i,
      species: "pig",
    });
  const context = semanticContext(
    { phone, messageId: "move", text: "Coloque os 50 bovinos no lote quatro" },
    {
      accountVersion: 0,
      preferences: PreferencesSchema.parse({}),
      pending: null,
      active: { id: "farm", version: 0, role: "owner", book },
      properties: [{ id: "farm", name: "Eduardo", role: "owner" }],
    },
    now,
  );
  assert.ok(
    !context.snapshot.active!.book.operations!.movements.some((m) => m.id === "purchase-50"),
  );
  assert.equal(
    context.summary.herdGroups!.find((g) => g.movementId === "purchase-50")!.locations[0].available,
    50,
  );
});

test("WhatsApp receipt, PostgreSQL book, audit and replay agree on a pending request corrected to lot 4", async () => {
  const f = await farmIntegration();
  try {
    await f.guardian.commit({
      phone,
      messageId: "seed",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      pending: null,
      reply: "Criada",
      book: seed(),
    });
    const send = (id: string, text: string, action: GuardianAction) =>
      handleGuardianMessage(
        { phone, messageId: id, text, mediaType: "audio" },
        {
          store: f.guardian,
          now,
          interpret: async (c) => ({
            intent: "apply",
            propertyId: c.propertyId,
            question: "",
            entries: [
              {
                action,
                evidence: [
                  { messageIndex: c.messages.length - 1, quote: c.messages.at(-1)!.content },
                ],
              },
            ],
          }),
        },
      );
    const failed = await send("old-attempt", "Coloque esses 50 no lote 2 da fazenda", {
      kind: "lot_transfer",
      from: "fazenda",
      to: "2",
      species: "cattle",
      count: 50,
      date: day,
    });
    assert.equal(failed!.trace!.status, "error");
    const result = await send(
      "lot-four",
      "Melhor, esses 50 comprados hoje vão para o lote quatro, que ainda não existe",
      transfer({ to: "lote quatro" }),
    );
    assert.equal(result!.persisted, true, result!.reply!);
    assert.equal(result!.trace!.status, "completed");
    assert.match(result!.reply!, /lote 4/);
    assert.equal((await f.guardian.load(phone)).pending, null);
    const beforeReplay = (await f.guardian.load(phone)).active!.book;
    const replay = await send("lot-four", "mesmo webhook", transfer());
    assert.equal(replay!.reply, result!.reply);
    const after = (await f.guardian.load(phone)).active!.book;
    assert.deepEqual(after, beforeReplay);
    assert.equal(stockAt(after.operations!, day, "4").count, 50);
    assert.equal(stockAt(after.operations!, day).count, 170);
    const persisted = (await f.db.query<{ book: FarmBook }>("select book from guardian_properties"))
      .rows[0].book;
    assert.deepEqual(persisted, after);
    const audit = (
      await f.db.query<{ details: { actions: string[]; events: GuardianAction[] } }>(
        "select details from guardian_audit where message_id=$1",
        ["lot-four"],
      )
    ).rows[0];
    assert.equal(audit.details.actions[0], "lot_transfer");
    assert.equal(audit.details.events[0].kind, "lot_transfer");
    assert.equal(after.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("a real identified bovine still moves by code without reallocating an unrelated collective purchase", () => {
  let book = applyFarmAction(
    seed(),
    { kind: "animal", code: "B01", rgn: "DKN 404", lot: "2" },
    "owner",
    source,
    "animal",
  ).book;
  book = apply(book, { kind: "move", code: "B01", lot: "lote quatro" });
  assert.equal(book.animals[0].lot, "4");
  assert.equal(book.animals[0].rgn, "DKN 404");
  assert.equal(book.operations!.lotTransfers, undefined);
  assert.equal(book.operations!.movements.length, 1);
  assert.equal(stockAt(book.operations!, day).count, 170);
});

test("simultaneous requests cannot allocate the same group twice or commit a partial multi-action batch", async () => {
  const f = await farmIntegration();
  try {
    await f.guardian.commit({
      phone,
      messageId: "seed",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      pending: null,
      reply: "Criada",
      book: seed(),
    });
    await Promise.all(
      ["4", "5"].map((to) =>
        handleGuardianMessage(
          { phone, messageId: "move-" + to, text: "Coloque os 50 no lote " + to },
          {
            store: f.guardian,
            now,
            interpret: async (c) => ({
              intent: "apply",
              propertyId: c.propertyId,
              question: "",
              entries: [
                {
                  action: transfer({ to }),
                  evidence: [
                    { messageIndex: c.messages.length - 1, quote: c.messages.at(-1)!.content },
                  ],
                },
              ],
            }),
          },
        ),
      ),
    );
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.operations!.lotTransfers!.length, 1);
    assert.equal(book.operations!.lots.length, 1);
    assert.equal(stockAt(book.operations!, day).count, 170);
    assert.throws(() =>
      prepareFarmBatch({
        book: seed(),
        role: "owner",
        propertyId: "farm",
        source,
        executedByMessageId: "atomic",
        actions: [transfer(), { kind: "move", code: "unknown", lot: "4" }],
      }),
    );
  } finally {
    await f.db.close();
  }
});
