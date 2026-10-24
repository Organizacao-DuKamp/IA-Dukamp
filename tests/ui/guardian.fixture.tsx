// Local UI fixture: no credentials, live records, external requests or sends.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { GuardianWorkspace } from "../../src/components/guardian/GuardianWorkspace";
import { GuardianActionForm } from "../../src/components/guardian/GuardianActionForm";
import { emptyFarm, type GuardianAction } from "../../src/lib/guardian/schema";
import { applyFarmAction } from "../../src/lib/guardian/book";
import type { GuardianDetail } from "../../src/lib/guardian.functions";
import "../../src/styles.css";

const source = {
  actor: "5517000000000",
  messageId: "synthetic",
  at: "2026-10-23T12:00:00Z",
  confirmed: true as const,
};
let book = emptyFarm("Fazenda Boa Vista", "Monte Aprazível", "SP");
const actions: GuardianAction[] = [
  { kind: "animal", code: "BV10", sex: "female", breed: "Nelore", lot: "2" },
  {
    kind: "weighing",
    code: "BV10",
    date: "2026-09-23",
    weightKg: 350,
    estimated: false,
    correction: false,
  },
  {
    kind: "weighing",
    code: "BV10",
    date: "2026-10-23",
    weightKg: 380,
    estimated: false,
    correction: false,
  },
  { kind: "task_create", title: "Pesagem do lote 2", dueAt: "2026-10-30T11:00:00Z", lot: "2" },
  {
    kind: "ledger",
    direction: "expense",
    amountCents: 150000,
    date: "2026-10-23",
    description: "Compra de ração",
    lot: "2",
  },
  {
    kind: "ledger",
    direction: "income",
    amountCents: 450000,
    date: "2026-10-22",
    description: "Venda de animais",
  },
  {
    kind: "record",
    type: "birth",
    date: "2026-10-23",
    count: 2,
    description: "Nascimento de dois bezerros",
    lot: "1",
  },
];
for (let i = 0; i < actions.length; i++)
  book = applyFarmAction(book, actions[i], "owner", source, `TEST${i}`).book;
const detail: GuardianDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  version: 1,
  book,
  members: [{ phone_number: source.actor, role: "owner", active: true }],
  audit: [],
  events: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      type: "task_due",
      topic: "tasks",
      status: "pending",
      message: "Fazenda Boa Vista: pesagem do lote 2 prevista para sexta-feira. Você já concluiu?",
      not_before: "2026-10-30T11:00:00Z",
      expires_at: "2026-10-31T11:00:00Z",
      attempts: 0,
      last_error: null,
      sent_at: null,
      created_at: source.at,
      evidence: { taskId: "TEST3", dueAt: "2026-10-30T11:00:00Z", sourceMessageId: "synthetic" },
    },
  ],
};
export function Preview() {
  const [tab, setTab] = useState<
      "overview" | "tasks" | "herd" | "records" | "finance" | "events" | "calculator" | "settings"
    >("overview"),
    [proposal, setProposal] = useState("");
  const onPropose = async (a: GuardianAction) => setProposal(JSON.stringify(a));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-emerald-950 px-6 py-5 text-emerald-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
          TPEC-IA · DADOS SINTÉTICOS DE TESTE
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Guardiã da Fazenda</h1>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <nav className="flex gap-2 overflow-auto pb-2" aria-label="Teste de áreas">
          {(
            [
              ["overview", "Visão geral"],
              ["tasks", "Tarefas"],
              ["herd", "Rebanho"],
              ["records", "Caderno"],
              ["finance", "Financeiro"],
              ["events", "Eventos"],
              ["calculator", "Calculadoras"],
              ["settings", "Equipe e dados"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm ${tab === id ? "bg-emerald-800 text-white" : "border border-border bg-card"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <GuardianWorkspace
          detail={detail}
          tab={tab}
          onPropose={onPropose}
          busy={false}
          ownPhone={source.actor}
          loadEventHistory={async (eventId) => ({
            partial: false,
            entries: [
              { id: 1, event_id: eventId, status: "pending", reason: null, created_at: source.at },
              {
                id: 2,
                event_id: eventId,
                status: "claimed",
                reason: null,
                created_at: "2026-10-23T12:01:00Z",
              },
              {
                id: 3,
                event_id: eventId,
                status: "retry",
                reason: "provider_rate_limited",
                created_at: "2026-10-23T12:02:00Z",
              },
            ],
          })}
        />
        <GuardianActionForm hasProperty busy={false} onPropose={onPropose} />
        <output aria-label="Proposta capturada" className="block break-all text-sm">
          {proposal}
        </output>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
