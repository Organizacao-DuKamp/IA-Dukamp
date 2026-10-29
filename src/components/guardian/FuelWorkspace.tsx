import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Fuel, Wallet, Scale, Plus, X } from "lucide-react";
import { ActionSchema, type FarmBook, type GuardianAction } from "@/lib/guardian/schema";
import { fuelMonth, fuelNames, type FuelType } from "@/lib/guardian/fuel";
import { PanelMetric } from "./PanelMetric";

const cash = (n: number) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const liters = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " L";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const previousMonth = (m: string) => {
  const d = new Date(m + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const monthLabel = (m: string) =>
  new Date(m + "-01T12:00:00Z").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
const control =
  "mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm";
type Form = "in" | "out" | "balance" | "expense";
export function FuelWorkspace({
  book,
  busy,
  onPropose,
  canEdit,
}: {
  book: FarmBook;
  busy: boolean;
  onPropose: (a: GuardianAction) => Promise<void>;
  canEdit: boolean;
}) {
  const [month, setMonth] = useState(today().slice(0, 7)),
    [filter, setFilter] = useState<FuelType | "all">("all"),
    [compare, setCompare] = useState(false),
    [otherMonth, setOtherMonth] = useState(previousMonth(month)),
    [form, setForm] = useState<Form | null>(null),
    [error, setError] = useState(""),
    [limit, setLimit] = useState(25);
  const [values, setValues] = useState<Record<string, string>>({});
  const data = fuelMonth(book, month, filter),
    other = fuelMonth(book, otherMonth, filter),
    stocks = data.stocks;
  const stockType = filter === "all" ? "diesel" : filter;
  const diesel = stocks.filter((s) => s.fuel === stockType),
    dieselKnown = diesel.length > 0 && diesel.every((s) => s.liters !== null);
  const history = (book.fuel?.movements ?? [])
    .filter((x) => x.date.startsWith(month) && (filter === "all" || x.fuel === filter))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.source.at.localeCompare(a.source.at));
  function open(kind: Form) {
    setForm(kind);
    setError("");
    setValues({
      date: today(),
      fuel: "diesel",
      tank: "Principal",
      periodMonth: month,
      mode: "daily",
    });
  }
  const field = (key: string, label: string, type = "text", required = true) => (
    <label className="min-w-0 text-sm font-medium" key={key}>
      {label}
      <input
        className={control}
        type={type}
        required={required}
        value={values[key] ?? ""}
        step={type === "number" ? "0.001" : undefined}
        min={type === "number" ? "0" : undefined}
        max={type === "date" ? today() : undefined}
        maxLength={type === "text" ? 160 : undefined}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </label>
  );
  async function propose() {
    setError("");
    const fuel = values.fuel ?? "diesel",
      date = values.date ?? today(),
      tank = values.tank?.trim() || "Principal";
    const action =
      form === "expense"
        ? {
            kind: "fuel_expense",
            fuel,
            amountCents: Math.round(Number(values.amount) * 100),
            date,
            ...(values.mode === "monthly" ? { periodMonth: values.periodMonth } : {}),
            ...(values.description?.trim() ? { description: values.description.trim() } : {}),
          }
        : {
            kind: "fuel_movement",
            fuel,
            tank,
            type: form,
            liters: Number(values.liters),
            date,
            ...(form === "out" ? { destination: values.destination } : {}),
            ...(form === "in" && values.amount
              ? { amountCents: Math.round(Number(values.amount) * 100) }
              : {}),
          };
    const p = ActionSchema.safeParse(action);
    if (!p.success) {
      setError(
        "Confira combustível, litros, valor, destino e data. Preencha os campos obrigatórios.",
      );
      return;
    }
    await onPropose(p.data);
    setForm(null);
  }
  return (
    <section aria-label="Combustível da fazenda" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Combustível</h2>
          <p className="mt-1 text-sm text-slate-500">Tanques e uso da fazenda</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-500">
            Mês
            <input
              aria-label="Mês do combustível"
              type="month"
              value={month}
              max={today().slice(0, 7)}
              onChange={(e) => {
                if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value)) {
                  setMonth(e.target.value);
                  setOtherMonth(previousMonth(e.target.value));
                  setLimit(25);
                }
              }}
              className={control}
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Combustível
            <select
              aria-label="Filtrar combustível"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className={control}
            >
              <option value="all">Todos</option>
              {Object.entries(fuelNames).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-pressed={compare}
            onClick={() => setCompare((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            <Scale size={17} />
            Comparar
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelMetric
          label={`${fuelNames[stockType]} no tanque`}
          value={dieselKnown ? liters(diesel.reduce((n, s) => n + s.liters!, 0)) : "Não informado"}
          icon={Fuel}
          hint={
            month === today().slice(0, 7)
              ? "Saldo calculado dos registros"
              : "Saldo até o fim do mês"
          }
        />
        <PanelMetric
          label="Gastos no mês"
          value={cash(data.expenseCents)}
          icon={Wallet}
          tone="negative"
          hint="Também no financeiro"
        />
        <PanelMetric
          label="Entradas no mês"
          value={liters(data.entered)}
          icon={ArrowDownToLine}
          tone="positive"
        />
        <PanelMetric
          label="Saídas no mês"
          value={liters(data.exited)}
          icon={ArrowUpFromLine}
          tone="warning"
        />
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["in", "Entrada"],
              ["out", "Saída"],
              ["balance", "Informar saldo"],
              ["expense", "Registrar gasto"],
            ] as const
          ).map(([kind, label]) => (
            <button
              disabled={busy}
              key={kind}
              onClick={() => open(kind)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${kind === "in" ? "bg-emerald-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              <Plus size={16} />
              {label}
            </button>
          ))}
        </div>
      )}
      {form && (
        <form
          aria-label="Novo registro de combustível"
          className="rounded-2xl border border-emerald-200 bg-white p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void propose();
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">
              {
                {
                  in: "Entrada no tanque",
                  out: "Saída de combustível",
                  balance: "Saldo do tanque",
                  expense: "Gasto de combustível",
                }[form]
              }
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="Fechar registro de combustível"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">
              Tipo de combustível
              <select
                aria-label="Tipo de combustível"
                className={control}
                value={values.fuel ?? "diesel"}
                onChange={(e) => setValues((v) => ({ ...v, fuel: e.target.value }))}
              >
                {Object.entries(fuelNames)
                  .filter(([v]) => form === "expense" || v !== "unspecified")
                  .map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            {form !== "expense" && field("tank", "Tanque")}
            {form !== "expense" &&
              field("liters", form === "balance" ? "Saldo (L)" : "Quantidade (L)", "number")}
            {form === "out" && field("destination", "Destino", "text")}
            {(form === "in" || form === "expense") &&
              field(
                "amount",
                form === "in" ? "Custo da entrada (R$, opcional)" : "Valor (R$)",
                "number",
                form === "expense",
              )}
            {form === "expense" && (
              <label className="text-sm font-medium">
                Tipo de lançamento
                <select
                  aria-label="Tipo de lançamento de combustível"
                  className={control}
                  value={values.mode ?? "daily"}
                  onChange={(e) => setValues((v) => ({ ...v, mode: e.target.value }))}
                >
                  <option value="daily">Despesa do dia</option>
                  <option value="monthly">Total informado do mês</option>
                </select>
              </label>
            )}
            {form === "expense" && values.mode === "monthly" && (
              <label className="text-sm font-medium">
                Mês do total
                <input
                  aria-label="Mês do total de combustível"
                  className={control}
                  type="month"
                  required
                  max={today().slice(0, 7)}
                  value={values.periodMonth ?? month}
                  onChange={(e) => setValues((v) => ({ ...v, periodMonth: e.target.value }))}
                />
              </label>
            )}
            {field(
              "date",
              form === "expense" && values.mode === "monthly" ? "Data da informação" : "Data",
              "date",
            )}
            {form === "expense" && field("description", "Descrição (opcional)", "text", false)}
          </div>
          {form === "balance" && (
            <p className="mt-3 text-xs text-slate-500">
              Informe quanto há no tanque nesta data. Entradas e saídas posteriores atualizam esse
              saldo.
            </p>
          )}
          {form === "expense" && values.mode === "monthly" && (
            <p className="mt-3 text-xs text-slate-500">
              O total inclui os detalhes anteriores desse combustível no mês. Os registros originais
              ficam no histórico.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="mt-4 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            type="submit"
          >
            Revisar combustível antes de salvar
          </button>
        </form>
      )}
      {compare && (
        <section
          aria-label="Comparação mensal de combustível"
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Comparação mensal</h3>
            <label className="text-xs text-slate-500">
              Comparar com
              <input
                aria-label="Comparar combustível com o mês"
                type="month"
                value={otherMonth}
                max={previousMonth(month)}
                onChange={(e) => {
                  if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value) && e.target.value < month)
                    setOtherMonth(e.target.value);
                }}
                className={control}
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-3 pr-3">Mês</th>
                  <th className="px-3">Entradas</th>
                  <th className="px-3">Saídas</th>
                  <th className="pl-3 text-right">Gastos</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [month, data],
                  [otherMonth, other],
                ].map(([m, v]) => {
                  const d = v as typeof data;
                  return (
                    <tr key={m as string} className="border-t border-slate-100">
                      <th className="py-4 pr-3 font-medium capitalize">
                        {monthLabel(m as string)}
                      </th>
                      <td className="whitespace-nowrap px-3 text-emerald-700">
                        {liters(d.entered)}
                      </td>
                      <td className="whitespace-nowrap px-3 text-amber-700">{liters(d.exited)}</td>
                      <td className="whitespace-nowrap pl-3 text-right font-semibold text-rose-700">
                        {cash(d.expenseCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            className={`mt-3 text-sm font-medium ${data.expenseCents > other.expenseCents ? "text-rose-700" : "text-emerald-700"}`}
          >
            Variação dos gastos: {cash(data.expenseCents - other.expenseCents)}
            {other.expenseCents > 0
              ? ` (${((data.expenseCents / other.expenseCents - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`
              : " · sem base percentual"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Comparação dos registros disponíveis; um mês sem lançamentos não comprova consumo zero.
          </p>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Tanques</h3>
          <div className="mt-4 space-y-3">
            {stocks.map((s) => (
              <div
                key={s.fuel + ":" + s.tank}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{s.tank}</p>
                  <p className="text-xs text-slate-500">
                    {fuelNames[s.fuel]} · {s.date.split("-").reverse().join("/")}
                  </p>
                </div>
                <strong
                  className={s.liters === null ? "text-sm text-amber-700" : "text-lg text-sky-800"}
                >
                  {s.liters === null ? "Informar saldo" : liters(s.liters)}
                </strong>
              </div>
            ))}
          </div>
          {!stocks.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Informe o saldo inicial para acompanhar o tanque.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold">Para onde foi</h3>
          <div className="mt-4 space-y-4">
            {data.destinations.map((d) => (
              <div key={d.fuel + ":" + d.name}>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words font-medium">
                    {d.name}
                    <small className="block font-normal text-slate-500">{fuelNames[d.fuel]}</small>
                  </span>
                  <strong className="shrink-0 text-amber-800">{liters(d.liters)}</strong>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-50">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{
                      width: `${data.exited ? Math.min(100, (100 * d.liters) / data.exited) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!data.destinations.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma saída registrada neste mês.
            </p>
          )}
        </section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Movimentações do mês</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {history.slice(0, limit).map((m) => (
            <article
              key={m.id}
              className={`flex flex-wrap items-start justify-between gap-3 py-3 ${m.voided ? "opacity-60" : ""}`}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">
                  {m.type === "in"
                    ? "Entrada"
                    : m.type === "out"
                      ? m.destination
                      : "Saldo informado"}{" "}
                  · {fuelNames[m.fuel]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {m.date.split("-").reverse().join("/")} · Tanque {m.tank}
                  {m.voided ? " · Cancelado" : ""}
                </p>
                <details className="mt-1 text-xs text-slate-500">
                  <summary className="cursor-pointer">Detalhes</summary>
                  <p className="mt-2">
                    Origem:{" "}
                    {m.source.messageId.startsWith("panel:") ? "Painel" : "Conversa com a TPEC-IA"}{" "}
                    ·{" "}
                    {new Date(m.source.at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                  {m.voided && <p>Cancelamento: {m.voided.reason}</p>}
                  {canEdit && !m.voided && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void onPropose({
                          kind: "fuel_void",
                          id: m.id,
                          reason: "Cancelamento solicitado pelo produtor no painel",
                        })
                      }
                      className="mt-2 text-rose-700"
                      aria-label={`Cancelar ${m.type} de ${liters(m.liters)} para ${m.destination ?? m.tank}`}
                    >
                      Cancelar registro
                    </button>
                  )}
                </details>
              </div>
              <strong
                className={`shrink-0 text-sm tabular-nums ${m.voided ? "line-through" : m.type === "in" ? "text-emerald-700" : m.type === "out" ? "text-amber-800" : "text-sky-800"}`}
              >
                {m.type === "in" ? "+ " : m.type === "out" ? "− " : ""}
                {liters(m.liters)}
              </strong>
            </article>
          ))}
        </div>
        {!history.length && (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma movimentação neste mês.</p>
        )}
        {history.length > limit && (
          <button
            className="mt-3 text-sm font-semibold text-emerald-800"
            onClick={() => setLimit((n) => n + 25)}
          >
            Mostrar mais
          </button>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Gastos de combustível</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {data.expenses
            .slice()
            .reverse()
            .slice(0, limit)
            .map((e) => (
              <article key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{e.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {e.periodMonth
                      ? "Total mensal informado"
                      : e.date.split("-").reverse().join("/")}
                    {e.voided
                      ? " · Cancelado"
                      : !data.counted.includes(e)
                        ? " · Incluído em total informado"
                        : ""}
                  </p>
                  {canEdit && !e.voided && !e.fuelMovementId && (
                    <details className="mt-1 text-xs text-slate-500">
                      <summary className="cursor-pointer">Opções</summary>
                      <button
                        disabled={busy}
                        className="mt-2 text-rose-700"
                        onClick={() =>
                          void onPropose({
                            kind: "fuel_void",
                            id: e.id,
                            reason: "Cancelamento solicitado pelo produtor no painel",
                          })
                        }
                      >
                        Cancelar gasto de {cash(e.amountCents)}
                      </button>
                    </details>
                  )}
                </div>
                <strong
                  className={`shrink-0 text-sm text-rose-700 ${e.voided ? "line-through" : ""}`}
                >
                  {cash(e.amountCents)}
                </strong>
              </article>
            ))}
        </div>
        {!data.expenses.length && (
          <p className="py-6 text-center text-sm text-slate-500">
            Nenhum gasto registrado neste mês.
          </p>
        )}
        {data.expenses.length > limit && (
          <button
            className="mt-3 text-sm font-semibold text-emerald-800"
            onClick={() => setLimit((n) => n + 25)}
          >
            Mostrar mais gastos
          </button>
        )}
      </section>
    </section>
  );
}
