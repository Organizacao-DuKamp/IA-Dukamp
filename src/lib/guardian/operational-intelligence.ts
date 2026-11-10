import { farmName } from "./schema.ts";
import type { FarmBook } from "./schema.ts";
import { ledgerForTotals, fuelCategory } from "./finance.ts";
import { farmIndicators } from "./operations.ts";
import { taskDisplayDueAt } from "./task-recurrence.ts";

export type OperationalView = "overview" | "finance" | "alerts";

const cash = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const monthRange = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  const start = month + "-01";
  const end = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  const previous = new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7);
  return { start, end, previous };
};

const localDay = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(at);

type MoneySummary = {
  entries: ReturnType<typeof ledgerForTotals>;
  income: number;
  expenses: number;
  estimates: number;
  count: number;
};

/**
 * Source-of-truth monthly totals, no re-creation of future recurring
 * installments. Estimates and hypothetical figures never become actual cash.
 */
export function operationalMoney(book: FarmBook, month: string): MoneySummary {
  const { start, end } = monthRange(month);
  const actual = ledgerForTotals(book.ledger.filter((e) => !e.estimated), start, end);
  const estimated = ledgerForTotals(book.ledger.filter((e) => !!e.estimated), start, end);
  return {
    entries: actual,
    income: actual
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amountCents, 0),
    expenses: actual
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amountCents, 0),
    estimates: estimated.reduce((s, e) => s + e.amountCents, 0),
    count: actual.length,
  };
}

function expenseGroups(entries: MoneySummary["entries"]) {
  const groups = new Map<string, number>();
  for (const e of entries) {
    if (e.direction !== "expense") continue;
    const category =
      fuelCategory(e) ??
      (e.category?.trim() ? e.category.trim().slice(0, 40) : "Sem categoria informada");
    groups.set(category, (groups.get(category) ?? 0) + e.amountCents);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function financeView(book: FarmBook, month: string) {
  const current = operationalMoney(book, month);
  const previousMonth = monthRange(month).previous;
  const previous = operationalMoney(book, previousMonth);
  const label = (m: string) => m.slice(5) + "/" + m.slice(0, 4);
  const costCategories = expenseGroups(current.entries).slice(0, 5);
  const comparison =
    previous.count === 0
      ? "Mês anterior: não há lançamentos confirmados para uma comparação confiável."
      : `Mês anterior (${label(previousMonth)}): receitas ${cash(previous.income)}; despesas ${cash(previous.expenses)}; saldo ${cash(previous.income - previous.expenses)}.`;
  return [
    `Financeiro de ${farmName(book)} — ${label(month)}`,
    current.count
      ? `Receitas registradas: ${cash(current.income)}; despesas registradas: ${cash(current.expenses)}; saldo dos registros: ${cash(current.income - current.expenses)}.`
      : "Não há lançamentos confirmados para este mês. Isso não significa que não houve movimentações.",
    "O saldo é receitas menos despesas registradas; não é lucro líquido nem fluxo de caixa auditado.",
    comparison,
    ...(costCategories.length
      ? ["Despesas por categoria informada: " + costCategories.map(([k, v]) => `${k}: ${cash(v)}`).join("; ") + "."]
      : []),
    ...(current.estimates
      ? [`Estimativas registradas separadamente: ${cash(current.estimates)} (não somadas aos valores realizados).`]
      : []),
    "Um lançamento declarado como mensal não é replicado automaticamente nos meses seguintes.",
  ].join("\n");
}

function alertView(book: FarmBook, at: Date) {
  const overdue = book.tasks
    .filter((t) => t.status === "open" && Date.parse(taskDisplayDueAt(t)) < at.getTime())
    .sort((a, b) => taskDisplayDueAt(a).localeCompare(taskDisplayDueAt(b)));
  const dueSoon = book.tasks.filter(
    (t) =>
      t.status === "open" &&
      Date.parse(taskDisplayDueAt(t)) >= at.getTime() &&
      Date.parse(taskDisplayDueAt(t)) <= at.getTime() + 86400000,
  );
  const alerts = [
    `Pendências registradas de ${farmName(book)}:`,
    overdue.length
      ? `${overdue.length} tarefa(s) vencida(s): ${overdue
          .slice(0, 3)
          .map((t) => t.title)
          .join("; ")}${overdue.length > 3 ? " (outras no painel)" : ""}.`
      : "Nenhuma tarefa vencida encontrada nos registros disponíveis.",
    dueSoon.length
      ? `${dueSoon.length} tarefa(s) previstas para as próximas 24 horas.`
      : "Nenhuma tarefa prevista nas próximas 24 horas nos registros disponíveis.",
  ];
  if (!book.operations?.counts?.some((c) => !c.lot && (c.species ?? "cattle") === "cattle"))
    alerts.push("Rebanho: falta contagem inicial geral para calcular o total bovino com segurança.");
  alerts.push(
    "Este resumo não consultou boletins meteorológicos nem cotações. Avisos climáticos só devem ser enviados com fonte, local, prazo e consentimento válidos.",
  );
  return alerts.join("\n");
}

/** Read-only, snapshot-scoped insights; never submit operations or send alerts. */
export function operationalReport(book: FarmBook, view: OperationalView, at: Date): string {
  const day = localDay(at);
  const month = day.slice(0, 7);
  if (view === "finance") return financeView(book, month);
  if (view === "alerts") return alertView(book, at);
  const indicator = farmIndicators(book, month + "-01", day);
  const stock = indicator.stock;
  return [
    `Indicadores operacionais de ${farmName(book)} — ${day}`,
    stock.count === null
      ? "Rebanho bovino: total desconhecido (falta contagem inicial)."
      : `Rebanho bovino calculado: ${stock.count} cabeça(s), com base em contagem e movimentações declaradas.`,
    `Neste mês: ${indicator.births} nascimento(s) e ${indicator.deaths} morte(s) informados.`,
    financeView(book, month),
    alertView(book, at),
    "Cotações de mercado exigem produto, praça, unidade, data e fonte verificável; nenhum preço foi presumido.",
  ].join("\n\n").slice(0, 4500);
}
