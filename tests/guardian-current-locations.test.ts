import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyFarm, type FarmBook, type GuardianAction } from "../src/lib/guardian/schema.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import {
  herdLocationReport,
  herdLocationContext,
  describeHerdLocations,
} from "../src/lib/guardian/herd-location-report.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { hashToken } from "../src/lib/guardian/panel.server.ts";

const phone = "000000000000842",
  day = "2026-10-30",
  at = "2026-10-30T12:00:00Z";
function act(book: FarmBook, actions: GuardianAction[], id = "seed") {
  return prepareFarmBatch({
    book,
    actions,
    role: "owner",
    propertyId: "synthetic-farm",
    source: { actor: phone, messageId: id, at, confirmed: true },
    executedByMessageId: id,
  }).book;
}
function seed() {
  return act(emptyFarm("Fazenda QA Cedro", "Cidade de Teste", "SP"), [
    { kind: "herd_count", count: 25, species: "cattle", date: "2026-10-28" },
    {
      kind: "herd_event",
      count: 12,
      type: "purchase",
      species: "cattle",
      date: "2026-10-29",
      description: "Doze bovinos recém-chegados sem lote",
    },
    {
      kind: "herd_event",
      count: 7,
      type: "transfer_in",
      species: "sheep",
      date: "2026-10-29",
      description: "Sete ovinos sem lote",
    },
  ]);
}
const moved = () => act(seed(), [{ kind: "herd_relocate", to: "Pastagem QA", date: day }], "all");

test("current locations include every unassigned arrival after relocation while historical lots and unknown totals stay intact", () => {
  const before = seed(),
    book = moved();
  const report = herdLocationReport(book, day);
  assert.equal(report.hasUnassigned, false);
  assert.equal(
    report.locations.find((r) => r.species === "cattle" && r.lot === "Pastagem QA")!.count,
    37,
  );
  const sheep = report.locations.find((r) => r.species === "sheep" && r.lot === "Pastagem QA")!;
  assert.equal(sheep.count, null);
  assert.equal(sheep.registered, 7);
  assert.equal(sheep.groups[0].count, 7);
  assert.equal(
    report.unassigned.every((r) => r.count === 0),
    true,
  );
  assert.deepEqual(book.operations!.movements, before.operations!.movements);
  assert.equal(
    book.operations!.movements.every((m) => !m.lot),
    true,
  );
  const reply = describeHerdLocations(book, day);
  assert.match(reply, /37 — lote Pastagem QA/);
  assert.match(reply, /7 com localização registrada/);
  assert.match(reply, /Não encontrei grupos ou fichas ativas pendentes de lote/);
  assert.equal(stockAt(book.operations!, day, undefined, "sheep").count, null);
});

test("new unassigned arrivals reopen the current pending location without moving earlier arrivals again", () => {
  const book = act(
    moved(),
    [
      {
        kind: "herd_event",
        type: "purchase",
        count: 3,
        species: "cattle",
        date: day,
        description: "Mais três bovinos chegaram, sem lote",
      },
    ],
    "later",
  );
  const report = herdLocationReport(book, day);
  assert.equal(report.hasUnassigned, true);
  assert.equal(report.unassigned.find((r) => r.species === "cattle")!.count, 3);
  assert.equal(
    report.locations.find((r) => r.species === "cattle" && r.lot === "Pastagem QA")!.count,
    37,
  );
  assert.equal(report.unassigned.find((r) => r.species === "sheep")!.count, 0);
  assert.equal(herdLocationReport(book, "2026-10-29").hasUnassigned, true);
});

test("bounded interpreter detail preserves the totals and location status of the entire book", () => {
  let book = seed();
  for (let index = 0; index < 35; index++)
    book = act(
      book,
      [
        {
          kind: "herd_event",
          count: 2,
          species: "sheep",
          type: "transfer_in",
          date: "2026-10-29",
          description: "Entrada sintética de ovinos para avaliação",
        },
      ],
      "arrival-" + index,
    );
  book = act(book, [{ kind: "herd_relocate", to: "Pastagem QA", date: day }], "relocate");
  const context = herdLocationContext(book, day);
  const row = context.locations.find((r) => r.species === "sheep" && r.lot === "Pastagem QA")!;
  assert.equal(row.registered, 77);
  assert.equal(row.count, null);
  assert.equal(row.groups.length, 20);
  assert.equal(context.hasUnassigned, false);
  assert.equal(
    herdLocationReport(book, day).locations.find((r) => r.species === "sheep")!.groups.length,
    36,
  );
});

test("a group without lot or individual identification can be moved with its real reference and no initial species census", () => {
  let book = seed();
  const group = book.operations!.movements.find((m) => m.species === "sheep")!;
  book = act(
    book,
    [
      {
        kind: "lot_transfer",
        movementId: group.id,
        species: "sheep",
        to: "Destino QA",
        count: 7,
        date: day,
        createDestination: true,
      },
    ],
    "unassigned",
  );
  const report = herdLocationReport(book, day);
  assert.equal(
    report.locations.find((r) => r.lot === "Destino QA" && r.species === "sheep")!.registered,
    7,
  );
  assert.equal(book.animals.length, 0);
  assert.equal(book.operations!.movements.length, 2);
  assert.equal(stockAt(book.operations!, day, undefined, "sheep").count, null);
});

