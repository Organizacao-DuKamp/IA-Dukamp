import { stockAt, emptyOperations, speciesNames, type FarmSpecies } from "./operations.ts";
import { herdLocationReport } from "./herd-location-report.ts";
import { managementEntries } from "./management.ts";
import type { FarmBook } from "./schema.ts";

/** Read-only projection. Census totals and identified cards can overlap and are
 * never summed; only explicit lot/paddock links establish a lot's location. */
export function paddockBoard(book: FarmBook, date: string) {
  const report = herdLocationReport(book, date);
  const paddocks = managementEntries(book, "pasture");
  const links = new Map<string, Set<string>>();
  for (const entry of paddocks) {
    if (!entry.values.name || !entry.values.lot) continue;
    const names = links.get(entry.values.lot) ?? new Set<string>();
    names.add(entry.values.name);
    links.set(entry.values.lot, names);
  }
  const definitions = new Map((book.operations?.lots ?? []).map((lot) => [lot.name, lot]));
  const byCode = new Map(book.animals.map((animal) => [animal.code, animal]));
  const names = new Set([
    ...definitions.keys(),
    ...report.locations.flatMap((row) => (row.lot ? [row.lot] : [])),
  ]);
  const lot = (name: string | null) => {
    const rows = (
      name === null ? report.unassigned : report.locations.filter((row) => row.lot === name)
    ).filter((row) => row.count !== 0 || row.registered > 0);
    const codes = [...new Set(rows.flatMap((row) => row.codes))];
    const animals = codes.flatMap((code) => (byCode.has(code) ? [byCode.get(code)!] : []));
    const cattle = rows.find((row) => row.species === "cattle");
    // The quantity belongs to the census/group; identified cards occupy slots
    // in that quantity. Virtual drafts are never inserted into book.animals.
    const expected = cattle ? Math.max(cattle.count ?? 0, cattle.registered) : 0;
    return {
      key: name === null ? "unassigned" : `lot:${name}`,
      name,
      rows,
      animals,
      unidentified: Math.max(0, expected - animals.length),
    };
  };
  type Lot = ReturnType<typeof lot>;
  const groups = new Map<string, { key: string; name: string | null; lots: Lot[] }>();
  const group = (name: string | null) => {
    const key = name === null ? "unassigned" : `paddock:${name}`;
    if (!groups.has(key)) groups.set(key, { key, name, lots: [] });
    return groups.get(key)!;
  };
  for (const entry of paddocks) if (entry.values.name) group(entry.values.name);
  for (const definition of definitions.values()) if (definition.pasture) group(definition.pasture);
  for (const name of names) {
    const explicit = definitions.get(name)?.pasture;
    const candidates = [...(links.get(name) ?? [])];
    group(explicit || (candidates.length === 1 ? candidates[0] : null)).lots.push(lot(name));
  }
  const unassigned = lot(null);
  if (unassigned.rows.length) group(null).lots.push(unassigned);
  const compare = (a: string | null, b: string | null) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b, "pt-BR", { numeric: true });
  const ordered = [...groups.values()]
    .sort((a, b) => compare(a.name, b.name))
    .map((p) => ({ ...p, lots: p.lots.sort((a, b) => compare(a.name, b.name)) }));
  let nextDraftNumber = 1;
  return ordered.map((paddock) => ({
    ...paddock,
    lots: paddock.lots.map((entry) => {
      const draftStart = nextDraftNumber;
      nextDraftNumber += entry.unidentified;
      return { ...entry, draftStart };
    }),
  }));
}
export type PaddockView = ReturnType<typeof paddockBoard>[number];

/** Dashboard-only totals: do not scan millions of individual weight records to
 * render the three herd tiles. Historical indicators remain in operations.ts. */
export function herdOverview(book: FarmBook, date: string) {
  const operations = book.operations ?? emptyOperations();
  const start = date.slice(0, 7) + "-01";
  const replaced = new Set(operations.movements.flatMap((m) => (m.replaces ? [m.replaces] : [])));
  let births = 0,
    deaths = 0;
  for (const m of operations.movements) {
    if (
      replaced.has(m.id) ||
      (m.species ?? "cattle") !== "cattle" ||
      m.date < start ||
      m.date > date
    )
      continue;
    if (m.type === "birth") births += m.count;
    if (m.type === "death") deaths += m.count;
  }
  const species = new Set<FarmSpecies>([
    "cattle",
    ...operations.counts.map((c) => c.species ?? "cattle"),
    ...operations.movements.map((m) => m.species ?? "cattle"),
  ]);
  const stock = stockAt(operations, date);
  const stocksBySpecies = [...species].flatMap((kind) => {
    const count =
      kind === "cattle" ? stock.count : stockAt(operations, date, undefined, kind).count;
    return count === null ? [] : [{ species: kind, label: speciesNames[kind], count }];
  });
  return { stock, births, deaths, stocksBySpecies };
}
