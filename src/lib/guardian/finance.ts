import type { LedgerEntry } from "./schema.ts";

function coverageEnd(e: LedgerEntry) {
  if (!e.periodMonth || e.periodMonth >= e.date.slice(0, 7)) return e.date;
  const [year, month] = e.periodMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** A declared monthly total includes its itemized entries, never adds to them.
 * Keep all source entries; only the latest total per month/direction/scope counts.
 * A monthly total cannot be apportioned into a day or week without evidence.
 */
export function ledgerForTotals(entries: LedgerEntry[], start = "", end = "9999-12-31") {
  const totals = new Map<string, LedgerEntry>();
  const key = (e: LedgerEntry, month = e.periodMonth) => `${month}:${e.direction}:${e.lot ?? ""}`;
  for (const e of entries) {
    if (!e.periodMonth || coverageEnd(e) > end) continue;
    const prior = totals.get(key(e));
    if (!prior || (prior.source.sourceAt ?? prior.source.at) <= (e.source.sourceAt ?? e.source.at))
      totals.set(key(e), e);
  }
  return entries.filter((e) => {
    if (e.periodMonth)
      return (
        totals.get(key(e)) === e &&
        e.periodMonth + "-01" >= start &&
        coverageEnd(e) <= end &&
        (!e.lot || !totals.has(`${e.periodMonth}:${e.direction}:`))
      );
    if (e.date < start || e.date > end) return false;
    // A whole-farm total also covers individually identified lots.
    const total =
      totals.get(key(e, e.date.slice(0, 7))) ?? totals.get(`${e.date.slice(0, 7)}:${e.direction}:`);
    return !total || e.date > coverageEnd(total);
  });
}

export function ledgerPeriod(entry: Pick<LedgerEntry, "date" | "periodMonth" | "estimated">) {
  const period = entry.periodMonth
    ? `${entry.periodMonth.slice(5)}/${entry.periodMonth.slice(0, 4)} (total informado)`
    : entry.date.split("-").reverse().join("/");
  return period + (entry.estimated ? " — estimado" : "");
}
