import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm, type LedgerEntry, type FarmBook } from "../src/lib/guardian/schema.ts";
import { stockAt, farmIndicators } from "../src/lib/guardian/operations.ts";
import { ledgerForTotals } from "../src/lib/guardian/finance.ts";
import { recordDialogue } from "../src/lib/guardian/record-dialogue.ts";
import { handlePanelCodeRequest } from "../src/lib/guardian/panel.server.ts";

const phone = "5517999991111",
  at = new Date("2026-10-27T20:30:13Z");
const noAI = async () => {
  throw Error("No general model or extractor may execute these operations");
};
async function create(f: Awaited<ReturnType<typeof farmIntegration>>, name: string) {
  const s = await f.guardian.load(phone),
    id = randomUUID();
  assert.equal(
    await f.guardian.commit({
      phone,
      messageId: `create-${name}`,
      accountVersion: s.accountVersion,
      propertyId: id,
      propertyVersion: null,
      operation: "create",
      book: emptyFarm(name, "Tanabi", "SP"),
      pending: null,
      reply: "ok",
    }),
    "committed",
  );
  return id;
}
const send = (
  f: Awaited<ReturnType<typeof farmIntegration>>,
  id: string,
  text: string,
  time = at,
) =>
  handleGuardianMessage(
    { phone, messageId: id, text, sentAt: time.toISOString() },
    { store: f.guardian, now: time, extract: noAI },
  );

test("the panel property picker accepts the producer's numbered name reply only in its own context", async () => {
  const f = await farmIntegration();
  try {
    await create(f, "Eduardo");
    await create(f, "Tambori");
    let issued = "";
    const deps = {
      load: f.guardian.load,
      issue: async (_p: string, id: string) => {
        issued = id;
        return true;
      },
      code: () => "ABCD2345EFGH6789",
    };
    const choices = await handlePanelCodeRequest(
      { phone, messageId: "picker", text: "gerar código da fazenda" },
      deps,
    );
    assert.match(choices!, /Escolha a fazenda/);
    const snapshot = await f.guardian.load(phone);
    const target = snapshot.properties[1];
    const answer = await handlePanelCodeRequest(
      {
        phone,
        messageId: "choice",
        text: `2. ${target.name}`,
        history: [{ role: "assistant", content: choices! }],
      },
      deps,
    );
    assert.match(answer!, /Seu código/);
    assert.equal(issued, target.id);
    assert.equal(
      await handlePanelCodeRequest({ phone, messageId: "unrelated", text: "2. Tambori" }, deps),
      null,
    );
  } finally {
    await f.db.close();
  }
});

test("legacy farm without operations receives births without tags and an explicit property selects the right book", async () => {
  const f = await farmIntegration();
  try {
    const tambori = await create(f, "Tambori"),
      eduardo = await create(f, "Eduardo");
    const first = await send(f, "born", "Nasceu 2 bezerros hoje aqui na fazenda tambori");
    assert.equal(first?.persisted, true, first?.reply ?? "");
    assert.match(first!.reply!, /Rebanho: 2 nascimentos/);
    assert.match(first!.reply!, /total ainda é desconhecido/);
    const s = await f.guardian.load(phone);
    assert.equal(s.active!.id, tambori);
    assert.equal(s.active!.book.records.length, 0);
    assert.equal(s.active!.book.animals.length, 0);
    assert.equal(s.active!.book.operations!.movements.length, 1);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, null);
    await send(f, "born", "Nasceu 2 bezerros hoje aqui na fazenda tambori");
    const again = await send(
      f,
      "rephrase",
      "Eu quero que você registre 2 novos bezerros na fazenda tambori que nasceram hoje",
    );
    assert.match(again!.reply!, /mesmos animais ou de mais 2/);
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.movements.length, 1);
    await send(f, "same", "são os mesmos");
    const total = await send(f, "count", "Quantos animais eu tenho na fazenda tambori?");
    assert.match(total!.reply!, /2 nascimentos/);
    assert.match(total!.reply!, /total é desconhecido/);
    assert.doesNotMatch(total!.reply!, /precisa.*brinco/);
    const other = await f.rpc<FarmBook>("select book data from guardian_properties where id=$1", [
      eduardo,
    ]);
    assert.equal(other.operations, undefined);
    assert.equal(other.records.length, 0);
  } finally {
    await f.db.close();
  }
});

