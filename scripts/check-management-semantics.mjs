// Synthetic conversation evaluation: real configured model, no customer data or messages sent.
import assert from "node:assert/strict";
import { emptyFarm, PreferencesSchema } from "../src/lib/guardian/schema.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import {
  interpretFarmConversation,
  semanticContext,
  groundSemanticEvidence,
} from "../src/lib/guardian/semantic.server.ts";
for (const k of Object.keys(process.env))
  if (/^(SUPABASE|VITE_SUPABASE|WHATSAPP_|DUKAMP_|LOVABLE_)/.test(k)) delete process.env[k];
const now = new Date("2026-11-04T15:00:00Z"),
  phone = "000000000000087",
  propertyId = "synthetic-management";
let book = emptyFarm("Fazenda QA Ipê", "Tanabi", "SP");
book = prepareFarmBatch({
  book,
  propertyId,
  role: "owner",
  source: { actor: phone, messageId: "seed", at: now.toISOString(), confirmed: true },
  executedByMessageId: "seed",
  actions: [
    {
      kind: "management_save",
      section: "vehicle",
      values: { name: "Trator Azul", vehicleType: "Trator" },
    },
    {
      kind: "management_save",
      section: "payable",
      values: { name: "Ração Casa Rural", amountCents: 15000, dueDate: "2026-11-10" },
    },
    {
      kind: "management_save",
      section: "occurrence",
      values: { name: "Cerca do pasto Norte", date: "2026-11-04", status: "open" },
    },
    {
      kind: "supply_movement",
      item: "Milho",
      unit: "kg",
      type: "balance",
      quantity: 100,
      location: "Galpão A",
      date: "2026-11-04",
    },
    {
      kind: "supply_movement",
      item: "Milho",
      unit: "kg",
      type: "balance",
      quantity: 0,
      location: "Galpão B",
      date: "2026-11-04",
    },
  ],
}).book;
const snapshot = {
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  properties: [{ id: propertyId, name: book.name, role: "owner" }],
  active: { id: propertyId, version: 1, role: "owner", book },
};
const cases = [
  [
    "natural-health",
    "Hoje apliquei a vacina Produto Teste no lote 2. Anote a aplicação no painel.",
    (p) =>
      assert.ok(
        p.entries.some(
          (e) =>
            e.action.kind === "management_save" &&
            e.action.section === "health" &&
            e.action.values.medicine === "Produto Teste",
        ),
      ),
  ],
  [
    "natural-edit",
    "Na ocorrência Cerca do pasto Norte, a cerca já foi consertada. Coloque como concluída e ação tomada conserto da cerca.",
    (p) => {
      const a = p.entries.find(
        (e) => e.action.kind === "management_save" && e.action.section === "occurrence",
      )?.action;
      assert.ok(a?.reference);
      assert.equal(a.values.status, "done");
    },
  ],
  [
    "natural-remove",
    "A ocorrência Cerca do pasto Norte foi cadastrada por engano. Remova ela.",
    (p) =>
      assert.ok(
        p.entries.some(
          (e) => e.action.kind === "management_remove" && e.action.section === "occurrence",
        ),
      ),
  ],
  [
    "natural-payment",
    "Já paguei hoje a conta Ração Casa Rural. Dê baixa nela.",
    (p) => {
      assert.ok(
        p.entries.some(
          (e) => e.action.kind === "management_settle" && e.action.section === "payable",
        ),
      );
      assert.ok(!p.entries.some((e) => e.action.kind === "ledger"));
    },
  ],
  [
    "natural-query",
    "Quais contas tenho a pagar?",
    (p) => {
      assert.equal(p.intent, "inspect");
      assert.equal(p.inspection.kind, "management");
      assert.equal(p.inspection.section, "payable");
    },
  ],
  [
    "natural-stock-transfer",
    "Transfira 20 kg de milho do Galpão A para o Galpão B hoje.",
    (p) =>
      assert.ok(
        p.entries.some((e) => e.action.kind === "supply_transfer" && e.action.quantity === 20),
      ),
  ],
  [
    "natural-vehicle-cost",
    "Registre o seguro de 200 reais do Trator Azul pago hoje, também no financeiro.",
    (p) => {
      assert.ok(
        p.entries.some(
          (e) => e.action.kind === "management_save" && e.action.section === "vehicle_cost",
        ),
      );
      assert.ok(
        p.entries.some((e) => e.action.kind === "ledger" && e.action.amountCents === 20000),
      );
    },
  ],
  [
    "hypothetical",
    "Se eu tivesse aplicado uma vacina ontem, onde apareceria no painel?",
    (p) => {
      assert.ok(["none", "clarify"].includes(p.intent));
      assert.equal(p.entries.length, 0);
    },
  ],
];
if (!process.env.OPENAI_API_KEY)
  throw Error("Model evaluation requires the configured server-side key.");
const failures = [];
for (const [name, text, verify] of cases) {
  if (process.argv[2] && process.argv[2] !== name) continue;
  let plan;
  try {
    const context = semanticContext({ phone, messageId: name, text }, snapshot, now);
    plan = await interpretFarmConversation(context);
    for (const e of plan.entries)
      for (const v of e.evidence) assert.ok(groundSemanticEvidence(context, v));
    verify(plan);
    if (plan.entries.length)
      prepareFarmBatch({
        book,
        propertyId,
        role: "owner",
        actions: plan.entries.map((e) => e.action),
        source: { actor: phone, messageId: name, at: now.toISOString(), confirmed: true },
        executedByMessageId: name,
      });
    console.log(`Management semantic evaluation: ${name} passed`);
  } catch (e) {
    failures.push(name);
    console.error("Synthetic plan:", JSON.stringify(plan));
    console.error(
      `Management semantic evaluation: ${name} failed: ${String(e.message).slice(0, 600)}`,
    );
  }
}
assert.deepEqual(failures, []);
