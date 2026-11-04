import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyFarm,
  FarmBookSchema,
  farmActionFamily,
  type GuardianAction,
  type FarmBook,
} from "../src/lib/guardian/schema.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import {
  managementEntries,
  managementSections,
  managementReport,
  type ManagementSection,
  type ManagementValues,
} from "../src/lib/guardian/management.ts";
import { supplyBalances, supplyLocationBalances } from "../src/lib/guardian/supplies.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { semanticContext } from "../src/lib/guardian/semantic.server.ts";
import { ledgerForTotals } from "../src/lib/guardian/finance.ts";

const phone = "000000000000107",
  now = new Date("2026-11-04T15:00:00Z");
const source = { actor: phone, messageId: "test", at: now.toISOString(), confirmed: true as const };
const empty = () => emptyFarm("Estância Teste", "Monte Aprazível", "SP");
let seq = 0;
function apply(book: FarmBook, a: GuardianAction) {
  return applyFarmAction(
    book,
    a,
    "owner",
    { ...source, messageId: `message-${++seq}` },
    `entry-${seq}`,
  ).book;
}
const examples: Record<ManagementSection, ManagementValues> = {
  pasture: { name: "Piquete Norte", areaHa: 10, capacity: 40 },
  pasture_management: {
    name: "Calagem Norte",
    date: "2026-11-04",
    location: "Piquete Norte",
    method: "Calagem",
  },
  soil_analysis: { name: "Solo Norte", date: "2026-11-04", location: "Piquete Norte", ph: 5.8 },
  health: { name: "Vacinação lote 2", date: "2026-11-04", lot: "2", medicine: "Produto relatado" },
  exam: { name: "Exame vaca 01", date: "2026-11-04", animal: "01", result: "Resultado informado" },
  insemination: { name: "IATF lote 2", date: "2026-11-04", lot: "2", method: "Artificial" },
  pregnancy: {
    name: "Diagnóstico lote 2",
    date: "2026-11-04",
    lot: "2",
    result: "Prenhez informada",
  },
  calving: { name: "Parto vaca 01", date: "2026-11-04", animal: "01" },
  fecal: { name: "Avaliação lote 2", date: "2026-11-04", lot: "2", score: 3 },
  payable: { name: "Ração fornecedor", amountCents: 15000, dueDate: "2026-12-10" },
  receivable: { name: "Venda de gado", amountCents: 90000, dueDate: "2026-12-12" },
  product: { name: "Milho", unit: "kg", minimumQty: 50 },
  storage: { name: "Galpão Norte" },
  formula: { name: "Mistura Teste", ingredients: [{ product: "Milho", quantity: 5, unit: "kg" }] },
  feeding: {
    name: "Trato lote 2",
    date: "2026-11-04",
    formula: "Mistura Teste",
    quantity: 20,
    unit: "kg",
    lot: "2",
  },
  vehicle: { name: "Trator Azul", vehicleType: "Trator", meterHours: 100 },
  maintenance: {
    name: "Revisão trator",
    date: "2026-11-04",
    vehicle: "Trator Azul",
    status: "open",
  },
  vehicle_cost: {
    name: "Seguro trator",
    date: "2026-11-04",
    vehicle: "Trator Azul",
    amountCents: 20000,
  },
  occurrence: { name: "Cerca rompida", date: "2026-11-04", status: "open", severity: "medium" },
  round: { name: "Ronda manhã", date: "2026-11-04", notes: "Cerca conferida" },
};
for (const section of Object.keys(managementSections) as ManagementSection[])
  test(`${section}: create, partial edit, audit removal, validation and permissions`, () => {
    let b = apply(empty(), { kind: "animal", code: "01", sex: "female" });
    for (const dependency of ["formula", "vehicle"] as const)
      if (section !== dependency)
        b = apply(b, {
          kind: "management_save",
          section: dependency,
          values: examples[dependency],
        });
    const before = structuredClone(b);
    b = apply(b, { kind: "management_save", section, values: examples[section] });
    const row = managementEntries(b, section)[0];
    assert.ok(row);
    assert.equal(b.ledger.length, 0);
    assert.equal(b.operations?.movements.length ?? 0, 0);
    assert.ok(FarmBookSchema.safeParse(b).success);
    const edited = apply(b, {
      kind: "management_save",
      section,
      reference: row.values.name,
      values: { notes: "Corrigido pelo produtor" },
    });
    assert.equal(managementEntries(edited, section)[0].values.name, row.values.name);
    assert.equal(managementEntries(edited, section)[0].revisions.length, 1);
    assert.equal(managementEntries(edited, section)[0].source.messageId, row.source.messageId);
    const removed = apply(edited, {
      kind: "management_remove",
      section,
      reference: row.id,
      reason: "Registro incorreto",
    });
    assert.equal(managementEntries(removed, section).length, 0);
    assert.ok(removed.management!.entries.find((e) => e.id === row.id)!.removed);
    assert.ok(FarmBookSchema.safeParse(removed).success);
    assert.deepEqual(before.management?.entries.filter((e) => e.section === section) ?? [], []);
    assert.throws(
      () =>
        apply(b, {
          kind: "management_save",
          section,
          reference: "Outra fazenda",
          values: { notes: "não" },
        }),
      /Não encontrei/,
    );
    assert.throws(
      () =>
        applyFarmAction(
          b,
          { kind: "management_remove", section, reference: row.id, reason: "teste" },
          "worker",
          source,
          "denied",
        ),
      /perfil/,
    );
  });
