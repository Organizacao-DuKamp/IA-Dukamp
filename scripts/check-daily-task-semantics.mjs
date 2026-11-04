// Synthetic provider evaluation: no production farm, phone, history, database or messaging adapter.
import assert from "node:assert/strict";
import { emptyFarm, PreferencesSchema } from "../src/lib/guardian/schema.ts";
import {
  semanticContext,
  interpretFarmConversation,
  groundSemanticEvidence,
} from "../src/lib/guardian/semantic.server.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
for (const key of Object.keys(process.env))
  if (/^(?:SUPABASE|VITE_SUPABASE|DUKAMP_|WHATSAPP_|LOVABLE_)/.test(key)) delete process.env[key];
const phone = "000000000000087",
  propertyId = "synthetic-daily-farm";
const book = emptyFarm("Fazenda QA Ipê", "Tanabi", "SP");
const snapshot = {
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  active: { id: propertyId, version: 1, role: "owner", book },
  properties: [{ id: propertyId, name: book.name, role: "owner" }],
};
const daily = {
  kind: "task_create",
  title: "Dar ração aos gados",
  dueAt: "2026-11-04T11:00:00.000Z",
  recurrence: "daily",
};
const saved = prepareFarmBatch({
  book,
  actions: [daily],
  role: "owner",
  propertyId,
  source: {
    actor: phone,
    messageId: "synthetic-seed",
    at: "2026-11-04T10:00:00Z",
    confirmed: true,
  },
  executedByMessageId: "synthetic-seed",
}).book;
const existing = { ...snapshot, active: { ...snapshot.active, book: saved } };
const cases = [
  {
    name: "spoken-daily-after-8",
    now: "2026-11-04T11:32:00Z",
    text: "Tpex, eu quero que você me lembre todos os dias, às oito da manhã, para dar ração aos gados.",
    due: "2026-11-05T11:00:00.000Z",
    recurrence: "daily",
  },
  {
    name: "daily-before-8",
    now: "2026-11-04T10:00:00Z",
    text: "Todo dia às 8h me avise de colocar ração para o gado.",
    due: "2026-11-04T11:00:00.000Z",
    recurrence: "daily",
  },
  {
    name: "daily-start-date",
    now: "2026-11-04T11:32:00Z",
    text: "A partir do dia 10/11/2026, me lembre diariamente às 8h de dar ração aos gados.",
    due: "2026-11-10T11:00:00.000Z",
    recurrence: "daily",
  },
  {
    name: "one-off-stays-one-off",
    now: "2026-11-04T11:32:00Z",
    text: "Amanhã às 8h me lembre de dar ração aos gados.",
    due: "2026-11-05T11:00:00.000Z",
    recurrence: undefined,
  },
  {
    name: "cancel-series",
    now: "2026-11-04T11:32:00Z",
    text: "Pare de me lembrar todo dia de dar ração aos gados. Cancele essa repetição.",
    state: existing,
    update: "cancelled",
  },
  {
    name: "complete-today",
    now: "2026-11-04T11:32:00Z",
    text: "Já dei a ração de hoje para os gados, pode concluir essa tarefa de hoje. Continue me lembrando nos próximos dias.",
    state: existing,
    update: "done",
  },
];
for (const c of cases) {
  const context = semanticContext(
    { phone, messageId: "synthetic-" + c.name, text: c.text, history: [] },
    c.state ?? snapshot,
    new Date(c.now),
  );
  if (process.argv.includes("--offline")) continue;
  const plan = await interpretFarmConversation(context);
  assert.ok((c.update ? ["apply", "propose"] : ["apply"]).includes(plan.intent), c.name);
  assert.equal(plan.entries.length, 1, c.name);
  for (const e of plan.entries[0].evidence) assert.ok(groundSemanticEvidence(context, e), c.name);
  const action = plan.entries[0].action;
  if (c.update) {
    assert.equal(action.kind, "task_update", c.name);
    assert.equal(action.status, c.update, c.name);
    assert.equal(action.task, saved.tasks[0].id, c.name);
  } else {
    assert.equal(action.kind, "task_create", c.name);
    assert.equal(Date.parse(action.dueAt), Date.parse(c.due), c.name);
    assert.equal(action.recurrence, c.recurrence, c.name);
    assert.match(action.title, /ra[cç][aã]o/i, c.name);
  }
  const prepared = prepareFarmBatch({
    book: (c.state ?? snapshot).active.book,
    actions: [action],
    role: "owner",
    propertyId,
    source: { actor: phone, messageId: "synthetic-" + c.name, at: c.now, confirmed: true },
    executedByMessageId: "synthetic-" + c.name,
  });
  if (c.update === "done") {
    assert.equal(prepared.book.tasks[0].status, "open");
    assert.equal(prepared.book.tasks[0].recurrence, "daily");
  }
  console.log("Synthetic daily semantic check passed:", c.name);
}
if (process.argv.includes("--offline"))
  console.log(`Daily recurrence preflight passed: ${cases.length} synthetic cases.`);
