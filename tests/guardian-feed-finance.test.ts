import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { recordDialogue, moneyValue } from "../src/lib/guardian/record-dialogue.ts";

const at = new Date("2026-10-28T11:16:43Z"),
  phone = "000000000000096";
test("natural monthly feed expense retains amount and purpose; assistant name is not a description", () => {
  for (const text of [
    "Coloca nas despesas que eu gasto 6000 com ração mensal",
    "Tpec, gasto 6000 com ração para o gado mensal",
    "Gastei R$ 6.000 com ração para o gado mensal",
  ]) {
    const r = recordDialogue(text, at);
    assert.equal(r.kind, "slots");
    if (r.kind !== "slots") throw Error("missing finance");
    const e = r.slots.entries[0];
    assert.equal(e.direction, "expense");
    assert.equal(e.amountCents, 600000);
    assert.match(e.description!, /^ração/);
    assert.doesNotMatch(e.description!, /mensal|tpec/i);
    assert.equal(e.recurrence, "monthly");
  }
  assert.equal(moneyValue("6000 R$"), 600000);
  const name = recordDialogue("Despesa tpec....", at);
  assert.equal(name.kind, "slots");
  if (name.kind === "slots") assert.equal(name.slots.entries[0].description, undefined);
  for (const text of [
    "Não gasto 6000 com ração mensal",
    "Vou gastar 6000 com ração mensal",
    "Gasto 6000 com ração mensal?",
  ])
    assert.equal(recordDialogue(text, at).kind, "none");
});
test("WhatsApp persists the complete feed request once despite herd identification pending and reload", async () => {
  const f = await farmIntegration();
  const send = (id: string, text: string) =>
    handleGuardianMessage(
      { phone, messageId: id, text, sentAt: at.toISOString() },
      {
        store: f.guardian,
        now: at,
        extract: async () => {
          throw Error("must not fall through to AI");
        },
      },
    );
  try {
    await f.guardian.commit({
      phone,
      messageId: "create",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      book: emptyFarm("Eduardo", "Tanabi", "SP"),
      pending: null,
      reply: "ok",
    });
    await send("purchase", "Hoje eu comprei 8 gados nelore de 300kg");
    const text = "Coloca nas despesas que eu gasto 6000 com ração mensal";
    const saved = await send("feed", text);
    assert.equal(saved?.persisted, true, saved?.reply);
    assert.match(saved!.reply!, /6.000,00/);
    assert.doesNotMatch(saved!.reply!, /qual foi o valor|painel fazenda/i);
    await send("feed", text);
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.ledger.length, 1);
    assert.equal(book.ledger[0].amountCents, 600000);
    assert.equal(book.ledger[0].description, "ração");
    assert.equal(book.ledger[0].recurrence, "monthly");
    assert.equal(book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});
test("fragmented financial reply asks only missing purpose instead of saving the assistant name", async () => {
  const f = await farmIntegration();
  const send = (id: string, text: string) =>
    handleGuardianMessage(
      { phone, messageId: id, text, sentAt: at.toISOString() },
      {
        store: f.guardian,
        now: at,
        extract: async () => {
          throw Error("must not fall through to AI");
        },
      },
    );
  try {
    await f.guardian.commit({
      phone,
      messageId: "create",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      book: emptyFarm("Eduardo", "Tanabi", "SP"),
      pending: null,
      reply: "ok",
    });
    assert.match((await send("start", "Despesa tpec...."))!.reply!, /Qual foi o valor/);
    assert.match((await send("amount", "6000 R$"))!.reply!, /A que se refere/);
    assert.match((await send("name", "Tpec"))!.reply!, /A que se refere/);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    assert.equal((await send("purpose", "Ração para o gado"))?.persisted, true);
    const row = (await f.guardian.load(phone)).active!.book.ledger[0];
    assert.equal(row.description, "Ração para o gado");
    assert.equal(row.amountCents, 600000);
  } finally {
    await f.db.close();
  }
});
