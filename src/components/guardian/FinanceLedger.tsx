import { ledgerFuel } from "@/lib/guardian/fuel";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Search, Wallet, X } from "lucide-react";
import type { GuardianAction, LedgerEntry } from "@/lib/guardian/schema";
import { ledgerForTotals, ledgerPeriod } from "@/lib/guardian/finance";
import { PanelMetric } from "./PanelMetric";
const cash = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function FinanceLedger({
  ledger,
  busy,
  canDelete,
  onPropose,
}: {
  ledger: LedgerEntry[];
  busy: boolean;
  canDelete: boolean;
  onPropose: (a: GuardianAction) => Promise<void>;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const totals = ledgerForTotals(ledger),
    income = totals.filter((e) => e.direction === "income").reduce((s, e) => s + e.amountCents, 0),
    expense = totals
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amountCents, 0);
  const rows = ledger
    .filter(
      (e) =>
        (filter === "all" || e.direction === filter) &&
        `${e.description} ${e.lot ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.source.at.localeCompare(a.source.at));
  return (
    <section className="space-y-5" aria-label="Financeiro da fazenda">
      <div className="grid gap-3 sm:grid-cols-3">
        <PanelMetric label="Receitas" value={cash(income)} icon={ArrowDownLeft} tone="positive" />
        <PanelMetric label="Despesas" value={cash(expense)} icon={ArrowUpRight} tone="negative" />
        <PanelMetric
          label="Saldo registrado"
          value={cash(income - expense)}
          icon={Wallet}
          tone={income - expense < 0 ? "negative" : "positive"}
        />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Movimentações</h2>
          <span className="text-xs text-slate-500">{rows.length} lançamentos</span>
        </div>
        <div className="my-5 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1" aria-label="Filtrar lançamentos">
            {[
              ["all", "Todos"],
              ["income", "Receitas"],
              ["expense", "Despesas"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 basis-full items-center sm:basis-0 sm:flex-1 gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={17} aria-hidden="true" className="shrink-0 text-slate-400" />
            <input
              aria-label="Buscar lançamento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição ou lote"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((e) => {
            const outgoing = e.direction === "expense",
              Icon = outgoing ? ArrowUpRight : ArrowDownLeft;
            return (
              <article key={e.id} className="flex items-start gap-3 py-4">
                <span
                  className={`mt-1 shrink-0 rounded-xl p-2.5 ${outgoing ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 break-words font-medium text-slate-900">
                      {e.description}
                    </h3>
                    <p
                      className={`shrink-0 font-semibold tabular-nums ${outgoing ? "text-rose-700" : "text-emerald-700"}`}
                    >
                      <span aria-hidden="true">{outgoing ? "−" : "+"} </span>
                      {cash(e.amountCents)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className={outgoing ? "text-rose-700" : "text-emerald-700"}>
                      {outgoing ? "Despesa" : "Receita"}
                    </span>
                    <span>·</span>
                    <span>
                      {e.periodMonth
                        ? e.periodMonth.split("-").reverse().join("/")
                        : e.date.split("-").reverse().join("/")}
                    </span>
                    {e.recurrence === "monthly" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Mensal</span>
                    )}
                    {e.lot && <span>Lote {e.lot}</span>}
                    {e.voided && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Cancelado</span>
                    )}
                    {!e.voided && !totals.includes(e) && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">
                        Já incluído no total
                      </span>
                    )}
                  </div>
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="w-fit cursor-pointer hover:text-slate-900">
                      Detalhes do lançamento
                    </summary>
                    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
                      <p>{ledgerPeriod(e)}</p>
                      <p>Código: {e.id}</p>
                      {e.recurrence === "monthly" && <p>Valor mensal informado pelo produtor</p>}
                      {!e.voided && !totals.includes(e) && (
                        <p>
                          Histórico ou detalhamento incluído no total mensal; não somado novamente.
                        </p>
                      )}
                      <p>
                        Registrado em{" "}
                        {new Date(e.source.at).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </p>
                      {canDelete && !e.voided && !e.fuelMovementId && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void onPropose(
                              ledgerFuel(e) !== null
                                ? {
                                    kind: "fuel_void",
                                    id: e.id,
                                    reason: "Cancelamento solicitado pelo produtor no financeiro",
                                  }
                                : { kind: "delete_record", section: "ledger", id: e.id },
                            )
                          }
                          className="mt-2 inline-flex items-center gap-1 text-rose-700"
                          aria-label={`Revisar exclusão de ${e.description}`}
                        >
                          <X size={14} />
                          {ledgerFuel(e) !== null ? "Revisar cancelamento" : "Revisar exclusão"}
                        </button>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
          {!rows.length && (
            <p className="py-12 text-center text-sm text-slate-500">
              {ledger.length ? "Nenhum lançamento encontrado." : "Nenhuma movimentação registrada."}
            </p>
          )}
        </div>
        <details className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <summary className="w-fit cursor-pointer">Sobre os totais</summary>
          <p className="mt-2 max-w-xl leading-relaxed">
            Totais dos registros disponíveis, sem duplicar detalhamentos incluídos em valores
            mensais. Saldo registrado não equivale a lucro líquido. Os filtros acima alteram a
            lista, não os totais da fazenda.
          </p>
        </details>
      </div>
    </section>
  );
}
