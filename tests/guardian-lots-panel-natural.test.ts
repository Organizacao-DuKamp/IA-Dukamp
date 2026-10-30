import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { panelAccessRequest } from "../src/lib/guardian/panel-access.ts";
import {
  handlePanelCodeRequest,
  hashToken,
  handleFarmPanel,
} from "../src/lib/guardian/panel.server.ts";
import {
  emptyFarm,
  PreferencesSchema,
  FarmBookSchema,
  type GuardianAction,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { herdGroupsAt } from "../src/lib/guardian/herd-locations.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";

const phone = "000000000000378",
  day = "2026-10-30",
  at = "2026-10-30T12:00:00Z";
const source = { actor: phone, messageId: "synthetic", at, confirmed: true as const };
const snapshot = (): GuardianSnapshot => ({
  accountVersion: 0,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  active: { id: "eduardo", version: 0, role: "owner", book: emptyFarm("Eduardo", "Tanabi", "SP") },
  properties: [
    { id: "eduardo", name: "Eduardo", role: "owner" },
    { id: "tambori", name: "Tambori", role: "owner" },
  ],
});

test("panel access understands a farm noun, conversational requests, punctuation and the immediate farm-name reply", async () => {
  for (const text of [
    "Gerar código do painel para a fazenda eduardo",
    "Pode me enviar o código do painel da fazenda Eduardo, por favor?",
    "Tpec, me manda o código do painel para a minha fazenda Eduardo, por favor.",
    "Quero abrir o painel da fazenda Eduardo.",
    "Preciso de acesso ao painel da fazenda Eduardo",
    "Gerar código para a fazenda Eduardo",
    "Gerar código do painel para 1",
  ]) {
    let issued = "";
    const reply = await handlePanelCodeRequest(
      { phone, messageId: text.slice(0, 100), text },
      {
        load: async () => snapshot(),
        code: () => "ABCD2345EFGH6789",
        issue: async (_p, property) => {
          issued = property;
          return true;
        },
      },
    );
    assert.equal(issued, "eduardo", text + ": " + reply);
    assert.match(reply!, /Seu código para Eduardo/);
  }
  for (const text of ["Eduardo", "A fazenda Eduardo", "Pode ser a fazenda Eduardo", "1. Eduardo"]) {
    const reply = await handlePanelCodeRequest(
      {
        phone,
        messageId: "follow",
        text,
        history: [
          {
            role: "assistant",
            content: "Escolha a fazenda para abrir no painel:\n1. Eduardo\n2. Tambori",
          },
        ],
      },
      { load: async () => snapshot(), issue: async () => true, code: () => "ABCD2345EFGH6789" },
    );
    assert.match(reply!, /Seu código para Eduardo/, text);
  }
});

test("panel access never issues codes for an unknown/ambiguous farm, mismatched numbered reply, negation, third party or an unrelated follow-up", async () => {
  let calls = 0;
  const deps = {
    load: async () => snapshot(),
    issue: async () => {
      calls++;
      return true;
    },
  };
  for (const text of [
    "Gerar código do painel para a fazenda de outra pessoa",
    "Gerar código do painel para 99",
    "Gerar código do painel para fazenda Edu",
  ]) {
    assert.match(
      (await handlePanelCodeRequest({ phone, messageId: "missing", text }, deps))!,
      /Escolha a fazenda/,
    );
  }
  const history = [{ role: "assistant", content: "Escolha a fazenda para abrir no painel:" }];
  assert.match(
    (await handlePanelCodeRequest(
      { phone, messageId: "mismatch", text: "1. Tambori", history },
      deps,
    ))!,
    /não correspondem/,
  );
  for (const text of [
    "Não quero gerar código do painel",
    "Como eu gero o código do painel?",
    "Meu vizinho quer abrir o painel da fazenda Eduardo",
    "Crie o lote 4 com 12 hectares",
    "Eduardo",
  ]) {
    assert.equal(await handlePanelCodeRequest({ phone, messageId: "none", text }, deps), null);
  }
  assert.equal(
    await handlePanelCodeRequest(
      { phone, messageId: "topic", text: "Crie o lote 4 com 12 hectares", history },
      deps,
    ),
    null,
  );
  const s = snapshot();
  s.properties.push({ id: "duplicate", name: "Fazenda Eduardo", role: "owner" });
  assert.match(
    (await handlePanelCodeRequest(
      { phone, messageId: "ambiguous", text: "gerar código do painel para a fazenda Eduardo" },
      { ...deps, load: async () => s },
    ))!,
    /Escolha a fazenda/,
  );
  assert.equal(calls, 0);
  assert.equal(panelAccessRequest("1"), null);
});

function seed() {
  return prepareFarmBatch({
    book: emptyFarm("Eduardo", "Tanabi", "SP"),
    role: "owner",
    propertyId: "farm",
    source,
    executedByMessageId: "seed",
    actions: [
      { kind: "herd_count", date: "2026-10-28", count: 120, species: "cattle" },
      {
        kind: "herd_event",
        date: "2026-10-29",
        count: 50,
        species: "cattle",
        type: "purchase",
        description: "50 bovinos comprados",
      },
      {
        kind: "herd_event",
        date: "2026-10-29",
        count: 58,
        species: "pig",
        type: "transfer_in",
        description: "58 porcos chegados",
      },
      { kind: "lot_update", lot: "2", areaHa: 10, pasture: "Braquiária" },
      { kind: "animal", code: "b01", lot: "2" },
      { kind: "animal", code: "b02", lot: "antigo", status: "sold" },
    ],
  }).book;
}
const apply = (book: ReturnType<typeof seed>, actions: GuardianAction[], time = at) =>
  prepareFarmBatch({
    book,
    role: "owner",
    propertyId: "farm",
    source: { ...source, at: time, messageId: `step:${time}:${actions[0].kind}` },
    executedByMessageId: "move",
    actions,
  }).book;

test("move all uses the complete persisted stock, preserves unknown species totals, groups, origins and sold animals", () => {
  const before = seed();
  const book = apply(before, [{ kind: "herd_relocate", to: "lote quatro", date: day }]);
  assert.equal(stockAt(book.operations!, day).count, 170);
  assert.equal(stockAt(book.operations!, day, "4").count, 170);
  assert.equal(stockAt(book.operations!, day, "2").count, 0);
  assert.equal(stockAt(book.operations!, day, undefined, "pig").count, null);
  assert.equal(stockAt(book.operations!, day, "4", "pig").count, null);
  assert.equal(stockAt(book.operations!, day, "2", "pig").count, 0);
  assert.equal(book.animals.find((a) => a.code === "b01")!.lot, "4");
  assert.equal(book.animals.find((a) => a.code === "b02")!.lot, "antigo");
  assert.deepEqual(book.operations!.counts, before.operations!.counts);
  assert.deepEqual(book.operations!.movements, before.operations!.movements);
  assert.equal(book.operations!.lotPlacements!.length, 2);
  assert.equal(stockAt(book.operations!, "2026-10-29", "4").count, null);
  assert.equal(
    herdGroupsAt(book.operations!, day).find((g) => g.species === "pig")!.locations[0].lot,
    "4",
  );
  assert.match(farmCsv(book), /Localização de todo o rebanho/);
  FarmBookSchema.parse(book);
});

test("whole-herd placement supports later same-day arrivals, partial group moves, another full move and species restrictions", () => {
  let book = apply(seed(), [{ kind: "herd_relocate", to: "4", date: day }]);
  book = apply(
    book,
    [
      {
        kind: "herd_event",
        date: day,
        count: 5,
        species: "cattle",
        type: "purchase",
        description: "Outros cinco bovinos comprados",
      },
    ],
    "2026-10-30T13:00:00Z",
  );
  assert.equal(stockAt(book.operations!, day).count, 175);
  assert.equal(stockAt(book.operations!, day, "4").count, 170);
  const group = book.operations!.movements.find((m) => m.count === 50)!;
  book = apply(
    book,
    [
      {
        kind: "lot_transfer",
        to: "5",
        from: "4",
        date: day,
        count: 1,
        species: "cattle",
        movementId: group.id,
        createDestination: true,
      },
    ],
    "2026-10-30T14:00:00Z",
  );
  assert.equal(stockAt(book.operations!, day, "4").count, 169);
  assert.equal(stockAt(book.operations!, day, "5").count, 1);
  book = apply(
    book,
    [{ kind: "herd_relocate", to: "6", date: day, species: "cattle" }],
    "2026-10-30T15:00:00Z",
  );
  assert.equal(stockAt(book.operations!, day, "6").count, 175);
  assert.equal(stockAt(book.operations!, day, "5").count, 0);
  assert.equal(stockAt(book.operations!, day, "4").count, 0);
  assert.equal(
    herdGroupsAt(book.operations!, day).find((g) => g.species === "pig")!.locations[0].lot,
    "4",
  );
  assert.equal(
    herdGroupsAt(book.operations!, day).find((g) => g.movementId === group.id)!.locations[0].lot,
    "6",
  );
});

test("lot creation and area edits need no census and preserve all animal data", () => {
  const before = seed();
  const book = apply(before, [
    { kind: "lot_update", lot: "lote três", areaHa: 12.5, pasture: "Mombaça" },
    { kind: "lot_update", lot: "3", areaHa: 14 },
  ]);
  assert.deepEqual(
    book.operations!.lots.find((l) => l.name === "3"),
    { name: "3", areaHa: 14, pasture: "Mombaça" },
  );
  assert.equal(stockAt(book.operations!, day, "3").count, null);
  assert.deepEqual(book.operations!.counts, before.operations!.counts);
  assert.deepEqual(book.animals, before.animals);
});

test("known live lot balances allow quantitative transfers into a new lot without fabricated historical censuses", () => {
  let book = apply(seed(), [{ kind: "herd_relocate", to: "2", date: day }]);
  const counts = structuredClone(book.operations!.counts);
  book = apply(
    book,
    [
      {
        kind: "lot_transfer",
        from: "2",
        to: "piquete oito",
        count: 10,
        species: "cattle",
        date: day,
        createDestination: true,
      },
    ],
    "2026-10-30T14:00:00Z",
  );
  assert.equal(stockAt(book.operations!, day, "2").count, 160);
  assert.equal(stockAt(book.operations!, day, "8").count, 10);
  assert.equal(stockAt(book.operations!, day).count, 170);
  assert.deepEqual(book.operations!.counts, counts);
  assert.throws(
    () =>
      apply(book, [
        {
          kind: "lot_transfer",
          from: "2",
          to: "9",
          count: 161,
          date: day,
          createDestination: true,
        },
      ]),
    /saldo conhecido/,
  );
});

test("later censuses and unlocated departures do not leave a falsely exact lot total; earlier stock cannot be changed behind a placement", () => {
  const placed = apply(seed(), [{ kind: "herd_relocate", to: "2", date: day }]);
  const recounted = apply(
    placed,
    [{ kind: "herd_count", count: 190, date: day, species: "cattle" }],
    "2026-10-30T14:00:00Z",
  );
  assert.equal(stockAt(recounted.operations!, day).count, 190);
  assert.equal(stockAt(recounted.operations!, day, "2").count, null);
  const sold = apply(
    placed,
    [
      {
        kind: "herd_event",
        count: 2,
        date: day,
        type: "sale",
        species: "cattle",
        description: "Dois bovinos vendidos sem informar origem",
      },
    ],
    "2026-10-30T14:00:00Z",
  );
  assert.equal(stockAt(sold.operations!, day).count, 168);
  assert.equal(stockAt(sold.operations!, day, "2").count, null);
  assert.throws(
    () => apply(placed, [{ kind: "herd_count", count: 200, date: "2026-10-29" }]),
    /mudança posterior/,
  );
});

test("invalid whole-herd relocation, unauthorized role and failed mixed batches cannot change books", () => {
  const book = seed(),
    before = JSON.stringify(book);
  assert.throws(() => apply(book, [{ kind: "herd_relocate", to: "4", date: "2026-10-29" }]));
  assert.throws(() =>
    apply(book, [{ kind: "herd_relocate", to: "4", date: day, species: "sheep" }]),
  );
  assert.throws(
    () =>
      prepareFarmBatch({
        book,
        source,
        role: "worker",
        propertyId: "farm",
        executedByMessageId: "bad",
        actions: [{ kind: "herd_relocate", to: "4", date: day }],
      }),
    /não permite/i,
  );
  assert.throws(() =>
    apply(book, [
      { kind: "herd_relocate", to: "4", date: day },
      { kind: "lot_update", lot: "5", areaHa: -1 },
    ]),
  );
  assert.equal(JSON.stringify(book), before);
});

test("SQL and HTTP: natural panel access selects the authorized farm; move-all commits once and survives reload without duplicate arrivals", async () => {
  const f = await farmIntegration();
  try {
    const propertyId = randomUUID();
    await f.guardian.commit({
      phone,
      messageId: "seed",
      accountVersion: 0,
      propertyId,
      propertyVersion: null,
      operation: "create",
      book: seed(),
      pending: null,
      reply: "Criada",
    });
    const code = "ABCD2345EFGH6789";
    const reply = await handlePanelCodeRequest(
      { phone, messageId: "code", text: "Gerar código do painel para a fazenda Eduardo" },
      { load: f.guardian.load, issue: f.issue, code: () => code },
    );
    assert.match(reply!, /Seu código para Eduardo/);
    const stored = (
      await f.db.query<{ property_id: string }>(
        "select property_id from guardian_panel_codes where token_hash=$1",
        [hashToken(code)],
      )
    ).rows;
    assert.equal(stored[0].property_id, propertyId);
    const text =
      "Tpec, todos os animais que eu tenho na fazenda Eduardo, você pode mover eles para o lote 2, por favor?";
    const send = () =>
      handleGuardianMessage(
        { phone, messageId: "all", text, mediaType: "audio" },
        {
          store: f.guardian,
          now: new Date(at),
          interpret: async (c) => ({
            intent: "apply",
            propertyId,
            question: "",
            entries: [
              {
                action: { kind: "herd_relocate", to: "2", date: day },
                evidence: [{ messageIndex: c.messages.length - 1, quote: text }],
              },
            ],
          }),
        },
      );
    const first = await send();
    assert.equal(first!.persisted, true, first!.reply);
    await send();
    let s = await f.guardian.load(phone);
    assert.equal(s.active!.book.operations!.lotPlacements!.length, 2);
    assert.equal(s.active!.book.operations!.movements.length, 2);
    assert.equal(stockAt(s.active!.book.operations!, day, "2").count, 170);
    assert.equal(
      (await f.db.query("select * from guardian_audit where message_id='all'")).rows.length,
      1,
    );
    const token = hashToken("synthetic-session");
    assert.equal(await f.store.exchange(hashToken(code), hashToken(token)), true);
    const req = () =>
      new Request("https://tpecia.example/api/public/farm-panel", {
        headers: { cookie: "tpec_farm_session=" + token, "x-tpec-panel": "1" },
      });
    const response = await handleFarmPanel(req(), { enabled: true, store: f.store });
    assert.equal(response.status, 200);
    const view = await response.json();
    assert.equal(stockAt(view.book.operations, day, "2").count, 170);
    s = await f.guardian.load(phone);
    assert.equal(s.active!.book.operations!.counts.length, 1);
  } finally {
    await f.db.close();
  }
});
