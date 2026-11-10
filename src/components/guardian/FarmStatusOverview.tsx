import { AlertTriangle, Beef, ClipboardList, Wallet } from "lucide-react";
import type { FarmBook } from "@/lib/guardian/schema";
import { taskDisplayDueAt } from "@/lib/guardian/task-recurrence";
import { operationalMoney } from "@/lib/guardian/operational-intelligence";
import { farmIndicators } from "@/lib/guardian/operations";

type Section = "herd" | "finance" | "tasks";

const money = (value: number) =>
  (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Desktop summary reads the same scoped book as the farm panel.
 * Never fetches data or performs actions on its own. */
export function FarmStatusOverview({
  book,
  busy,
  navigate,
}: {
  book: FarmBook;
  busy: boolean;
  navigate(section: Section): void;
}) {
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
  const finance = operationalMoney(book, day.slice(0, 7));
  const headcount = farmIndicators(book, day.slice(0, 7) + "-01", day).stock.count;
  const overdue = book.tasks.filter(
    (task) => task.status === "open" && Date.parse(taskDisplayDueAt(task)) < now.getTime(),
  ).length;
  const items = [
    {
      section: "herd" as const,
      label: "Bovinos calculados",
      value: headcount === null ? "Sem contagem inicial" : String(headcount),
      icon: Beef,
    },
    {
      section: "finance" as const,
      label: "Saldo dos lançamentos",
      value: finance.count ? money(finance.income - finance.expenses) : "Sem lançamentos",
      icon: Wallet,
    },
    {
      section: "tasks" as const,
      label: "Tarefas vencidas",
      value: String(overdue),
      icon: ClipboardList,
    },
  ];

  return (
    <section
      aria-labelledby="farm-operational-summary"
      className="mb-5 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 id="farm-operational-summary" className="text-lg font-semibold">
        Situação da fazenda
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Dados desta propriedade até {day.split("-").reverse().join("/")}. Somente registros
        existentes.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {items.map(({ section, label, value, icon: Icon }) => (
          <button
            key={section}
            type="button"
            disabled={busy}
            onClick={() => navigate(section)}
            className="flex min-h-24 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-left transition hover:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Icon aria-hidden="true" size={21} className="shrink-0 text-emerald-800" />
            <span className="min-w-0">
              <span className="block text-xs text-slate-600">{label}</span>
              <strong className="block break-words text-base">{value}</strong>
            </span>
          </button>
        ))}
      </div>
      {(finance.estimates > 0 || headcount === null || overdue > 0) && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
        >
          <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>
            {finance.estimates > 0 &&
              `Estimativas separadas: ${money(finance.estimates)}. `}
            {headcount === null &&
              "A quantidade de bovinos ainda depende de uma contagem inicial. "}
            {overdue > 0 && `${overdue} tarefa(s) estão vencidas. `}O saldo apresentado não é lucro
            líquido.
          </span>
        </p>
      )}
      {finance.estimates === 0 && headcount !== null && overdue === 0 && (
        <p className="mt-3 text-xs text-slate-600">Saldo dos registros, não lucro líquido.</p>
      )}
    </section>
  );
}
