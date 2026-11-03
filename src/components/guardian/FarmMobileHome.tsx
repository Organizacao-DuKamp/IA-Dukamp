import {
  Beef,
  Check,
  ChevronRight,
  ClipboardList,
  Fuel,
  MessageCircle,
  NotebookPen,
  Package,
  Wallet,
} from "lucide-react";
import type { FarmBook } from "@/lib/guardian/schema";
import { farmIndicators } from "@/lib/guardian/operations";
import { ledgerForTotals } from "@/lib/guardian/finance";

type Area = "herd" | "tasks" | "finance" | "fuel" | "supplies" | "records";
const areas = [
  ["herd", "Rebanho", "Animais e lotes", Beef, "bg-emerald-100 text-emerald-800"],
  ["tasks", "Tarefas", "Agenda e alarmes", ClipboardList, "bg-amber-100 text-amber-900"],
  ["finance", "Finanças", "Entradas e despesas", Wallet, "bg-sky-100 text-sky-800"],
  ["fuel", "Combustível", "Abastecimentos", Fuel, "bg-orange-100 text-orange-800"],
  ["supplies", "Estoque", "Insumos da fazenda", Package, "bg-violet-100 text-violet-800"],
  ["records", "Caderno", "Anotações do campo", NotebookPen, "bg-lime-100 text-lime-800"],
] as const;
export function FarmMobileHome({
  book,
  busy,
  navigate,
  talkUrl,
  complete,
}: {
  book: FarmBook;
  busy: boolean;
  navigate(area: Area): void;
  talkUrl: string;
  complete(id: string): void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const month = today.slice(0, 7);
  const cattle = farmIndicators(book, month + "-01", today).stock.count;
  const ledger = ledgerForTotals(book.ledger, month + "-01", today).filter(
    (entry) => (entry.periodMonth ?? entry.date.slice(0, 7)) === month,
  );
  const balance = ledger.reduce(
    (sum, entry) => sum + (entry.direction === "income" ? entry.amountCents : -entry.amountCents),
    0,
  );
  const tasks = book.tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return (
    <div className="space-y-6 md:hidden">
      <a
        href={talkUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 rounded-2xl bg-emerald-900 p-5 text-white shadow-sm"
      >
        <MessageCircle size={30} aria-hidden="true" className="shrink-0" />
        <span className="flex-1">
          <strong className="block text-lg">Falar com a TPEC-IA</strong>
          <span className="mt-1 block text-sm text-emerald-100">
            Peça, registre ou tire dúvidas no WhatsApp
          </span>
        </span>
        <ChevronRight size={23} aria-hidden="true" />
      </a>
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={busy}
          onClick={() => navigate("herd")}
          className="rounded-2xl border border-emerald-950/10 bg-white p-4 text-left"
        >
          <Beef size={23} className="text-emerald-800" aria-hidden="true" />
          <span className="mt-3 block text-2xl font-semibold">
            {cattle === null ? "—" : cattle.toLocaleString("pt-BR")}
          </span>
          <span className="mt-1 block text-sm text-slate-600">Bovinos registrados</span>
        </button>
        <button
          disabled={busy}
          onClick={() => navigate("finance")}
          className="rounded-2xl border border-emerald-950/10 bg-white p-4 text-left"
        >
          <Wallet size={23} className="text-sky-800" aria-hidden="true" />
          <span className="mt-3 block break-words text-xl font-semibold">
            {(balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          <span className="mt-1 block text-sm text-slate-600">Saldo registrado no mês</span>
        </button>
      </div>
      <section
        aria-labelledby="farm-next-tasks"
        className="rounded-2xl border border-emerald-950/10 bg-white p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="farm-next-tasks" className="text-lg font-semibold">
            Próximas tarefas
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
                  <strong className="block break-words text-sm font-semibold">{task.title}</strong>
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
                  aria-label={`Concluir ${task.title}`}
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
      <section aria-labelledby="farm-mobile-areas">
        <h2 id="farm-mobile-areas" className="mb-3 text-lg font-semibold">
          O que você quer cuidar?
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {areas.map(([id, label, description, Icon, color]) => (
            <button
              key={id}
              disabled={busy}
              onClick={() => navigate(id)}
              className="flex flex-col items-start rounded-2xl border border-emerald-950/10 bg-white p-4 text-left"
            >
              <span className={`rounded-xl p-3 ${color}`}>
                <Icon size={24} aria-hidden="true" />
              </span>
              <strong className="mt-3 text-base">{label}</strong>
              <span className="mt-1 text-xs text-slate-500">{description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
