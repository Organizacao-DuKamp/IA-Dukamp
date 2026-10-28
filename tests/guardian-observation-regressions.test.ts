import assert from "node:assert/strict";
import test from "node:test";
import { automaticFarmEvent } from "../src/lib/guardian/automatic.ts";
import { calculate, renderCalculation } from "../src/lib/guardian/calculators.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import {
  emptyFarm,
  PreferencesSchema,
  type GuardianSnapshot,
  type LedgerEntry,
} from "../src/lib/guardian/schema.ts";
import { emptyOperations, farmIndicators, stockAt } from "../src/lib/guardian/operations.ts";
import { ledgerForTotals } from "../src/lib/guardian/finance.ts";
import { farmReport } from "../src/lib/guardian/book.ts";
import { buildFarmDigest } from "../src/lib/guardian/reports.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const now = new Date("2026-10-27T11:43:00Z"),
  phone = "5517999991111";
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
const noProvider = async () => {
  throw new Error("No extraction provider should be called");
};

test("reported income and expenses are atomic monthly ledger totals with Brazilian monetary units", () => {
  for (const [text, expected] of [
    [
      "A minha fazenda tem uma receita de 100 mil e uma despesa de 80 mil nesse mês, registre isso",
      [10_000_000, 8_000_000],
    ],
    [
      "Registre aí também que as despesas da minha fazenda estão em torno de 40 mil, e as receitas de 60 mil neste mês",
      [4_000_000, 6_000_000],
    ],
    [
      "Minha fazenda teve uma receita de R$ 100.000,50 e uma despesa de R$ 80.000,25 neste mês.",
      [10_000_050, 8_000_025],
    ],
  ] as const) {
    const result = automaticFarmEvent({ text, at: now }, snapshot());
    assert.equal(result.status, "batch", text);
    if (result.status !== "batch") continue;
    assert.deepEqual(
      result.actions.map((a) => a.kind === "ledger" && a.amountCents),
      expected,
    );
    assert.ok(result.actions.every((a) => a.kind === "ledger" && a.periodMonth === "2026-10"));
    if (text.includes("em torno"))
      assert.equal(result.actions[0].kind === "ledger" && result.actions[0].estimated, true);
  }
});

test("financial questions, third parties, plans and incomplete reports cannot become ledger entries or field notes", () => {
  for (const text of [
    "Minha fazenda terá receita de 100 mil neste mês?",
    "Minha fazenda terá receita de 100 mil neste mês",
    "Minha fazenda não teve receita de 100 mil neste mês",
    "Se eu tivesse receita de 100 mil neste mês",
    "Meu vizinho tem receita de 100 mil neste mês",
    "Mensagem encaminhada: Minha fazenda tem receita de 100 mil neste mês",
  ]) {
    assert.equal(automaticFarmEvent({ text, at: now }, snapshot()).status, "none", text);
  }
  for (const text of [
    "Registre aí também que as despesas da minha fazenda estão em torno de 40 mil, e as receitas de 60 mil",
    "Minha receita foi de 100 mil e minha despesa foi alta neste mês",
    "Minha receita é de 100 mil no ano passado",
    "Minha receita foi de 100k neste mês",
    "Minha receita foi de 100 mil no mês de setembro",
    "Minha receita foi de 100 mil neste mês do ano passado",
    "Minha receita foi de 100 mil ontem e minha despesa de 80 mil hoje",
  ]) {
    const result = automaticFarmEvent({ text, at: now }, snapshot());
    assert.equal(result.status, "pending", text);
  }
  const multiple = snapshot();
  multiple.properties.push({ id: "other", name: "Outra", role: "owner" });
  assert.equal(
    automaticFarmEvent({ text: "Minha receita foi de 100 mil neste mês", at: now }, multiple)
      .status,
    "action",
  );
  multiple.active = null;
  assert.deepEqual(
    automaticFarmEvent({ text: "Minha receita foi de 100 mil neste mês", at: now }, multiple),
    { status: "pending", reason: "ambiguous_property" },
  );
});

