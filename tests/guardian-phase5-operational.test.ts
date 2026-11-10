import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyFarm,
  PreferencesSchema,
  type FarmBook,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import {
  operationalMoney,
  operationalReport,
} from "../src/lib/guardian/operational-intelligence.ts";
import { directFarmReport } from "../src/lib/guardian/direct-report.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import type { GuardianStore } from "../src/lib/guardian/store.server.ts";

const now = new Date("2026-11-10T18:30:00Z");
const source = (messageId: string) => ({
  actor: "test-producer",
  messageId,
  at: now.toISOString(),
  confirmed: true as const,
});

function book(): FarmBook {
  const b = emptyFarm("Fazenda de Testes", "Tanabi", "SP");
  b.ledger = [
    {
      id: "in-nov",
      direction: "income",
      amountCents: 3_000_000,
      date: "2026-11-02",
      description: "Venda confirmada",
      source: source("in-nov"),
    },
    {
      id: "fuel-detail",
      direction: "expense",
      amountCents: 200_000,
      date: "2026-11-02",
      description: "Combustível diário já incluído no total informado",
      source: source("fuel-detail"),
    },
    {
      id: "total-nov",
      direction: "expense",
      amountCents: 2_000_000,
      date: "2026-11-10",
      periodMonth: "2026-11",
      description: "Total de despesas do mês",
      source: source("total-nov"),
    },
    {
      id: "estimate",
      direction: "expense",
      amountCents: 900_000,
      estimated: true,
      date: "2026-11-07",
      description: "Projeção de custos",
      source: source("estimate"),
    },
    {
      id: "old-month",
      direction: "expense",
      amountCents: 500_000,
      date: "2026-10-05",
      description: "Ração",
      recurrence: "monthly",
      source: source("old-month"),
    },
    {
      id: "old-income",
      direction: "income",
      amountCents: 800_000,
      date: "2026-10-08",
      description: "Receita outubro",
      source: source("old-income"),
    },
  ];
  b.tasks.push({
    id: "feed",
    title: "Conferir água dos animais",
    dueAt: "2026-11-09T13:00:00.000Z",
    status: "open",
    source: source("feed"),
    updatedAt: now.toISOString(),
  });
  return b;
}

const snapshot = (farm: FarmBook): GuardianSnapshot => ({
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  properties: [{ id: "farm-1", name: farm.name!, role: "owner" }],
  active: { id: "farm-1", version: 1, role: "owner", book: farm },
});

test("phase5: only confirmed actuals contribute to financial comparison", () => {
  const b = book();
  const current = operationalMoney(b, "2026-11");
  assert.equal(current.income, 3_000_000);
  assert.equal(current.expenses, 2_000_000);
  assert.equal(current.estimates, 900_000);
  assert.equal(current.count, 2);
  const older = operationalMoney(b, "2026-10");
  assert.equal(older.expenses, 500_000);
  const text = operationalReport(b, "finance", now);
  assert.match(text, /30.000,00/);
  assert.match(text, /20.000,00/);
  assert.match(text, /não é lucro líquido/);
  assert.match(text, /Estimativas registradas separadamente/);
  assert.match(text, /5000,00|5.000,00/);
});

test("phase5: monthly recurring entry is not cloned into later months", () => {
  const b = emptyFarm("Fazenda Teste", "Tanabi", "SP");
  b.ledger.push({
    id: "oct-expense",
    direction: "expense",
    amountCents: 600_000,
    description: "Ração mensal",
    recurrence: "monthly",
    date: "2026-10-12",
    source: source("oct-expense"),
  });
  assert.equal(operationalMoney(b, "2026-10").expenses, 600_000);
  assert.equal(operationalMoney(b, "2026-11").expenses, 0);
  assert.match(operationalReport(b, "finance", now), /não é replicado automaticamente/);
});

test("phase5: operational overview reports only supported herd numbers and explicit follow-ups", () => {
  const text = operationalReport(book(), "overview", now);
  assert.match(text, /total desconhecido/);
  assert.match(text, /1 tarefa\(s\) vencida/);
  assert.match(text, /nenhum preço foi presumido/);
  assert.match(text, /não consultou boletins meteorológicos/);
  assert.doesNotMatch(text, /lucro líquido:\s*R\$/);
});

test("phase5: alerts do not fabricate external weather or task status", () => {
  const b = book();
  const text = operationalReport(b, "alerts", now);
  assert.match(text, /Conferir água dos animais/);
  assert.match(text, /falta contagem inicial geral/);
  assert.match(text, /não consultou boletins meteorológicos/);
  b.tasks[0].status = "done";
  assert.match(operationalReport(b, "alerts", now), /Nenhuma tarefa vencida encontrada/);
});

test("phase5: direct WhatsApp intents require the authorized farm, no pending action, and no mixed writes", () => {
  const s = snapshot(book());
  assert.match(
    directFarmReport({ text: "Indicadores da fazenda" }, s, now) ?? "",
    /Indicadores operacionais/,
  );
  assert.match(
    directFarmReport({ text: "Comparar financeiro com mês passado" }, s, now) ?? "",
    /Financeiro de/,
  );
  assert.match(
    directFarmReport({ text: "O que precisa de atenção na fazenda?" }, s, now) ?? "",
    /Pendências registradas/,
  );
  assert.equal(
    directFarmReport({ text: "Indicadores da fazenda e registre 2 nascimentos" }, s, now),
    null,
  );
  assert.equal(
    directFarmReport({ text: "Indicadores da fazenda", mediaType: "document" }, s, now),
    null,
  );
  assert.equal(
    directFarmReport({ text: "Indicadores da fazenda", animalDocument: {} as never }, s, now),
    null,
  );
  assert.equal(directFarmReport({ text: "Preço do boi gordo hoje" }, s, now), null);
  assert.equal(
    directFarmReport({ text: "Indicadores da fazenda" }, { ...s, active: null }, now),
    null,
  );
  s.pending = {
    kind: "semantic_draft",
    propertyId: "farm-1",
    createdAt: now.toISOString(),
    expiresAt: "2026-11-11T18:30:00.000Z",
    sourceMessageId: "pending",
    sourceAt: now.toISOString(),
    question: "Confirma a operação?",
    messages: [],
  };
  assert.equal(directFarmReport({ text: "Indicadores da fazenda" }, s, now), null);
});

test("phase5: live handler read-only dashboard never commits or requests LLM", async () => {
  const s = snapshot(book());
  let commits = 0;
  const store = {
    load: async () => s,
    receipt: async () => null,
    commit: async () => {
      commits++;
      throw Error("DASHBOARD_MUST_NEVER_WRITE");
    },
  } as unknown as GuardianStore;
  const answer = await handleGuardianMessage(
    { phone: "5517999999998", messageId: "phase5-overview", text: "Indicadores da fazenda" },
    {
      store,
      now,
      extract: async () => {
        throw Error("NO_LLM_FOR_VERIFIED_REPORT");
      },
    },
  );
  assert.equal(answer?.persisted, false);
  assert.match(answer?.reply ?? "", /Indicadores operacionais/);
  assert.equal(commits, 0);
});
