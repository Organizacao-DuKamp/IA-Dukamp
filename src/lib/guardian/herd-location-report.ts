import { herdGroupsAt } from "./herd-locations.ts";
import { stockAt, speciesNames, type FarmSpecies } from "./operations.ts";
import type { FarmBook } from "./schema.ts";

/** Current location is a projection of the whole book, never the lot printed on
 * an old arrival. Identified animals can overlap groups and are not added twice. */
export function herdLocationReport(book: FarmBook, date: string) {
  const operations = book.operations ?? { counts: [], movements: [], lots: [] };
  const animals = book.animals.filter((a) => !a.status || a.status === "active");
  const groups = herdGroupsAt(operations, date);
  const species = [
    ...new Set<FarmSpecies>([
      ...operations.counts.filter((c) => c.date <= date).map((c) => c.species ?? "cattle"),
      ...operations.movements.filter((m) => m.date <= date).map((m) => m.species ?? "cattle"),
      ...(animals.length ? ["cattle" as const] : []),
    ]),
  ];
  const lots = [
    ...new Set([
      ...operations.lots.map((l) => l.name),
      ...operations.counts.flatMap((c) => (c.date <= date && c.lot ? [c.lot] : [])),
      ...operations.movements.flatMap((m) => (m.date <= date && m.lot ? [m.lot] : [])),
      ...(operations.lotPlacements ?? []).flatMap((p) => (p.date <= date ? [p.to] : [])),
      ...(operations.lotTransfers ?? []).flatMap((t) =>
        t.date <= date ? [t.to, ...(t.from ? [t.from] : [])] : [],
      ),
      ...animals.flatMap((a) => (a.lot ? [a.lot] : [])),
    ]),
  ];
  const rows = species.flatMap((kind) => {
    const positions = groups
      .filter((g) => g.species === kind)
      .flatMap((g) =>
        g.locations.map((p) => ({
          ...p,
          movementId: g.movementId,
          date: g.date,
          description: g.description,
        })),
      );
    const make = (lot: string | null, count: number | null) => {
      const currentGroups = positions.filter((p) => (p.lot ?? null) === lot && p.available > 0);
      const codes =
        kind === "cattle" ? animals.filter((a) => (a.lot ?? null) === lot).map((a) => a.code) : [];
      return {
        species: kind,
        label: speciesNames[kind],
        lot,
        count,
        registered: Math.max(
          codes.length,
          currentGroups.reduce((n, p) => n + p.available, 0),
        ),
        codes,
        groups: currentGroups.map((p) => ({
          movementId: p.movementId,
          count: p.available,
          date: p.date,
          description: p.description,
        })),
      };
    };
    const named = lots.map((lot) => make(lot, stockAt(operations, date, lot, kind).count));
    const total = stockAt(operations, date, undefined, kind).count;
    const assignedKnown = named.every((p) => p.count !== null);
    const remainder =
      total !== null && assignedKnown ? total - named.reduce((n, p) => n + p.count!, 0) : null;
    const placement = operations.lotPlacements
      ?.filter((p) => p.species === kind && p.date <= date)
      .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
      .at(-1);
    const newCensus =
      placement &&
      operations.counts.some(
        (c) =>
          !c.lot &&
          (c.species ?? "cattle") === kind &&
          c.date >= placement.date &&
          c.date <= date &&
          !placement.includedCounts.includes(c.id),
      );
    const unassigned = make(null, remainder !== null && remainder >= 0 ? remainder : null);
    // An explicit whole-herd placement establishes location even when the total
    // is unknown. A later arrival, census or unassigned active card reopens it.
    const laterArrival =
      placement &&
      operations.movements.some(
        (m) =>
          !m.lot &&
          (m.species ?? "cattle") === kind &&
          ["birth", "purchase", "transfer_in"].includes(m.type) &&
          m.date >= placement.date &&
          m.date <= date &&
          !placement.includedMovements.includes(m.id),
      );
    if (placement && !newCensus && !laterArrival && !unassigned.registered) unassigned.count = 0;
    return [...named.filter((p) => p.count !== 0 || p.registered > 0), unassigned];
  });
  return {
    date,
    locations: rows.filter((p) => p.lot !== null),
    unassigned: rows.filter((p) => p.lot === null),
    hasUnassigned: rows.some((p) => p.lot === null && (p.registered > 0 || (p.count ?? 0) > 0))
      ? true
      : rows.some((p) => p.lot === null && p.count === null)
        ? null
        : false,
  };
}

export function describeHerdLocations(book: FarmBook, date: string, lot?: string) {
  const report = herdLocationReport(book, date);
  const locations = [...report.locations, ...report.unassigned].filter(
    (p) => (lot === undefined || p.lot === lot) && (p.count !== 0 || p.registered > 0),
  );
  const lines = locations
    .slice(0, 40)
    .map(
      (p) =>
        `• ${p.label}: ${p.count === null ? `${p.registered ? `${p.registered} com localização registrada` : "quantidade ainda não informada"}; total da espécie ainda não confirmado` : p.count} — ${p.lot ? `lote ${p.lot}` : "sem lote definido"}.`,
    );
  return `Conferi a localização atual no painel de ${book.name ?? "sua fazenda"} em ${date.split("-").reverse().join("/")}:\n${lines.join("\n") || (lot ? `Não há saldo ou grupo localizado no lote ${lot}.` : "Ainda não há localização registrada.")}${report.hasUnassigned === false ? "\nNão encontrei grupos ou fichas ativas pendentes de lote. As entradas antigas do histórico preservam o lote informado na época; elas não indicam a localização atual." : report.hasUnassigned === null ? "\nParte da distribuição ainda não está confirmada; não estimei quantidades." : "\nHá animais ou grupos sem lote definido, conforme indicado acima."}\nEsta foi uma conferência dos registros atuais; não repeti compras, nascimentos ou movimentações.`;
}

/** Keep totals and pending-location status from the full projection, bounding
 * only the detail sent to the interpreter. Execution/inspection uses full data. */
export function herdLocationContext(book: FarmBook, date: string) {
  const report = herdLocationReport(book, date);
  const clip = (row: (typeof report.locations)[number]) => ({
    ...row,
    codes: row.codes.slice(-30),
    groups: row.groups.slice(-20),
  });
  return {
    ...report,
    collectionsArePartial: true as const,
    locations: report.locations.slice(-30).map(clip),
    unassigned: report.unassigned.map(clip),
  };
}

export function herdLocationRequest(raw: string) {
  const text = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (
    /^\s*(?:nao (?:quero|mova|coloque)|se |como |suponha )|\b(?:meu vizinho|hipotetico|exemplo)\b/.test(
      text,
    )
  )
    return false;
  return (
    /\b(?:mov|colo(?:c|qu)|transf(?:er|ir)|lev|mud|pass)[a-z]*\b/.test(text) &&
    /\b(?:animais|gado|bovinos|aves|suinos|ovinos|lote|pasto|piquete)\b/.test(text)
  );
}