test("same-day coordinated births, deaths and one explicitly identified calf retain exact quantities and RGN", () => {
  for (const [born, dead, expected] of [
    [4, 2, 82],
    [2, 4, 78],
  ]) {
    const result = automaticFarmEvent(
      {
        text: `Nasceu ${born} bezerros na fazenda hoje, mas hoje também morreu ${dead}\n\nUm dos bezerros já tem código e rgn: KBU 491`,
        at: now,
      },
      snapshot(),
    );
    assert.equal(result.status, "batch");
    if (result.status !== "batch") continue;
    assert.deepEqual(
      result.actions.slice(0, 2).map((a) => a.kind === "herd_event" && [a.type, a.count, a.date]),
      [
        ["birth", born, "2026-10-27"],
        ["death", dead, "2026-10-27"],
      ],
    );
    assert.deepEqual(result.actions[2], {
      kind: "animal",
      code: "KBU 491",
      rgn: "KBU 491",
      category: "bezerro",
      birthDate: "2026-10-27",
    });
    assert.equal(80 + born - dead, expected);
  }
  assert.equal(
    automaticFarmEvent({ text: "Hoje nasceu 4, mas também morreu 2", at: now }, snapshot()).status,
    "none",
  );
  assert.equal(
    automaticFarmEvent(
      { text: "Comprei 10 sacos de ração hoje. Tenho 80 bezerros.", at: now },
      snapshot(),
    ).status,
    "none",
  );
  const identified = automaticFarmEvent(
    { text: "Um dos bezerros já tem código: B491 e RGN: KBU 491", at: now },
    snapshot(),
  );
  assert.equal(identified.status, "action");
  if (identified.status === "action")
    assert.deepEqual(identified.action, {
      kind: "animal",
      code: "B491",
      rgn: "KBU 491",
      category: "bezerro",
    });
});

test("monthly totals replace prior totals in calculations, keep history and do not duplicate included details", () => {
  const source = {
    actor: phone,
    messageId: "source",
    at: now.toISOString(),
    confirmed: true as const,
  };
  const entry = (id: string, amountCents: number, extra = {}): LedgerEntry => ({
    id,
    amountCents,
    direction: "income",
    date: "2026-10-27",
    description: id,
    source,
    ...extra,
  });
  const entries = [
    entry("detail", 10000),
    entry("old", 6000000, { periodMonth: "2026-10" }),
    entry("new", 10000000, { periodMonth: "2026-10" }),
    entry("later", 50000, { date: "2026-10-28" }),
  ];
  assert.deepEqual(
    ledgerForTotals(entries).map((e) => e.id),
    ["new", "later"],
  );
  assert.deepEqual(ledgerForTotals(entries, "2026-10-27", "2026-10-27"), []);
  assert.deepEqual(
    ledgerForTotals(entries, "2026-10-01", "2026-10-27").map((e) => e.id),
    ["new"],
  );
  assert.deepEqual(
    ledgerForTotals(
      [entry("sept", 12300, { periodMonth: "2026-09" })],
      "2026-09-01",
      "2026-09-30",
    ).map((e) => e.id),
    ["sept"],
  );
  assert.equal(entries.length, 4);
});

test("calculation output retains the formula and assumptions without exposing the reference URL", () => {
  const result = calculate({ kind: "gmd", initialKg: 100, finalKg: 450, days: 120 });
  assert.ok(result.reference);
  const rendered = renderCalculation(result);
  assert.match(rendered, /GMD/);
  assert.match(rendered, /peso final/);
  assert.doesNotMatch(rendered, /https?:|Referência da definição|embrapa/i);
});

