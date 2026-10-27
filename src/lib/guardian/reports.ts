import { localDateForTimeZone, localDateTimeToUtc } from "../whatsapp/proactive.ts";
import type { FarmBook, GuardianEvent, GuardianPreferences } from "./schema.ts";
import { ledgerForTotals } from "./finance.ts";

export function reportPeriod(
  preferences: GuardianPreferences,
  now: Date,
): { start: string; end: string; due: string } | null {
  if (preferences.reportCadence === "none") return null;
  const today = localDateForTimeZone(now, preferences.timeZone),
    day = new Date(today + "T12:00:00Z");
  let end = today,
    start: string;
  if (preferences.reportCadence === "weekly") {
    const delta = (day.getUTCDay() + 6) % 7;
    end = new Date(day.getTime() - delta * 86400000).toISOString().slice(0, 10);
    start = new Date(Date.parse(end + "T12:00:00Z") - 7 * 86400000).toISOString().slice(0, 10);
  } else if (preferences.reportCadence === "monthly") {
    end = today.slice(0, 7) + "-01";
    const previous = new Date(end + "T12:00:00Z");
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    start = previous.toISOString().slice(0, 10);
  } else start = new Date(day.getTime() - 86400000).toISOString().slice(0, 10);
  const due = localDateTimeToUtc(
    end,
    preferences.startHour * 60,
    preferences.timeZone,
  ).toISOString();
  return Date.parse(due) <= now.getTime() ? { start, end, due } : null;
}
export function buildFarmDigest(
  book: FarmBook,
  p: { start: string; end: string },
  asOf: string,
): string {
  const inside = (day: string) => day >= p.start && day < p.end;
  const endDay = new Date(Date.parse(p.end + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const ledger = ledgerForTotals(book.ledger, p.start, endDay);
  const income = ledger
      .filter((e) => e.direction === "income")
      .reduce((s, e) => s + e.amountCents, 0),
    expense = ledger
      .filter((e) => e.direction === "expense")
      .reduce((s, e) => s + e.amountCents, 0);
  const weights = book.animals.flatMap((a) => a.weights.filter((w) => inside(w.date)));
  const records = book.records.filter((r) => inside(r.date));
  const cash = (v: number) =>
    (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${book.name ?? "Propriedade sem nome"} — resumo de ${p.start.split("-").reverse().join("/")} a ${new Date(Date.parse(p.end + "T12:00:00Z") - 86400000).toLocaleDateString("pt-BR", { timeZone: "UTC" })}.\n${weights.filter((w) => !w.estimated).length} pesagens informadas e ${weights.filter((w) => w.estimated).length} estimadas; ${records.length} anotações de campo; ${records.filter((r) => r.type === "birth").reduce((s, r) => s + (r.count ?? 0), 0)} nascimentos com quantidade informada.\nReceitas: ${cash(income)}; despesas: ${cash(expense)}; saldo dos lançamentos: ${cash(income - expense)} (não é lucro líquido).\nTarefas pendentes no momento da geração: ${book.tasks.filter((t) => t.status === "open").length}.\nSomente registros confirmados do caderno; sem registros não significa ausência de atividade. Gerado em ${new Date(asOf).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Para detalhes, peça “relatório da fazenda” ou consulte seu painel.`;
}
export function reportEvent(
  book: FarmBook,
  prefs: GuardianPreferences,
  recipient: string,
  now = new Date(),
): GuardianEvent | null {
  const period = reportPeriod(prefs, now);
  if (!period) return null;
  return {
    type: "report",
    topic: "reports",
    key: `report:${prefs.reportCadence}:${period.start}:${period.end}`,
    recipient,
    notBefore: period.due,
    expiresAt: new Date(now.getTime() + 24 * 3600000).toISOString(),
    priority: 1,
    evidence: {
      start: period.start,
      end: period.end,
      generatedAt: now.toISOString(),
      cadence: prefs.reportCadence,
      scope: "selected_property",
    },
    message: buildFarmDigest(book, period, now.toISOString()),
  };
}
