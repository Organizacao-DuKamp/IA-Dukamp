import test from "node:test";
import assert from "node:assert/strict";
import { directFarmReport } from "../src/lib/guardian/direct-report.ts";
import {
  semanticContext,
  semanticDirectiveSelection,
} from "../src/lib/guardian/semantic.server.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm, PreferencesSchema, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import type { GuardianStore } from "../src/lib/guardian/store.server.ts";

const date = new Date("2026-11-10T18:00:00.000Z");
const phone = "5517999900112";
const state = (): GuardianSnapshot => {
  const result = applyFarmAction(
    emptyFarm("Eduardo", "Monte Aprazível", "SP"),
    {
      kind: "ledger",
      direction: "expense",
      amountCents: 2_000_000,
      date: "2026-11-10",
      description: "combustível",
      recurrence: "monthly",
    },
    "owner",
    { actor: phone, messageId: "initial-fuel", at: date.toISOString(), confirmed: true },
    "FUEL",
  );
  return {
    accountVersion: 1,
    preferences: PreferencesSchema.parse({}),
    pending: null,
    properties: [{ id: "farm", name: "Eduardo", role: "owner" }],
    active: { id: "farm", version: 1, role: "owner", book: result.book },
  };
};

test("phase3: exact finance and task reports use the current authorized book", () => {
  const snapshot = state();
  const finance = directFarmReport(
    { text: "Resumo financeiro deste mês", mediaType: "audio" },
    snapshot,
    date,
  );
  assert.match(finance ?? "", /combustível/);
  assert.match(finance ?? "", /20\.000,00/);
  const tasks = directFarmReport({ text: "Minhas tarefas" }, snapshot, date);
  assert.match(tasks ?? "", /Tarefas:/);
  const location = directFarmReport({ text: "Onde estão os animais?" }, snapshot, date);
  assert.match(location ?? "", /localização atual no painel/);
});

test("phase3: report fast-path refuses mutation, ambiguous context and attachments", () => {
  const snapshot = state();
  for (const text of [
    "Resumo financeiro e registre 2 nascimentos",
    "Corrija o resumo financeiro",
    "Qual o gasto de ração?",
    "Se eu vender dez animais, qual será o lucro?",
  ]) {
    assert.equal(directFarmReport({ text }, snapshot, date), null, text);
  }
  assert.equal(
    directFarmReport({ text: "Resumo financeiro", mediaType: "document" }, snapshot, date),
    null,
  );
  snapshot.pending = {
    kind: "semantic_draft",
    question: "Confirma o registro?",
    createdAt: date.toISOString(),
    expiresAt: "2026-11-11T18:00:00.000Z",
    sourceAt: date.toISOString(),
    sourceMessageId: "pending",
    propertyId: "farm",
    messages: [],
  };
  assert.equal(directFarmReport({ text: "Resumo financeiro" }, snapshot, date), null);
});

test("phase3: semantic prompt optimization never drops specialist rules from actions or pending work", () => {
  const read = semanticContext(
    { phone, messageId: "read", text: "Qual o tamanho do rebanho?" },
    state(),
    date,
  );
  const simple = semanticDirectiveSelection(read);
  assert.equal(simple.mode, "read");
  assert.equal(simple.herdGroups, true);
  assert.equal(simple.management, false);
  const action = semanticContext(
    { phone, messageId: "action", text: "Registre uma despesa e mova o gado para o lote 4" },
    state(),
    date,
  );
  const full = semanticDirectiveSelection(action);
  assert.equal(full.mode, "operation");
  assert.equal(full.management, true);
  assert.equal(full.herdGroups, true);
  const pending = state();
  pending.pending = {
    kind: "semantic_draft",
    question: "Em qual lote?",
    createdAt: date.toISOString(),
    expiresAt: "2026-11-11T18:00:00.000Z",
    sourceAt: date.toISOString(),
    sourceMessageId: "old",
    propertyId: "farm",
    messages: [{ role: "user", content: "Mova os animais" }],
  };
  assert.equal(
    semanticDirectiveSelection(
      semanticContext({ phone, messageId: "confirm", text: "Isso mesmo" }, pending, date),
    ).mode,
    "operation",
  );
});

test("phase3: direct reports do not create commits or invoke a semantic interpreter", async () => {
  const snapshot = state();
  let commits = 0;
  const store = {
    load: async () => snapshot,
    receipt: async () => null,
    commit: async () => {
      commits++;
      throw Error("READ_ONLY_MUST_NOT_COMMIT");
    },
  } as unknown as GuardianStore;
  const result = await handleGuardianMessage(
    { phone, messageId: "report-1", text: "Resumo financeiro" },
    { store, now: date },
  );
  assert.match(result?.reply ?? "", /combustível/);
  assert.equal(result?.persisted, false);
  assert.equal(commits, 0);
});