test("accounts settle once, projected amounts stay separate, archive preserves actual cash", () => {
  let b = apply(empty(), { kind: "management_save", section: "payable", values: examples.payable });
  assert.equal(ledgerForTotals(b.ledger).length, 0);
  const row = managementEntries(b, "payable")[0];
  b = apply(b, {
    kind: "management_settle",
    section: "payable",
    reference: row.id,
    date: "2026-11-04",
  });
  assert.equal(b.ledger.length, 1);
  assert.equal(b.ledger[0].amountCents, 15000);
  assert.equal(b.ledger[0].direction, "expense");
  assert.throws(
    () =>
      apply(b, {
        kind: "management_settle",
        section: "payable",
        reference: row.id,
        date: "2026-11-04",
      }),
    /quitada/,
  );
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "payable",
        reference: row.id,
        values: { amountCents: 17000 },
      }),
    /quitada/,
  );
  b = apply(b, {
    kind: "management_remove",
    section: "payable",
    reference: row.id,
    reason: "Arquivar conta paga",
  });
  assert.equal(ledgerForTotals(b.ledger).length, 1);
  let c = apply(empty(), {
    kind: "management_save",
    section: "receivable",
    values: examples.receivable,
  });
  c = apply(c, {
    kind: "management_settle",
    section: "receivable",
    reference: examples.receivable.name!,
    date: "2026-11-04",
  });
  assert.equal(c.ledger[0].direction, "income");
});
test("ambiguous names, missing requirements, unrelated fields, nonexistent references and future events reject atomically", () => {
  let b = apply(empty(), {
    kind: "management_save",
    section: "exam",
    values: { name: "Exame", date: "2026-11-03" },
  });
  b = apply(b, {
    kind: "management_save",
    section: "exam",
    values: { name: "Exame", date: "2026-11-04" },
  });
  assert.throws(
    () =>
      apply(b, { kind: "management_remove", section: "exam", reference: "Exame", reason: "Teste" }),
    /mesmo nome/,
  );
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "health",
        values: { name: "Vacina", date: "2026-11-04" },
      }),
    /Falta informar/,
  );
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "health",
        values: { ...examples.health, plate: "ABC1234" },
      }),
    /não pertence/,
  );
  assert.throws(
    () => apply(b, { kind: "management_save", section: "feeding", values: examples.feeding }),
    /Não encontrei/,
  );
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "exam",
        values: { name: "Exame amanhã", date: "2026-11-05" },
      }),
    /futura/,
  );
  assert.throws(
    () =>
      prepareFarmBatch({
        book: b,
        actions: [
          { kind: "management_save", section: "round", values: examples.round },
          { kind: "management_save", section: "health", values: { name: "Incompleto" } },
        ],
        role: "owner",
        propertyId: "test",
        source,
        executedByMessageId: "bad",
      }),
    /Falta informar/,
  );
  assert.equal(managementEntries(b, "round").length, 0);
});
test("completed maintenance updates real vehicle readings without reducing them", () => {
  let b = apply(empty(), { kind: "management_save", section: "vehicle", values: examples.vehicle });
  b = apply(b, {
    kind: "management_save",
    section: "maintenance",
    values: { ...examples.maintenance, status: "done", meterHours: 150, nextDate: "2026-12-04" },
  });
  const vehicle = managementEntries(b, "vehicle")[0];
  assert.equal(vehicle.values.meterHours, 150);
  assert.equal(vehicle.values.nextDate, "2026-12-04");
  assert.equal(vehicle.revisions.length, 1);
});
test("stock by location: transfer conserves total, cancellation is paired and retroactive corrections cannot create negative stock", () => {
  let b = empty();
  for (const [location, quantity] of [
    ["A", 100],
    ["B", 0],
  ] as const)
    b = apply(b, {
      kind: "supply_movement",
      item: "Milho",
      unit: "kg",
      type: "balance",
      quantity,
      location,
      date: "2026-11-01",
    });
  b = apply(b, {
    kind: "supply_transfer",
    item: "Milho",
    unit: "kg",
    quantity: 30,
    from: "A",
    to: "B",
    date: "2026-11-02",
  });
  assert.equal(supplyBalances(b)[0].quantity, 100);
  assert.deepEqual(
    supplyLocationBalances(b).map((r) => r.quantity),
    [70, 30],
  );
  const transfer = b.supplies!.movements.find((m) => m.transferId)!;
  assert.throws(
    () =>
      apply(b, {
        kind: "supply_transfer",
        item: "Milho",
        unit: "kg",
        quantity: 80,
        from: "A",
        to: "B",
        date: "2026-11-03",
      }),
    /negativo/,
  );
  const corrected = apply(b, {
    kind: "supply_edit",
    id: b.supplies!.movements[0].id,
    quantity: 110,
    date: "2026-11-01",
  });
  assert.equal(supplyBalances(corrected)[0].quantity, 110);
  b = apply(b, { kind: "supply_void", id: transfer.id, reason: "Transferência cancelada" });
  assert.deepEqual(
    supplyLocationBalances(b).map((r) => r.quantity),
    [100, 0],
  );
  assert.equal(b.supplies!.movements.filter((m) => m.voided).length, 2);
  b = apply(b, {
    kind: "supply_movement",
    item: "Milho",
    unit: "kg",
    type: "out",
    quantity: 90,
    location: "A",
    date: "2026-11-03",
  });
  assert.throws(
    () =>
      apply(b, {
        kind: "supply_edit",
        id: b.supplies!.movements[0].id,
        quantity: 80,
        date: "2026-11-01",
      }),
    /negativo/,
  );
  assert.ok(FarmBookSchema.safeParse(b).success);
});
test("WhatsApp create/edit/query/remove and payment persist through real RPCs, with replay and property isolation", async () => {
  const f = await farmIntegration();
  try {
    const propertyId = randomUUID();
    await f.guardian.commit({
      phone,
      messageId: "create-management-farm",
      accountVersion: 0,
      propertyId,
      propertyVersion: null,
      operation: "create",
      book: empty(),
      pending: null,
      reply: "Criada",
    });
    async function turn(messageId: string, text: string, action?: GuardianAction, inspect = false) {
      return handleGuardianMessage(
        { phone, messageId, text },
        {
          store: f.guardian,
          now,
          interpret: async (c) => ({
            intent: inspect ? "inspect" : "apply",
            propertyId: c.propertyId,
            question: "",
            ...(inspect ? { inspection: { kind: "management", section: "payable" } } : {}),
            entries: action
              ? [{ action, evidence: [{ messageIndex: c.messages.length - 1, quote: text }] }]
              : [],
          }),
        },
      );
    }
    let result = await turn(
      "save-account",
      "Tenho 150 reais de ração para pagar em 10 de dezembro, registre",
      { kind: "management_save", section: "payable", values: examples.payable },
    );
    assert.equal(result!.persisted, true);
    let snapshot = await f.guardian.load(phone);
    const row = managementEntries(snapshot.active!.book, "payable")[0];
    assert.ok(row);
    await turn("edit-account", "Na conta da ração troque o fornecedor para Casa Rural", {
      kind: "management_save",
      section: "payable",
      reference: row.id,
      values: { counterparty: "Casa Rural" },
    });
    result = await turn("query-account", "Quais contas tenho a pagar?", undefined, true);
    assert.match(result!.reply!, /Casa Rural/);
    await turn("settle-account", "Já paguei hoje aquela conta da ração", {
      kind: "management_settle",
      section: "payable",
      reference: row.id,
      date: "2026-11-04",
    });
    await turn("settle-account", "Já paguei hoje aquela conta da ração", {
      kind: "management_settle",
      section: "payable",
      reference: row.id,
      date: "2026-11-04",
    });
    snapshot = await f.guardian.load(phone);
    assert.equal(snapshot.active!.book.ledger.length, 1);
    await turn("remove-account", "Pode remover essa conta da lista", {
      kind: "management_remove",
      section: "payable",
      reference: row.id,
      reason: "Solicitado pelo produtor",
    });
    snapshot = await f.guardian.load(phone);
    assert.equal(managementEntries(snapshot.active!.book, "payable").length, 0);
    assert.equal(snapshot.active!.book.ledger.length, 1);
    const audit = await f.db.query("select * from guardian_audit where property_id=$1", [
      propertyId,
    ]);
    assert.ok(audit.rows.length >= 4);
    const ctx = semanticContext(
      { phone, messageId: "context", text: "Consulte os registros" },
      snapshot,
      now,
    );
    assert.ok(ctx.snapshot.active!.book.management);
    assert.match(managementReport(snapshot.active!.book), /Nenhum/);
    assert.ok(FarmBookSchema.safeParse(snapshot.active!.book).success);
    assert.equal(
      farmActionFamily({
        kind: "management_remove",
        section: "round",
        reference: "id",
        reason: "teste",
      }),
      "ledger",
    );
  } finally {
    await f.db.close();
  }
});

