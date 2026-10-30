// Exclusively synthetic semantic checks. No production history, phone, farm,
// database client or WhatsApp adapter is read by this script.
import assert from "node:assert/strict";
import { emptyFarm, PreferencesSchema } from "../src/lib/guardian/schema.ts";
import { prepareFarmBatch } from "../src/lib/guardian/execution.ts";
import {
  semanticContext,
  interpretFarmConversation,
  groundSemanticEvidence,
} from "../src/lib/guardian/semantic.server.ts";

// Netlify build environments may also contain application credentials. Remove
// them in this child process before invoking any provider or telemetry code.
for (const key of Object.keys(process.env))
  if (/^(?:SUPABASE|VITE_SUPABASE|DUKAMP_|WHATSAPP_|LOVABLE_)/.test(key)) delete process.env[key];

const now = new Date("2026-10-30T12:00:00Z");
const phone = "000000000000001";
const source = {
  actor: phone,
  messageId: "synthetic-seed",
  at: "2026-10-29T12:00:00Z",
  confirmed: true,
};
const book = prepareFarmBatch({
  book: emptyFarm("Fazenda QA Cedro", "Cidade de Teste", "SP"),
  role: "owner",
  propertyId: "synthetic-farm",
  source,
  executedByMessageId: "synthetic-seed",
  actions: [
    { kind: "herd_count", species: "cattle", count: 25, date: "2026-10-28" },
    {
      kind: "herd_event",
      species: "cattle",
      type: "purchase",
      count: 12,
      date: "2026-10-29",
      description: "Compra fictícia para validação",
    },
    {
      kind: "herd_event",
      species: "sheep",
      type: "transfer_in",
      count: 7,
      date: "2026-10-29",
      description: "Entrada fictícia para validação",
    },
  ],
}).book;
const snapshot = {
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  active: { id: "synthetic-farm", version: 1, role: "owner", book },
  properties: [{ id: "synthetic-farm", name: "Fazenda QA Cedro", role: "owner" }],
};
const relocated = {
  ...snapshot,
  active: {
    ...snapshot.active,
    book: prepareFarmBatch({
      book,
      role: "owner",
      propertyId: "synthetic-farm",
      source: { ...source, messageId: "synthetic-relocation", at: now.toISOString() },
      executedByMessageId: "synthetic-relocation",
      actions: [{ kind: "herd_relocate", to: "Pastagem QA", date: "2026-10-30" }],
    }).book,
  },
};
const cases = [
  {
    name: "create-area",
    text: "Crie o piquete oito com doze hectares e meio de braquiária na Fazenda QA Cedro.",
    verify: (p) => {
      const a = p.entries.find((e) => e.action.kind === "lot_update")?.action;
      assert.equal(a?.areaHa, 12.5);
      assert.ok(/8|oito/.test(a.lot));
    },
  },
  {
    name: "edit-area",
    text: "Altere a área do lote oito para quatorze hectares. A pastagem permanece braquiária.",
    verify: (p) => {
      assert.equal(p.entries.find((e) => e.action.kind === "lot_update")?.action.areaHa, 14);
    },
  },
  {
    name: "all-species",
    text: "Leve todos os animais registrados nesta fazenda para o lote oito, por favor.",
    verify: (p) => {
      assert.equal(p.entries.length, 1);
      assert.equal(p.entries[0].action.kind, "herd_relocate");
      assert.equal(p.entries[0].action.species, undefined);
    },
  },
  {
    name: "one-species",
    text: "Mova todos os bovinos desta fazenda para o lote oito. Os ovinos ficam onde estão.",
    verify: (p) => {
      assert.equal(p.entries.length, 1);
      assert.equal(p.entries[0].action.kind, "herd_relocate");
      assert.equal(p.entries[0].action.species, "cattle");
    },
  },
  {
    name: "group-only",
    text: "Mova somente os doze bovinos da compra registrada para o novo lote oito.",
    verify: (p) => {
      assert.equal(p.entries.length, 1);
      assert.equal(p.entries[0].action.kind, "lot_transfer");
      assert.equal(p.entries[0].action.movementId, book.operations.movements[0].id);
      assert.equal(p.entries[0].action.count, 12);
    },
  },
  {
    name: "already-moved-unassigned-followup",
    state: relocated,
    text: "Os animais que aparecem sem lote definido na lista antiga pode colocar na Pastagem QA também, tá?",
    intents: ["inspect"],
    verify: (p) => {
      assert.equal(p.intent, "inspect");
      assert.equal(p.inspection?.kind, "herd_locations");
      assert.equal(p.entries.length, 0);
    },
  },
  {
    name: "read-current-locations",
    state: relocated,
    text: "Confere pra mim onde estão os grupos de animais dessa fazenda agora.",
    intents: ["inspect"],
    verify: (p) => {
      assert.equal(p.intent, "inspect");
      assert.equal(p.inspection?.kind, "herd_locations");
      assert.equal(p.entries.length, 0);
    },
  },
  {
    name: "spoken-panel-access",
    text: "Tê pequi, gere o código do painel para a Fazenda QA Cedro, por favor.",
    intents: ["panel"],
    verify: (p) => {
      assert.equal(p.intent, "panel");
      assert.equal(p.propertyId, "synthetic-farm");
      assert.equal(p.entries.length, 0);
    },
  },
];
const contexts = cases.map((c) =>
  semanticContext(
    { phone, messageId: "synthetic-" + c.name, text: c.text, history: [] },
    c.state ?? snapshot,
    now,
  ),
);
for (const context of contexts) {
  const serialized = JSON.stringify(context);
  assert.ok(!/cawgzodelwchccilqeqr|2376|Eduardo|Tambori|wamid\./.test(serialized));
  assert.equal(context.snapshot.active.id, "synthetic-farm");
  assert.ok(context.snapshot.properties.every((p) => p.id === "synthetic-farm"));
}
if (process.argv.includes("--offline")) {
  console.log(
    `Synthetic preflight passed: ${cases.length} literal fixtures, invented farm/phone, no production history or database access.`,
  );
} else {
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_ACCESS_TOKEN"])
    assert.ok(
      !process.env[key],
      "External evaluation must not receive production database or WhatsApp credentials",
    );
  for (let i = 0; i < cases.length; i++) {
    const plan = await interpretFarmConversation(contexts[i]);
    assert.ok((cases[i].intents ?? ["apply", "propose"]).includes(plan.intent));
    for (const entry of plan.entries)
      for (const e of entry.evidence) assert.ok(groundSemanticEvidence(contexts[i], e));
    cases[i].verify(plan);
    console.log("Synthetic semantic check passed:", cases[i].name);
  }
}
