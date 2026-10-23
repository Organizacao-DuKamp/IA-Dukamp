import assert from "node:assert/strict";
import test from "node:test";
import { calculate, CalculationInput } from "../src/lib/guardian/calculators.ts";
import { parseCalculation } from "../src/lib/guardian/calculation-intent.ts";
import {
  PreferencesSchema,
  emptyFarm,
  canEdit,
  type GuardianSnapshot,
  type GuardianAction,
} from "../src/lib/guardian/schema.ts";
import { applyFarmAction, farmReport } from "../src/lib/guardian/book.ts";
import { parseDueDate, parseGuardianRequest, brazilNumber } from "../src/lib/guardian/parse.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";
import { buildFarmDigest, reportPeriod, reportEvent } from "../src/lib/guardian/reports.ts";
import { mapSnapshot } from "../src/lib/guardian/store.server.ts";

const now = new Date("2026-10-23T15:00:00Z");
const prefs = PreferencesSchema.parse({}),
  farm = emptyFarm("Boa Vista", "Monte Aprazível", "SP");
const snapshot: GuardianSnapshot = {
  accountVersion: 0,
  properties: [],
  preferences: prefs,
  pending: null,
  active: { id: "00000000-0000-4000-8000-000000000001", version: 0, role: "owner", book: farm },
};
const source = {
  actor: "5517999991111",
  messageId: "one",
  at: now.toISOString(),
  confirmed: true as const,
};
test("calculators use explicit units and deterministic formulas", () => {
  assert.equal(calculate({ kind: "gmd", initialKg: 350, finalKg: 450, days: 100 }).values.gmd, 1);
  assert.equal(calculate({ kind: "gmd", initialKg: 450, finalKg: 440, days: 10 }).values.gmd, -1);
  assert.deepEqual(
    calculate({
      kind: "dry_matter",
      liveWeightKg: 400,
      intakePercent: 2.5,
      feedDryMatterPercent: 40,
    }).values,
    { dryMatter: 10, asFed: 25 },
  );
  assert.deepEqual(
    calculate({ kind: "feeding", heads: 100, kgPerHeadDay: 2, days: 30, pricePerKg: 3 }).values,
    { totalFeedKg: 6000, totalCost: 18000, costPerHead: 180 },
  );
  assert.equal(
    calculate({ kind: "conversion", consumedDryMatterKg: 700, gainedLiveKg: 100 }).values
      .conversion,
    7,
  );
  assert.equal(
    calculate({ kind: "cost_per_kg", totalCost: 2100, gainedLiveKg: 700 }).values.costPerKg,
    3,
  );
  assert.equal(
    calculate({ kind: "cost_per_head", totalCost: 1000, heads: 50 }).values.costPerHead,
    20,
  );
  assert.equal(
    calculate({ kind: "margin", revenue: 0, recordedExpenses: 100, completeCosts: false }).values
      .marginPercent,
    null,
  );
  const scenario = calculate({
    kind: "scenario",
    heads: 100,
    saleKgPerHead: 500,
    pricePerKg: 10,
    totalCost: 400000,
    priceChangePercent: -10,
  });
  assert.equal(scenario.values.baseResult, 100000);
  assert.equal(scenario.values.scenarioResult, 50000);
  assert.equal(scenario.values.breakEvenPrice, 8);
});
for (const [name, input] of Object.entries({
  zeroDays: { kind: "gmd", initialKg: 300, finalKg: 400, days: 0 },
  badWeight: { kind: "gmd", initialKg: 3000, finalKg: 400, days: 10 },
  nan: { kind: "feeding", heads: NaN, kgPerHeadDay: 2, days: 30, pricePerKg: 1 },
  zeroGain: { kind: "conversion", consumedDryMatterKg: 10, gainedLiveKg: 0 },
  negativeConversion: { kind: "conversion", consumedDryMatterKg: 10, gainedLiveKg: -2 },
  badPercentage: {
    kind: "dry_matter",
    liveWeightKg: 300,
    intakePercent: 5,
    feedDryMatterPercent: 101,
  },
  fractionalHeads: { kind: "cost_per_head", totalCost: 1000, heads: 1.5 },
  unknownUnit: {
    kind: "feeding",
    heads: 5,
    kgPerHeadDay: 2,
    days: 10,
    pricePerKg: 1,
    unit: "arroba",
  },
}))
  test(`calculator rejects ${name}`, () =>
    assert.equal(CalculationInput.safeParse(input).success, false));