test("SQL: an operational none is reinterpreted as a verified inspection of the actual destination, never a duplicate move", async () => {
  const f = await farmIntegration();
  try {
    const propertyId = randomUUID(),
      book = moved();
    await f.guardian.commit({
      phone,
      messageId: "initial",
      accountVersion: 0,
      propertyId,
      propertyVersion: null,
      operation: "create",
      book,
      pending: null,
      reply: "Criada",
    });
    const before = (await f.guardian.load(phone)).active!;
    let calls = 0;
    const send = () =>
      handleGuardianMessage(
        {
          phone,
          messageId: "followup",
          text: "Os animais que aparecem sem lote definido pode colocar na Pastagem QA também, tá?",
          mediaType: "audio",
        },
        {
          store: f.guardian,
          now: new Date(at),
          interpret: async (c) => {
            calls++;
            if (!c.validation) return { intent: "none", propertyId, question: "", entries: [] };
            assert.equal(c.summary.herdLocations!.hasUnassigned, false);
            return {
              intent: "inspect",
              propertyId,
              question: "",
              inspection: { kind: "herd_locations", lot: "Pastagem QA" },
              entries: [],
            };
          },
        },
      );
    const response = await send();
    assert.equal(calls, 2);
    assert.equal(response!.persisted, false);
    assert.match(response!.reply!, /Conferi a localização atual/);
    assert.match(response!.reply!, /37 — lote Pastagem QA/);
    assert.match(response!.reply!, /Não encontrei grupos ou fichas ativas pendentes de lote/);
    assert.equal((await send())!.reply, response!.reply);
    assert.equal(calls, 2);
    const after = (await f.guardian.load(phone)).active!;
    assert.equal(after.version, before.version);
    assert.deepEqual(after.book, before.book);
  } finally {
    await f.db.close();
  }
});

test("SQL: an unassigned operational followup executes its group transfer after reinterpretation and never manufactures animal identities", async () => {
  const f = await farmIntegration();
  try {
    const propertyId = randomUUID(),
      book = seed(),
      group = book.operations!.movements[0];
    await f.guardian.commit({
      phone,
      messageId: "initial",
      accountVersion: 0,
      propertyId,
      propertyVersion: null,
      operation: "create",
      book,
      pending: null,
      reply: "Criada",
    });
    const text = "Coloque esses doze bovinos sem lote no Destino QA, por favor.";
    const result = await handleGuardianMessage(
      { phone, messageId: "move", text, mediaType: "audio" },
      {
        store: f.guardian,
        now: new Date(at),
        interpret: async (c) => ({
          intent: c.validation ? "apply" : "none",
          propertyId,
          question: "",
          entries: c.validation
            ? [
                {
                  action: {
                    kind: "lot_transfer",
                    movementId: group.id,
                    species: "cattle",
                    to: "Destino QA",
                    count: 12,
                    date: day,
                    createDestination: true,
                  },
                  evidence: [{ messageIndex: c.messages.length - 1, quote: text }],
                },
              ]
            : [],
        }),
      },
    );
    assert.equal(result!.persisted, true, result!.reply!);
    const after = (await f.guardian.load(phone)).active!.book;
    assert.equal(after.operations!.lotTransfers!.length, 1);
    assert.equal(after.operations!.movements.length, 2);
    assert.equal(after.animals.length, 0);
    assert.equal(
      herdLocationReport(after, day).locations.find(
        (r) => r.lot === "Destino QA" && r.species === "cattle",
      )!.count,
      12,
    );
  } finally {
    await f.db.close();
  }
});

test("SQL: a colloquial panel request issues a code for an authorized farm without changing the selected property", async () => {
  const f = await farmIntegration();
  try {
    const a = randomUUID(),
      b = randomUUID(),
      code = "ABCD2345EFGH6789";
    await f.guardian.commit({
      phone,
      messageId: "a",
      accountVersion: 0,
      propertyId: a,
      propertyVersion: null,
      operation: "create",
      book: seed(),
      pending: null,
      reply: "Criada",
    });
    const prior = await f.guardian.load(phone);
    await f.guardian.commit({
      phone,
      messageId: "b",
      accountVersion: prior.accountVersion,
      propertyId: b,
      propertyVersion: null,
      operation: "create",
      book: emptyFarm("Fazenda QA Ipê", "Cidade de Teste", "SP"),
      pending: null,
      reply: "Criada",
    });
    const reply = await handleGuardianMessage(
      {
        phone,
        messageId: "panel",
        text: "Tê pequi, gere o código do painel para a Fazenda QA Cedro, por favor.",
        mediaType: "audio",
      },
      {
        store: f.guardian,
        now: new Date(at),
        issuePanelCode: f.issue,
        panelCode: () => code,
        interpret: async () => ({ intent: "panel", propertyId: a, question: "", entries: [] }),
      },
    );
    assert.match(reply!.reply!, /Seu código para Fazenda QA Cedro/);
    assert.equal((await f.guardian.load(phone)).active!.id, b);
    assert.equal(
      (
        await f.db.query<{ property_id: string }>(
          "select property_id from guardian_panel_codes where token_hash=$1",
          [hashToken(code)],
        )
      ).rows[0].property_id,
      a,
    );
  } finally {
    await f.db.close();
  }
});
