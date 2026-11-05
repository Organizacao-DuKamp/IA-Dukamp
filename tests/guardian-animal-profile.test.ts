import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ActionSchema, FarmBookSchema, emptyFarm } from "../src/lib/guardian/schema.ts";
import {
  animalActionFromForm,
  animalFormValues,
  animalFieldLabels,
} from "../src/lib/guardian/animal-profile.ts";
import { applyFarmAction, describeAction } from "../src/lib/guardian/book.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const source = {
  actor: "000000000000088",
  at: "2026-11-05T15:00:00Z",
  messageId: "synthetic-profile",
  confirmed: true as const,
};
const full = {
  kind: "animal" as const,
  code: "QA-01",
  name: "Animal de teste",
  birthDate: "2025-01-01",
  earTag: "001",
  electronicTag: "982000123456789",
  registry: "QAZZ 100",
  registrySeries: "QAZZ",
  rgn: "100",
  rgd: "54321",
  breed: "Nelore",
  coat: "Branca",
  category: "PO",
  documentOwner: "Proprietário do documento",
  documentFarm: "Fazenda do documento",
  documentMunicipality: "Município do documento",
  documentState: "SP",
  documentBreeder: "Criador do documento",
  documentSource: "PDF ABCZ",
  sex: "female" as const,
  status: "active" as const,
  lot: "Lote 2",
  responsible: "Responsável fictício",
  pasture: "Pasto Norte",
  pen: "Curral 1",
  origin: "Compra",
  destination: "Cria",
  entryDate: "2025-02-01",
  weaningDate: "2025-08-01",
  entryWeightKg: 180.5,
  currentWeightKg: 350.25,
  dailyIntakeKg: 12.5,
  purchasePriceCents: 500000,
  salePriceCents: 700000,
  seller: "Fornecedor fictício",
  carcassPercent: 55.5,
  kinship: "Biológico",
  sire: "TEST 1",
  dam: "TEST 2",
  notes: "Informação sintética de conferência.",
  pedigree: [
    { relation: "sire", code: "TEST 1" },
    { relation: "dam", code: "TEST 2" },
  ],
};
test("every requested field survives schema, book persistence and a non-destructive partial update", () => {
  const parsed = ActionSchema.parse(full);
  const saved = applyFarmAction(
    emptyFarm("Fazenda QA", "Tanabi", "SP"),
    parsed,
    "owner",
    source,
    "animal",
  );
  FarmBookSchema.parse(saved.book);
  const animal = saved.book.animals[0];
  for (const [key, value] of Object.entries(full))
    if (key !== "kind") assert.deepEqual(animal[key as keyof typeof animal], value, key);
  assert.equal(animal.weights.length, 1);
  assert.equal(animal.weights[0].weightKg, 350.25);
  assert.deepEqual(saved.book.ledger, [], "profile prices do not fabricate payments");
  assert.equal(
    saved.book.operations?.movements.length ?? 0,
    0,
    "an individual card does not fabricate a herd entry",
  );
  const edited = applyFarmAction(
    saved.book,
    { kind: "animal", code: "QA-01", notes: "Observação corrigida" },
    "owner",
    source,
    "edit",
  ).book;
  assert.equal(edited.animals[0].earTag, "001");
  assert.equal(edited.animals[0].notes, "Observação corrigida");
  assert.equal(edited.animals[0].weights.length, 1);
  const review = describeAction(parsed);
  for (const key of Object.keys(full))
    if (!["kind", "code"].includes(key))
      assert.ok(review.includes(animalFieldLabels[key as keyof typeof animalFieldLabels]), key);
  const csv = farmCsv(edited);
  assert.match(csv, /Brinco eletrônico: 982000123456789/);
  assert.match(csv, /Pessoa que vendeu: Fornecedor fictício/);
  assert.match(csv, /Genealogia/);
});
test("form preserves cents, decimal values, explicit zero and ancestry while dropping blank fields", () => {
  const values = animalFormValues(full);
  assert.equal(values.purchasePriceCents, "5000");
  assert.deepEqual(animalActionFromForm(values), full);
  const result = animalActionFromForm({
    code: "QA-02",
    purchasePriceCents: "0",
    salePriceCents: "70,35",
    dailyIntakeKg: "0",
    entryWeightKg: "180,5",
    responsible: "",
  });
  assert.equal(result.salePriceCents, 7035);
  assert.equal(result.purchasePriceCents, 0);
  assert.equal(result.dailyIntakeKg, 0);
  assert.equal(result.entryWeightKg, 180.5);
  assert.ok(!("responsible" in result));
  const changed = animalActionFromForm({ ...values, sire: "OUTRO 1" });
  assert.deepEqual(changed.pedigree, [{ relation: "dam", code: "TEST 2" }]);
});
test("current weight edits preserve correction history, and repeated profile saves never duplicate a weighing", () => {
  let book = applyFarmAction(
    emptyFarm("QA", "Tanabi", "SP"),
    ActionSchema.parse(full),
    "owner",
    source,
    "first",
  ).book;
  book = applyFarmAction(
    book,
    ActionSchema.parse({ ...full, name: "Nome atualizado" }),
    "owner",
    source,
    "same",
  ).book;
  assert.equal(book.animals[0].weights.length, 1);
  assert.equal(book.animals[0].weights[0].corrections.length, 0);
  book = applyFarmAction(
    book,
    { kind: "animal", code: "QA-01", currentWeightKg: 360 },
    "owner",
    { ...source, messageId: "correction" },
    "correction",
  ).book;
  assert.equal(book.animals[0].weights.length, 1);
  assert.equal(book.animals[0].weights[0].weightKg, 360);
  assert.equal(book.animals[0].weights[0].corrections[0].weightKg, 350.25);
  book = applyFarmAction(
    book,
    { kind: "weighing", code: "QA-01", date: "2026-11-04", weightKg: 355, estimated: false },
    "owner",
    source,
    "historical",
  ).book;
  assert.equal(book.animals[0].currentWeightKg, 360);
});
test("explicitly clearing optional form fields removes their old values after review without deleting weights or protected identity", () => {
  const book = applyFarmAction(
    emptyFarm("QA", "Tanabi", "SP"),
    ActionSchema.parse(full),
    "owner",
    source,
    "create",
  ).book;
  const action = animalActionFromForm({
    code: "QA-01",
    notes: "",
    electronicTag: "",
    purchasePriceCents: "",
    currentWeightKg: "",
  });
  assert.deepEqual(action.clear, ["electronicTag", "purchasePriceCents", "notes"]);
  assert.match(
    describeAction(action),
    /limpar os campos: Brinco eletrônico, Valor de compra, Observações/,
  );
  const updated = applyFarmAction(book, action, "owner", source, "clear").book;
  assert.ok(!("notes" in updated.animals[0]));
  assert.ok(!("electronicTag" in updated.animals[0]));
  assert.ok(!("purchasePriceCents" in updated.animals[0]));
  assert.equal(updated.animals[0].earTag, "001");
  assert.deepEqual(updated.animals[0].weights, book.animals[0].weights);
  for (const field of ["code", "weights", "source", "sex", "currentWeightKg"])
    assert.equal(
      ActionSchema.safeParse({ kind: "animal", code: "QA-01", clear: [field] }).success,
      false,
    );
  assert.throws(
    () =>
      applyFarmAction(
        book,
        ActionSchema.parse({ kind: "animal", code: "QA-01", clear: ["name"], name: "Novo" }),
        "owner",
        source,
        "ambiguous-clear",
      ),
    /limpar e preencher/,
  );
});
test("invalid dates, percentages, unknown fields and negative money fail without mutating the original book", () => {
  for (const input of [
    { ...full, carcassPercent: 101 },
    { ...full, purchasePriceCents: -1 },
    { ...full, currentWeightKg: 0 },
    { ...full, currentWeightKg: 2001 },
    { ...full, weaningDate: "2025-02-30" },
    { ...full, propertyId: "outside" },
  ])
    assert.equal(ActionSchema.safeParse(input).success, false);
  const book = emptyFarm("QA", "Tanabi", "SP");
  for (const input of [
    { ...full, birthDate: "2027-01-01" },
    { ...full, weaningDate: "2024-01-01" },
    { ...full, entryDate: "2027-01-01" },
  ])
    assert.throws(() => applyFarmAction(book, ActionSchema.parse(input), "owner", source, "bad"));
  assert.deepEqual(book.animals, []);
  const saved = applyFarmAction(book, ActionSchema.parse(full), "owner", source, "valid").book;
  assert.throws(
    () =>
      applyFarmAction(
        saved,
        { kind: "animal", code: "QA-01", weaningDate: "2024-12-01" },
        "owner",
        source,
        "invalid-partial",
      ),
    /anterior ao nascimento/,
  );
  assert.equal(ActionSchema.safeParse({ kind: "animal", code: "legacy" }).success, true);
  assert.equal(
    FarmBookSchema.safeParse({
      ...book,
      animals: [{ code: "old", sex: "unknown", weights: [], source }],
    }).success,
    true,
  );
});
test("PostgreSQL commit and reload keep the complete animal card with the existing JSON book contract", async () => {
  const fixture = await farmIntegration();
  try {
    const book = applyFarmAction(
      emptyFarm("Fazenda QA", "Tanabi", "SP"),
      ActionSchema.parse(full),
      "owner",
      source,
      "save",
    ).book;
    await fixture.guardian.commit({
      phone: source.actor,
      messageId: "full-card",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      book,
      pending: null,
      reply: "Ficha sintética salva",
    });
    const restored = (await fixture.guardian.load(source.actor)).active!.book;
    FarmBookSchema.parse(restored);
    assert.deepEqual(restored.animals, book.animals);
  } finally {
    await fixture.db.close();
  }
});