test("integrated PostgreSQL: natural financial reports reach the ledger, retain estimates, update totals and replay once", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(
      phone,
      "baseline",
      "Minha fazenda fica em Tanabi e tenho 80 cabeças.",
      "2026-10-26T15:00:00Z",
    );
    const deps = { store: f.guardian, now, extract: noProvider };
    for (const [messageId, text] of [
      [
        "first",
        "Registre aí também que as despesas da minha fazenda estão em torno de 40 mil, e as receitas de 60 mil neste mês",
      ],
      [
        "update",
        "A minha fazenda tem uma receita de 100 mil e uma despesa de 80 mil nesse mês, registre isso",
      ],
    ]) {
      const input = { phone, messageId, text };
      const result = await handleGuardianMessage(input, deps);
      assert.equal(result!.persisted, true, result!.reply ?? "");
      assert.match(result!.reply!, /Financeiro:/);
      await handleGuardianMessage(input, deps);
    }
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.ledger.length, 4);
    assert.equal(book.ledger[0].estimated, true);
    assert.equal(book.records.length, 0);
    const totals = farmIndicators(book, "2026-10-01", "2026-10-27").finances;
    assert.deepEqual(
      [totals.incomeCents, totals.expenseCents, totals.balanceCents],
      [10000000, 8000000, 2000000],
    );
    assert.match(
      farmReport(book, { section: "finance", start: "2026-10-01", end: "2026-10-28" }),
      /100\.000,00/,
    );
    assert.match(
      buildFarmDigest(book, { start: "2026-10-01", end: "2026-10-28" }, now.toISOString()),
      /80\.000,00/,
    );
    const denied = await handleGuardianMessage(
      {
        phone,
        messageId: "incomplete",
        text: "Minha fazenda tem receita de 100 mil e despesas neste mês",
      },
      deps,
    );
    assert.match(denied!.reply!, /Qual foi o valor da despesa/);
    const unfinished = (await f.guardian.load(phone)).pending;
    assert.equal(unfinished?.kind, "record_draft");
    if (unfinished?.kind === "record_draft")
      assert.equal(unfinished.entries[0].amountCents, 10000000);
    assert.equal((await f.guardian.load(phone)).active!.book.records.length, 0);
    const recall = await handleGuardianMessage(
      { phone, messageId: "recall", text: "resumo financeiro deste mês" },
      deps,
    );
    assert.deepEqual(
      JSON.parse(recall!.context!.slice(recall!.context!.indexOf("{"))).latestLedger.map(
        (e: LedgerEntry) => e.amountCents,
      ),
      [10000000, 8000000],
    );
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    const deniedRole = await handleGuardianMessage(
      { phone, messageId: "worker-finance", text: "Minha receita foi de 200 mil neste mês" },
      deps,
    );
    assert.match(deniedRole!.reply!, /perfil não permite/);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 4);
  } finally {
    await f.db.close();
  }
});

test("integrated PostgreSQL: a combined herd update and RGN persist atomically and update 80 to 82 without duplicate calves", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(
      phone,
      "baseline",
      "Minha fazenda fica em Tanabi e tenho 80 cabeças.",
      "2026-10-26T15:00:00Z",
    );
    const input = {
      phone,
      messageId: "births",
      text: "Nasceu 4 bezerros na fazenda hoje, mas hoje também morreu 2\nUm dos bezerros já tem código e rgn: KBU 491",
      sentAt: now.toISOString(),
    };
    const deps = { store: f.guardian, now, extract: noProvider };
    const result = await handleGuardianMessage(input, deps);
    assert.equal(result!.persisted, true, result!.reply ?? "");
    assert.match(result!.reply!, /Rebanho calculado após os registros: 82 animais/);
    assert.match(result!.reply!, /RGN informado KBU 491/);
    await handleGuardianMessage(input, deps);
    let book = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 82);
    assert.equal(book.operations!.movements.length, 2);
    assert.equal(book.animals.length, 1);
    assert.equal(book.animals[0].code, "KBU 491");
    assert.equal(book.animals[0].rgn, "KBU 491");
    assert.equal(book.animals[0].source.messageId, "births");
    const failed = await handleGuardianMessage(
      { phone, messageId: "bad", text: "Nasceu 4 bezerros hoje, mas morreu 200" },
      deps,
    );
    assert.equal(failed!.persisted, false);
    book = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 82);
    assert.equal(book.operations!.movements.length, 2);
    const otherPhone = "5517999992222";
    await f.observe(
      otherPhone,
      "other-baseline",
      "Minha fazenda fica em Tanabi e tenho 80 cabeças.",
      "2026-10-26T15:00:00Z",
    );
    const inverse = await handleGuardianMessage(
      {
        phone: otherPhone,
        messageId: "inverse",
        text: "Nasceu 2 bezerros na fazenda hoje, mas hoje também morreu 4\nUm dos bezerros já tem código e rgn: KBU 491",
      },
      deps,
    );
    assert.equal(inverse!.persisted, true);
    assert.equal(
      stockAt((await f.guardian.load(otherPhone)).active!.book.operations!, "2026-10-27").count,
      78,
    );
  } finally {
    await f.db.close();
  }
});
