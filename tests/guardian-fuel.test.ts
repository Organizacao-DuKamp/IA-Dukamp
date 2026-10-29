import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyFarm,
  FarmBookSchema,
  canEdit,
  type GuardianAction,
} from "../src/lib/guardian/schema.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { fuelMonth, fuelStocks } from "../src/lib/guardian/fuel.ts";
import { fuelObservation } from "../src/lib/guardian/fuel-language.ts";
import { ledgerForTotals } from "../src/lib/guardian/finance.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { handleFarmPanel, hashToken, PANEL_COOKIE } from "../src/lib/guardian/panel.server.ts";
const phone = "000000000000095",
  at = new Date("2026-10-29T14:00:00Z");
const source = (n = 0) => ({
  actor: phone,
  messageId: "fuel-test-" + n,
  at: new Date(at.getTime() + n * 1000).toISOString(),
  confirmed: true as const,
});
const fresh = () => emptyFarm("QA Combustível", "Tanabi", "SP");
const apply = (b: ReturnType<typeof fresh>, a: GuardianAction, n: number) =>
  applyFarmAction(b, a, "owner", source(n), "f" + n).book;

test("fuel conversation recognizes daily costs, monthly totals, spoken amounts, destinations and separately paid tank entries", () => {
  const cases: Array<[string, string, number]> = [
    ["Hoje o custo da gasolina foi 500", "fuel_expense", 50000],
    ["Esse mês foi 2000 de gasolina", "fuel_expense", 200000],
    ["Gastei 250 reais com gasolina hoje", "fuel_expense", 25000],
    ["Paguei dois mil de diesel hoje", "fuel_expense", 200000],
    ["Abasteci o caminhão com 20 litros de gasolina", "fuel_movement", 20],
    ["Saíram 250 L de diesel para o trator", "fuel_movement", 250],
    ["No tanque principal tem 1000 litros de diesel", "fuel_movement", 1000],
    ["Entrou 500 litros de diesel no tanque principal e paguei R$ 3000", "fuel_movement", 500],
  ];
  for (const [text, kind, value] of cases) {
    const o = fuelObservation(text, at);
    assert.equal(o.status, "actions", text);
    if (o.status !== "actions") throw Error(text);
    assert.equal(o.actions.length, 1, text);
    const a = o.actions[0];
    assert.equal(a.kind, kind);
    assert.equal(
      a.kind === "fuel_expense" ? a.amountCents : a.kind === "fuel_movement" ? a.liters : 0,
      value,
      text,
    );
  }
  const month = fuelObservation(cases[1][0], at);
  assert.ok(
    month.status === "actions" &&
      month.actions[0].kind === "fuel_expense" &&
      month.actions[0].periodMonth === "2026-10",
  );
});
test("negatives, quotations, hypotheticals and plans never become fuel writes; missing amounts ask only for money", () => {
  for (const text of [
    "Não gastei 500 com gasolina",
    "Vou comprar 100 litros de diesel",
    "Se eu gastar 200 com gasolina",
    "Meu vizinho disse que gastou 500 de diesel",
    'Ele falou "gastei 500 com gasolina"',
  ])
    assert.equal(fuelObservation(text, at).status, "ignored", text);
  for (const text of ["Hoje o custo da gasolina foi tanto", "Esse mês foi tanto de gasolina"]) {
    const o = fuelObservation(text, at);
    assert.ok(o.status === "pending" && /valor gasto/.test(o.question));
  }
  assert.equal(fuelObservation("Saíram -20 litros de diesel para o trator", at).status, "pending");
  assert.equal(fuelObservation("Paguei 100 com gasolina em 31/02/2026", at).status, "pending");
});
test("tank stock carries between months, keeps fuels isolated, groups destinations and refuses an impossible known withdrawal", () => {
  let b = apply(
    fresh(),
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "balance",
      liters: 1000,
      date: "2026-09-30",
    },
    1,
  );
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "in",
      liters: 500,
      date: "2026-10-01",
      amountCents: 300000,
    },
    2,
  );
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "principal",
      type: "out",
      liters: 250,
      date: "2026-10-02",
      destination: "Trator",
    },
    3,
  );
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "out",
      liters: 20,
      date: "2026-10-03",
      destination: "Caminhão",
    },
    4,
  );
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "gasoline",
      tank: "Principal",
      type: "balance",
      liters: 50,
      date: "2026-10-01",
    },
    5,
  );
  const m = fuelMonth(b, "2026-10");
  assert.equal(m.entered, 500);
  assert.equal(m.exited, 270);
  assert.equal(m.expenseCents, 300000);
  assert.equal(m.stocks.find((x) => x.fuel === "diesel")!.liters, 1230);
  assert.equal(m.stocks.find((x) => x.fuel === "gasoline")!.liters, 50);
  assert.equal(fuelMonth(b, "2026-09").stocks[0].liters, 1000);
  assert.deepEqual(
    m.destinations.map((x) => [x.name, x.liters]),
    [
      ["Trator", 250],
      ["Caminhão", 20],
    ],
  );
  assert.throws(
    () =>
      apply(
        b,
        {
          kind: "fuel_movement",
          fuel: "diesel",
          tank: "Principal",
          type: "out",
          liters: 2000,
          date: "2026-10-29",
          destination: "Trator",
        },
        6,
      ),
    /negativo/,
  );
  assert.equal(fuelStocks(b).find((x) => x.fuel === "diesel")!.liters, 1230);
  assert.ok(FarmBookSchema.safeParse(b).success);
  assert.equal(b.ledger.length, 1);
  assert.equal(b.records.length, 0);
});
test("a cost never invents liters; withdrawals without a starting balance keep the stock unknown", () => {
  let b = apply(
    fresh(),
    { kind: "fuel_expense", fuel: "gasoline", amountCents: 50000, date: "2026-10-29" },
    1,
  );
  assert.deepEqual(fuelStocks(b), []);
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "gasoline",
      tank: "Principal",
      type: "out",
      liters: 20,
      date: "2026-10-29",
      destination: "Caminhão",
    },
    2,
  );
  assert.equal(fuelStocks(b)[0].liters, null);
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 50000);
});
test("monthly fuel totals absorb earlier details for that fuel, preserve other farm expenses and add later daily costs once", () => {
  let b = apply(
    fresh(),
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 8000000,
      date: "2026-10-29",
      description: "Ração",
    },
    1,
  );
  b = apply(
    b,
    { kind: "fuel_expense", fuel: "gasoline", amountCents: 50000, date: "2026-10-29" },
    2,
  );
  b = apply(
    b,
    {
      kind: "fuel_expense",
      fuel: "gasoline",
      amountCents: 200000,
      date: "2026-10-29",
      periodMonth: "2026-10",
    },
    3,
  );
  b = apply(b, { kind: "fuel_expense", fuel: "diesel", amountCents: 30000, date: "2026-10-29" }, 4);
  b = apply(
    b,
    { kind: "fuel_expense", fuel: "gasoline", amountCents: 10000, date: "2026-10-29" },
    5,
  );
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 240000);
  assert.equal(
    ledgerForTotals(b.ledger).reduce((n, e) => n + e.amountCents, 0),
    8240000,
  );
  assert.equal(b.ledger.length, 5);
  b = apply(
    b,
    {
      kind: "fuel_expense",
      fuel: "gasoline",
      amountCents: 220000,
      date: "2026-10-29",
      periodMonth: "2026-10",
    },
    6,
  );
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 250000);
  assert.equal(b.ledger.length, 6);
  b = apply(
    b,
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 9000000,
      date: "2026-10-29",
      periodMonth: "2026-10",
      description: "Total da fazenda",
    },
    7,
  );
  assert.equal(
    ledgerForTotals(b.ledger).reduce((n, e) => n + e.amountCents, 0),
    9000000,
  );
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 250000);
});
test("canceling a tank entry cancels its linked cost with provenance; undoing stock used later is refused atomically", () => {
  let b = apply(
    fresh(),
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "balance",
      liters: 100,
      date: "2026-10-01",
    },
    1,
  );
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "in",
      liters: 50,
      date: "2026-10-02",
      amountCents: 30000,
    },
    2,
  );
  const cancelled = apply(b, { kind: "fuel_void", id: "f2", reason: "Lançamento incorreto" }, 3);
  assert.equal(fuelStocks(cancelled)[0].liters, 100);
  assert.equal(fuelMonth(cancelled, "2026-10").expenseCents, 0);
  assert.ok(cancelled.fuel!.movements[1].voided?.source);
  assert.ok(cancelled.ledger[0].voided);
  b = apply(
    b,
    {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "out",
      liters: 120,
      date: "2026-10-03",
      destination: "Trator",
    },
    4,
  );
  assert.throws(
    () => apply(b, { kind: "fuel_void", id: "f2", reason: "Incorreto" }, 5),
    /negativo/,
  );
  assert.equal(b.fuel!.movements[1].voided, undefined);
  assert.equal(
    canEdit("worker", {
      kind: "fuel_expense",
      fuel: "diesel",
      amountCents: 100,
      date: "2026-10-29",
    }),
    false,
  );
});
async function fixture() {
  const f = await farmIntegration(),
    id = randomUUID();
  await f.guardian.commit({
    phone,
    messageId: "create",
    accountVersion: 0,
    propertyId: id,
    propertyVersion: null,
    operation: "create",
    book: fresh(),
    pending: null,
    reply: "ok",
  });
  return { ...f, id };
}
test("a whole-fuel monthly total includes typed details without hiding unrelated expenses", () => {
  let b = apply(
    fresh(),
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 8000000,
      date: "2026-10-29",
      description: "Ração",
    },
    1,
  );
  b = apply(b, { kind: "fuel_expense", fuel: "diesel", amountCents: 30000, date: "2026-10-29" }, 2);
  b = apply(
    b,
    {
      kind: "fuel_expense",
      fuel: "gasoline",
      amountCents: 20000,
      date: "2026-10-29",
      periodMonth: "2026-10",
    },
    3,
  );
  b = apply(
    b,
    {
      kind: "fuel_expense",
      fuel: "unspecified",
      amountCents: 100000,
      date: "2026-10-29",
      periodMonth: "2026-10",
    },
    4,
  );
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 100000);
  assert.equal(
    ledgerForTotals(b.ledger).reduce((n, e) => n + e.amountCents, 0),
    8100000,
  );
  b = apply(b, { kind: "fuel_expense", fuel: "diesel", amountCents: 10000, date: "2026-10-29" }, 5);
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 110000);
});
test("fuel references in one report keep the declared tank and common spoken destinations", () => {
  for (const text of [
    "Entrou 500 litros de diesel no tanque Norte e tirei 250 litros para o trator",
    "Abasteci o tanque com 200 litros de diesel",
    "Coloquei 20 litros de gasolina no caminhão",
  ]) {
    const o = fuelObservation(text, at);
    assert.equal(o.status, "actions", JSON.stringify(o));
    if (o.status !== "actions") throw Error("missing fuel actions");
    if (text.includes("Norte")) {
      assert.equal(o.actions.length, 2);
      assert.ok(o.actions.every((a) => a.kind === "fuel_movement" && a.tank === "Norte"));
    } else
      assert.equal(
        o.actions[0].kind === "fuel_movement" && o.actions[0].type,
        text.includes("tanque") ? "in" : "out",
      );
  }
});
test("WhatsApp finance and fuel use one persistent ledger, monthly completion needs only the missing amount, and replays cannot duplicate it", async () => {
  const f = await fixture();
  let i = 0;
  const send = (
    id: string,
    text: string,
    history?: Array<{ role: "assistant"; content: string }>,
  ) =>
    handleGuardianMessage(
      {
        phone,
        messageId: id,
        text,
        mediaType: "audio",
        sentAt: new Date(at.getTime() + ++i * 1000).toISOString(),
        history,
      },
      {
        store: f.guardian,
        now: new Date(at.getTime() + i * 1000),
        extract: async () => {
          throw Error("No AI may pretend persistence");
        },
      },
    );
  try {
    assert.equal((await send("cost", "Hoje o custo da gasolina foi 500"))?.persisted, true);
    const q = await send("monthly-draft", "Esse mês foi tanto de gasolina");
    assert.equal(q?.persisted, false);
    assert.match(q!.reply!, /valor gasto/);
    const saved = await send("monthly-value", "2000", [{ role: "assistant", content: q!.reply! }]);
    assert.equal(saved?.persisted, true, saved?.reply ?? "");
    await send("monthly-value", "2000");
    const s = await f.guardian.load(phone);
    assert.equal(s.active!.book.ledger.length, 2);
    assert.equal(fuelMonth(s.active!.book, "2026-10").expenseCents, 200000);
    assert.equal(s.active!.book.ledger[1].source.messageId, "monthly-draft");
    assert.equal(s.pending, null);
    assert.equal(
      (
        await f.db.query(
          "select count(*)::int n from guardian_audit where message_id='monthly-value'",
        )
      ).rows[0].n,
      1,
    );
    const query = await send("query", "Quanto gastei com combustível esse mês?");
    assert.match(query!.reply!, /2\.000,00/);
    await send("diesel", "Gastei R$ 300 com diesel hoje");
    const specific = await send("query-gasoline", "Quanto gastei com gasolina esse mês?");
    assert.match(specific!.reply!, /2\.000,00/);
    assert.doesNotMatch(specific!.reply!, /2\.300,00/);
  } finally {
    await f.db.close();
  }
});
test("fuel plus cattle plus a reminder remain one atomic multi-objective request", async () => {
  const f = await fixture();
  try {
    const r = await handleGuardianMessage(
      {
        phone,
        messageId: "compound",
        text: "Entrou 500 litros de diesel e paguei R$ 3000; nasceram 2 bezerros hoje; me lembra amanhã às 13h30 de conferir o tanque",
      },
      {
        store: f.guardian,
        now: at,
        extract: async () => {
          throw Error("No AI");
        },
      },
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.fuel?.movements.length, 1);
    assert.equal(b.ledger.length, 1);
    assert.equal(b.ledger[0].amountCents, 300000);
    assert.equal(b.tasks.length, 1);
    assert.equal(b.operations!.movements[0].count, 2);
  } finally {
    await f.db.close();
  }
});
test("the producer can add 'mais 100' in the current confirmed fuel conversation without repeating purpose", async () => {
  const f = await fixture();
  let i = 0;
  const send = (
    id: string,
    text: string,
    history?: Array<{ role: "user" | "assistant"; content: string }>,
  ) =>
    handleGuardianMessage(
      { phone, messageId: id, text, history },
      {
        store: f.guardian,
        now: new Date(at.getTime() + ++i * 1000),
        extract: async () => {
          throw Error("No guessed persistence");
        },
      },
    );
  try {
    const statement = "Hoje o custo da gasolina foi 500",
      r = await send("first", statement);
    const next = await send("extra", "mais 100", [
      { role: "user", content: statement },
      { role: "assistant", content: r!.reply! },
    ]);
    assert.equal(next?.persisted, true, next?.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(fuelMonth(b, "2026-10").expenseCents, 60000);
    assert.equal(b.ledger[1].category, "fuel:gasoline");
  } finally {
    await f.db.close();
  }
});
test("a repeated report asks whether it is the same purchase, while an explicit new equal expense remains possible", async () => {
  const f = await fixture();
  let i = 0;
  const send = (id: string, text: string) =>
    handleGuardianMessage(
      { phone, messageId: id, text },
      { store: f.guardian, now: new Date(at.getTime() + ++i * 1000), extract: async () => null },
    );
  try {
    await send("first", "Gastei 500 reais com gasolina hoje");
    const q = await send("repeat", "Paguei 500 reais de gasolina hoje");
    assert.equal(q?.persisted, false);
    assert.match(q!.reply!, /registro igual/);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
    await send("same", "o mesmo");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
    await send("repeat2", "Paguei 500 reais de gasolina hoje");
    const other = await send("other", "outro");
    assert.equal(other?.persisted, true, other?.reply ?? "");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 2);
  } finally {
    await f.db.close();
  }
});
test("public panel writes fuel into the WhatsApp book with role checks, version conflicts, isolated cookies and replay protection", async () => {
  const f = await fixture();
  const session = "f".repeat(64),
    hash = hashToken(session),
    base = "http://localhost";
  try {
    const code = hashToken("fuel-test-code");
    assert.equal(await f.issue(phone, f.id, "fuel-panel-code", code), true);
    assert.equal(await f.store.exchange(code, hash), true);
    const action = {
      kind: "fuel_movement",
      fuel: "diesel",
      tank: "Principal",
      type: "balance",
      liters: 1000,
      date: "2026-10-01",
    };
    const request = (version: number, id: string, a: unknown, cookie = true) =>
      handleFarmPanel(
        new Request(base + "/api/public/farm-panel", {
          method: "POST",
          headers: {
            origin: base,
            "content-type": "application/json",
            "x-tpec-panel": "1",
            ...(cookie ? { cookie: PANEL_COOKIE + "=" + session } : {}),
          },
          body: JSON.stringify({ kind: "action", requestId: id, version, action: a }),
        }),
        { store: f.store, enabled: true },
      );
    const id = randomUUID();
    assert.equal((await request(0, id, action)).status, 200);
    assert.equal((await request(0, id, action)).status, 200);
    assert.equal((await request(0, randomUUID(), action)).status, 409);
    assert.equal((await request(1, randomUUID(), action, false)).status, 401);
    assert.equal((await f.guardian.load(phone)).active!.book.fuel!.movements.length, 1);
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    assert.equal((await request(1, randomUUID(), action)).status, 403);
  } finally {
    await f.db.close();
  }
});
test("explicit legacy fuel expenses appear without backfilling rows and are absorbed by a later declared fuel total", () => {
  let b = apply(
    fresh(),
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 250000,
      date: "2026-10-20",
      description: "Gasolina para a fazenda",
    },
    1,
  );
  const original = structuredClone(b.ledger[0]);
  b = apply(
    b,
    {
      kind: "fuel_expense",
      fuel: "gasoline",
      amountCents: 300000,
      date: "2026-10-29",
      periodMonth: "2026-10",
    },
    2,
  );
  assert.equal(fuelMonth(b, "2026-10").expenseCents, 300000);
  assert.equal(
    ledgerForTotals(b.ledger).reduce((n, e) => n + e.amountCents, 0),
    300000,
  );
  assert.deepEqual(b.ledger[0], original);
});
test("a natural cancellation preserves the original expense and audit rather than deleting it", async () => {
  const f = await fixture();
  try {
    const send = (id: string, text: string) =>
      handleGuardianMessage(
        { phone, messageId: id, text },
        { store: f.guardian, now: at, extract: async () => null },
      );
    await send("first", "Gastei R$ 500 de gasolina hoje");
    const invalid = await send("invalid", "Cancele a despesa de gasolina de 31/02/2026");
    assert.equal(invalid?.persisted, false);
    assert.equal(
      fuelMonth((await f.guardian.load(phone)).active!.book, "2026-10").expenseCents,
      50000,
    );
    const r = await send("cancel", "Cancele a última despesa de gasolina");
    assert.equal(r?.persisted, true, r?.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.ledger.length, 1);
    assert.ok(b.ledger[0].voided?.source);
    assert.equal(fuelMonth(b, "2026-10").expenseCents, 0);
  } finally {
    await f.db.close();
  }
});
test("a declared unit price is multiplied only by declared liters and retains its evidence", () => {
  const o = fuelObservation("Comprei 100 litros de diesel por R$ 6,50 por litro", at);
  assert.equal(o.status, "actions", JSON.stringify(o));
  if (o.status !== "actions") throw Error("missing purchase");
  const b = apply(fresh(), o.actions[0], 1);
  assert.equal(b.ledger[0].amountCents, 65000);
  assert.equal(b.fuel!.movements[0].unitPriceCents, 650);
  assert.equal(fuelObservation("Comprei diesel por R$ 6,50 por litro", at).status, "pending");
});