test("calculation grammar preserves context only for a supported referent", () => {
  assert.deepEqual(parseCalculation("GMD de 350 kg para 450 kg em 100 dias"), {
    kind: "gmd",
    initialKg: 350,
    finalKg: 450,
    days: 100,
  });
  const initial = parseCalculation(
    "Simular alimentação: 100 animais, 2 kg/cabeça/dia, 30 dias, R$ 3/kg",
  )!;
  assert.equal(initial.kind, "feeding");
  const next = parseCalculation("faz o mesmo para 50", initial)!;
  assert.equal(next.kind, "feeding");
  assert.equal(calculate(next).values.totalCost, 9000);
  assert.equal(parseCalculation("faz o mesmo para 50"), null);
  assert.equal(parseCalculation("GMD 350 kg para 450 kg em 100 dias e recomende uma dieta"), null);
});
test("future dates use local calendars and refuse invalid dates rather than normalizing them", () => {
  assert.equal(parseDueDate("na sexta às 8h", now), "2026-10-30T11:00:00.000Z");
  assert.equal(parseDueDate("amanhã às 14h30", now), "2026-10-24T17:30:00.000Z");
  assert.equal(parseDueDate("dia 31/02/2027 às 8h", now), null);
  assert.equal(parseDueDate("2026-99-99", now), null);
  assert.equal(parseDueDate("amanhã às 24h", now), null);
  assert.equal(parseDueDate("hoje às 8h", now), null);
  assert.equal(
    parseDueDate("amanhã às 8h", new Date("2026-10-24T01:00:00Z")),
    "2026-10-24T11:00:00.000Z",
  );
});
test("Brazilian monetary inputs and consent cannot be invented from technical topics", () => {
  assert.equal(brazilNumber("1.250,55"), 1250.55);
  assert.ok(Number.isNaN(brazilNumber("1,2,3")));
  assert.equal(prefs.enabled, false);
  assert.equal(prefs.consentAt, null);
  assert.equal(parseGuardianRequest("não quero ativar avisos", snapshot, now)?.kind, "extract");
  assert.deepEqual(parseGuardianRequest("Quero reativar o acompanhamento", snapshot, now), {
    kind: "preferences",
    enabled: true,
  });
  assert.deepEqual(parseGuardianRequest("Pode parar o acompanhamento pra mim", snapshot, now), {
    kind: "preferences",
    enabled: false,
  });
  assert.deepEqual(parseGuardianRequest("STOP", snapshot, now), {
    kind: "preferences",
    enabled: false,
  });
  assert.notDeepEqual(parseGuardianRequest("como ativar avisos?", snapshot, now), {
    kind: "preferences",
    enabled: true,
  });
});
test("staff permissions do not include finance, access revocation or deletion", () => {
  assert.equal(
    canEdit("worker", {
      kind: "ledger",
      direction: "expense",
      amountCents: 100,
      date: "2026-10-23",
      description: "Ração",
    }),
    false,
  );
  assert.equal(canEdit("technician", { kind: "property_delete", name: "Boa Vista" }), false);
  assert.equal(canEdit("manager", { kind: "revoke", phone: "5517999992222" }), false);
  assert.equal(
    canEdit("worker", {
      kind: "weighing",
      code: "10",
      date: "2026-10-23",
      weightKg: 450,
      estimated: false,
      correction: false,
    }),
    true,
  );
});
test("corrections preserve old values, origin and dates; estimates are excluded from GMD", () => {
  let b = applyFarmAction(
    farm,
    { kind: "animal", code: "10", sex: "female", lot: "2" },
    "owner",
    source,
    "animal",
  ).book;
  b = applyFarmAction(
    b,
    {
      kind: "weighing",
      code: "10",
      weightKg: 350,
      date: "2026-10-01",
      estimated: false,
      correction: false,
    },
    "owner",
    source,
    "weight",
  ).book;
  b = applyFarmAction(
    b,
    {
      kind: "weighing",
      code: "10",
      weightKg: 400,
      date: "2026-10-23",
      estimated: true,
      correction: false,
    },
    "owner",
    source,
    "weight2",
  ).book;
  assert.doesNotMatch(farmReport(b), /Maior ganho/);
  b = applyFarmAction(
    b,
    {
      kind: "weighing",
      code: "10",
      weightKg: 450,
      date: "2026-10-23",
      estimated: false,
      correction: true,
    },
    "owner",
    { ...source, messageId: "correction" },
    "weight3",
  ).book;
  assert.equal(b.animals[0].weights[1].corrections[0].previousSource?.messageId, "one");
  assert.match(farmReport(b), /GMD 4,545/);
  assert.throws(
    () =>
      applyFarmAction(
        b,
        {
          kind: "weighing",
          code: "10",
          weightKg: 460,
          date: "2026-10-23",
          estimated: false,
          correction: false,
        },
        "owner",
        source,
        "bad",
      ),
    /Já há uma pesagem/,
  );
});
test("short correction edits a reviewable proposal without claiming a persistent mutation", () => {
  const pending = {
    action: {
      kind: "weighing",
      code: "10",
      weightKg: 350,
      date: "2026-10-23",
      estimated: false,
      correction: false,
    } as GuardianAction,
    propertyId: snapshot.active!.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60000).toISOString(),
    sourceMessageId: "first",
  };
  const result = parseGuardianRequest("Era 450 kg, não 350 kg", { ...snapshot, pending }, now);
  assert.equal(result?.kind, "action");
  if (result?.kind === "action" && result.action.kind === "weighing")
    assert.equal(result.action.weightKg, 450);
  assert.equal(pending.action.kind === "weighing" && pending.action.weightKg, 350);
});
test("task changes only emit evidence for the new version and terminal tasks do not re-emit", () => {
  const first = applyFarmAction(
    farm,
    { kind: "task_create", title: "Pesar lote 2", dueAt: "2026-10-24T11:00:00Z" },
    "owner",
    source,
    "T1",
  );
  assert.equal(first.events.length, 1);
  const done = applyFarmAction(
    first.book,
    { kind: "task_update", task: "T1", status: "done" },
    "owner",
    source,
    "T2",
  );
  assert.equal(done.events.length, 0);
  assert.match(done.result, /novos pesos/);
  assert.throws(
    () =>
      applyFarmAction(
        done.book,
        { kind: "task_update", task: "T1", dueAt: "2026-10-25T11:00:00Z" },
        "owner",
        source,
        "T3",
      ),
    /encerrada/,
  );
});
test("CSV formula injection is escaped and reporting does not claim net profit", () => {
  const b = applyFarmAction(
    farm,
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 15050,
      date: "2026-10-23",
      description: '=HYPERLINK("bad")',
    },
    "owner",
    source,
    "L1",
  ).book;
  assert.match(farmCsv(b), /'=HYPERLINK/);
  assert.match(farmCsv(b), /150,50/);
  assert.match(farmReport(b), /não lucro líquido/);
  assert.throws(() =>
    mapSnapshot({
      ...snapshot,
      active: { ...snapshot.active!, book: { ...b, ledger: [{ amountCents: -5 }] } },
    }),
  );
});
test("reports respect local periods, cadence and explicit optional configuration", () => {
  assert.equal(reportPeriod(prefs, now), null);
  const weekly = PreferencesSchema.parse({ ...prefs, reportCadence: "weekly" });
  assert.deepEqual(reportPeriod(weekly, now), {
    start: "2026-10-12",
    end: "2026-10-19",
    due: "2026-10-19T11:00:00.000Z",
  });
  const monthly = PreferencesSchema.parse({ ...prefs, reportCadence: "monthly" });
  assert.equal(reportPeriod(monthly, new Date("2026-01-05T15:00:00Z"))!.start, "2025-12-01");
  assert.equal(
    reportPeriod(
      PreferencesSchema.parse({ ...prefs, reportCadence: "daily" }),
      new Date("2026-10-23T09:00:00Z"),
    ),
    null,
  );
  assert.match(
    buildFarmDigest(farm, { start: "2026-10-01", end: "2026-10-23" }, now.toISOString()),
    /sem registros não significa ausência/,
  );
  assert.equal(
    reportEvent(farm, weekly, source.actor, now)!.key,
    reportEvent(farm, weekly, source.actor, new Date(now.getTime() + 3600000))!.key,
  );
});