test("the active farm persists for short natural statements, while explicit inaccessible farms never receive writes", async () => {
  const f = await farmIntegration();
  try {
    await create(f, "Tambori");
    await create(f, "Eduardo");
    await send(f, "select", "Tambori");
    const saved = await send(f, "birth", "Hoje nasceram mais dois bezerros no lote 1");
    assert.equal(saved!.persisted, true, saved!.reply ?? "");
    const before = await f.guardian.load(phone);
    const wrong = await send(f, "wrong", "Hoje nasceram 2 bezerros na fazenda Desconhecida");
    assert.notEqual(wrong!.persisted, true);
    const after = await f.guardian.load(phone);
    assert.deepEqual(after.active!.book, before.active!.book);
    const entry = after.active!.book.operations!.movements[0];
    assert.equal(entry.lot, "1");
    assert.equal(entry.count, 2);
  } finally {
    await f.db.close();
  }
});

test("monthly total plus new same-day cane expense is 85k, and a later total absorbs the detail once", async () => {
  const f = await farmIntegration();
  try {
    await create(f, "Eduardo");
    await send(
      f,
      "total",
      "Minha receita foi de 100 mil e minha despesa de 80 mil neste mês",
      new Date("2026-10-27T10:00:00Z"),
    );
    const cost = await send(
      f,
      "cane",
      "Minha fazenda tem cinco mil de despesas todos os meses com cana de açúcar",
      new Date("2026-10-27T11:00:00Z"),
    );
    assert.equal(cost!.persisted, true, cost!.reply ?? "");
    let b = (await f.guardian.load(phone)).active!.book;
    let v = farmIndicators(b, "2026-10-01", "2026-10-27").finances;
    assert.equal(v.expenseCents, 8500000);
    assert.equal(v.balanceCents, 1500000);
    assert.equal(b.ledger.length, 3);
    assert.equal(b.records.length, 0);
    await send(
      f,
      "cane",
      "Minha fazenda tem cinco mil de despesas todos os meses com cana de açúcar",
      new Date("2026-10-27T11:00:00Z"),
    );
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 3);
    await send(
      f,
      "revised",
      "Minha despesa total foi de 85 mil neste mês",
      new Date("2026-10-27T12:00:00Z"),
    );
    b = (await f.guardian.load(phone)).active!.book;
    v = farmIndicators(b, "2026-10-01", "2026-10-27").finances;
    assert.equal(v.expenseCents, 8500000);
  } finally {
    await f.db.close();
  }
});

test("an explicitly included detail is not added, and a monthly cost does not create future payments", () => {
  const total: LedgerEntry = {
    id: "total",
    direction: "expense",
    amountCents: 8000000,
    date: "2026-10-27",
    periodMonth: "2026-10",
    description: "Total",
    source: { actor: phone, messageId: "total", at: "2026-10-27T10:00:00Z", confirmed: true },
  };
  const cost: LedgerEntry = {
    ...total,
    id: "cost",
    amountCents: 500000,
    periodMonth: undefined,
    recurrence: "monthly",
    totalRelation: "included",
    source: { ...total.source, at: "2026-10-27T11:00:00Z" },
  };
  assert.deepEqual(
    ledgerForTotals([total, cost], "2026-10-01", "2026-10-27").map((x) => x.id),
    ["total"],
  );
  assert.equal(ledgerForTotals([total, cost], "2026-11-01", "2026-11-30").length, 0);
  for (const text of [
    "Tenho uma despesa de cana-de-açúcar, 2 mil mensal de despesa",
    "Minha fazenda tem 2 mil de despesa mensal com cana",
  ]) {
    const r = recordDialogue(text, at);
    assert.equal(r.kind, "slots", text);
    if (r.kind === "slots") {
      assert.equal(r.slots.entries[0].amountCents, 200000);
      assert.match(r.slots.entries[0].description!, /cana/i);
    }
  }
});

test("a declared defect becomes a field note without cattle or financial movement", async () => {
  const f = await farmIntegration();
  try {
    await create(f, "Tambori");
    const r = await send(f, "defect", "O lote 2 está com defeito na cerca");
    assert.equal(r!.persisted, true, r!.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.records.length, 1);
    assert.equal(b.records[0].lot, "2");
    assert.equal(b.ledger.length, 0);
    assert.equal(b.operations, undefined);
  } finally {
    await f.db.close();
  }
});
