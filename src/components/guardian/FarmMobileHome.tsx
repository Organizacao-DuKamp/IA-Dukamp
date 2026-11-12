import { taskDisplayDueAt } from "@/lib/guardian/task-recurrence";
import {
  Beef,
  Check,
  ChevronRight,
  ClipboardList,
  Fuel,
  NotebookPen,
  Package,
  Wallet,
} from "lucide-react";
import type { FarmBook } from "@/lib/guardian/schema";
import { stockAt, emptyOperations } from "@/lib/guardian/operations";
import { operationalMoney } from "@/lib/guardian/operational-intelligence";

type Area = "herd" | "tasks" | "finance" | "fuel" | "supplies" | "records";
const areas = [
  ["herd", "Rebanho", "Animais, sanidade e pastagens", Beef, "bg-emerald-100 text-emerald-800"],
  ["tasks", "Tarefas", "Agenda e alarmes", ClipboardList, "bg-amber-100 text-amber-900"],
  ["finance", "Finanças", "Entradas, despesas e contas", Wallet, "bg-sky-100 text-sky-800"],
  ["fuel", "Combustível", "Veículos e abastecimentos", Fuel, "bg-orange-100 text-orange-800"],
  ["supplies", "Estoque", "Insumos, locais e fórmulas", Package, "bg-violet-100 text-violet-800"],
  [
    "records",
    "Caderno",
    "Anotações, rondas e ocorrências",
    NotebookPen,
    "bg-lime-100 text-lime-800",
  ],
] as const;
export function FarmMobileHome({
  book,
  busy,
  navigate,
  complete,
}: {
  book: FarmBook;
  busy: boolean;
  navigate(area: Area): void;
  complete(id: string): void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const month = today.slice(0, 7);
  const cattle = stockAt(book.operations ?? emptyOperations(), today).count;
  const finances = operationalMoney(book, month);
  const balance = finances.income - finances.expenses;
  const tasks = book.tasks
    .map((task) => ({ ...task, dueAt: taskDisplayDueAt(task) }))
    .filter((task) => task.status === "open")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const overdue = tasks.filter((task) => Date.parse(task.dueAt) < Date.now());
  const money = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <div className="farm-home space-y-7">
      <div className="farm-account-summary grid grid-cols-2 gap-5">
        <button
          disabled={busy}
          onClick={() => navigate("herd")}
          className="bg-white py-4 text-left"
        >
          <Beef size={23} className="text-emerald-800" aria-hidden="true" />
          <span className="mt-3 block text-2xl font-semibold">
            {cattle === null ? "—" : cattle.toLocaleString("pt-BR")}
          </span>
          <span className="mt-1 block text-xs text-slate-500">Bovinos nos registros</span>
        </button>
        <button
          disabled={busy}
          onClick={() => navigate("finance")}
          className="bg-white py-4 text-left"
        >
          <Wallet size={23} className="text-sky-800" aria-hidden="true" />
          <span className="mt-3 block break-words text-xl font-semibold">
            {finances.count ? money(balance) : "Sem lançamentos"}
          </span>
          <span className="mt-1 block text-sm text-slate-600">Saldo registrado no mês</span>
        </button>
      </div>
      <section aria-labelledby="farm-mobile-areas">
        <h2 id="farm-mobile-areas" className="mb-3 text-lg font-semibold">
          O que você quer cuidar?
        </h2>
        <div className="farm-quick-actions">
          {areas.map(([id, label, description, Icon, color]) => (
            <button
              key={id}
              disabled={busy}
              onClick={() => navigate(id)}
              className="farm-quick-action"
            >
              <span className={`farm-quick-icon ${color}`}>
                <Icon size={24} aria-hidden="true" />
              </span>
              <strong className="mt-3 text-xs font-medium">{label}</strong>
              <span className="sr-only">{description}</span>
            </button>
          ))}
        </div>
      </section>
      {(cattle === null || finances.estimates > 0 || overdue.length > 0) && (
        <section
          aria-label="Informações que precisam de atenção"
          className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600"
        >
          <h2 className="font-semibold">Atenção aos registros</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {cattle === null && (
              <li>Sem contagem inicial completa: o total de bovinos ainda é desconhecido.</li>
            )}
            {finances.estimates > 0 && (
              <li>
                Estimativas: {money(finances.estimates)} à parte, sem entrar no saldo dos
                lançamentos.
              </li>
            )}
            {overdue.length > 0 && (
              <li>{overdue.length} tarefa(s) vencida(s) conforme os prazos registrados.</li>
            )}
          </ul>
        </section>
      )}
      <section
        aria-labelledby="farm-next-tasks"
        className="border-t border-slate-100 bg-white py-6"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="farm-next-tasks" className="text-lg font-semibold">
            Tarefas pendentes
          </h2>
          <button
            disabled={busy}
            onClick={() => navigate("tasks")}
            className="px-2 text-sm font-semibold text-emerald-800"
          >
            Ver todas
          </button>
        </div>
        {tasks.length ? (
          <ul className="mt-2 divide-y">
            {tasks.slice(0, 3).map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-4">
                <span className="min-w-0 flex-1">
                  <strong className="block break-words text-sm font-semibold">
                    {task.title}
                    {task.recurrence === "daily" ? " · Todos os dias" : ""}
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {new Date(task.dueAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · Brasília
                  </span>
                </span>
                <button
                  disabled={busy}
                  onClick={() => complete(task.id)}
                  aria-label={`Concluir ${task.title}{task.recurrence === "daily" ? " · Todos os dias" : ""}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800"
                >
                  <Check size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-5 text-sm text-slate-500">
            Nenhuma tarefa pendente. Agende pelo WhatsApp ou toque em Novo registro.
          </p>
        )}
        <button
          disabled={busy}
          onClick={() => navigate("tasks")}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-3 text-left text-sm font-medium text-amber-950"
        >
          Configurar notificações e alarmes
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