test("reversing settlement preserves ledger audit and allows correction and a single new settlement", () => {
  let b = apply(empty(), { kind: "management_save", section: "payable", values: examples.payable });
  const row = managementEntries(b, "payable")[0];
  b = apply(b, {
    kind: "management_settle",
    section: "payable",
    reference: row.id,
    date: "2026-11-04",
  });
  b = apply(b, {
    kind: "management_unsettle",
    section: "payable",
    reference: row.id,
    reason: "Pagamento informado por engano",
  });
  assert.equal(ledgerForTotals(b.ledger).length, 0);
  assert.equal(b.management!.entries[0].settlementHistory!.length, 1);
  b = apply(b, {
    kind: "management_save",
    section: "payable",
    reference: row.id,
    values: { amountCents: 17000 },
  });
  b = apply(b, {
    kind: "management_settle",
    section: "payable",
    reference: row.id,
    date: "2026-11-04",
  });
  assert.equal(ledgerForTotals(b.ledger).length, 1);
  assert.equal(ledgerForTotals(b.ledger)[0].amountCents, 17000);
  assert.equal(b.ledger.length, 2);
  assert.ok(FarmBookSchema.safeParse(b).success);
});
test("optional fields can be cleared, required fields and invalid statuses cannot", () => {
  let b = apply(empty(), {
    kind: "management_save",
    section: "vehicle",
    values: { ...examples.vehicle, notes: "Antigo" },
  });
  const row = managementEntries(b, "vehicle")[0];
  b = apply(b, {
    kind: "management_save",
    section: "vehicle",
    reference: row.id,
    values: {},
    clear: ["notes"],
  });
  assert.equal(managementEntries(b, "vehicle")[0].values.notes, undefined);
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "vehicle",
        reference: row.id,
        values: {},
        clear: ["name"],
      }),
    /Falta informar/,
  );
  assert.throws(
    () =>
      apply(b, {
        kind: "management_save",
        section: "vehicle",
        reference: row.id,
        values: { status: "open" },
      }),
    /Situação inválida/,
  );
});
