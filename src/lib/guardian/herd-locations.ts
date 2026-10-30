import type { FarmBook, Provenance } from "./schema.ts";
import type { Operations, OperationsAction } from "./operations.ts";

const incoming = (type: string) => ["birth", "purchase", "transfer_in"].includes(type);
const key = (species: string, lot?: string) => JSON.stringify([species, lot ?? null]);

/** A collective arrival is a real, referencable group, not fictitious animal IDs.
 * Availability is conservative: unassigned later departures may concern this
 * group, and a later census alone cannot establish its continued identity. */
export function herdGroupsAt(
  operations: Operations,
  date: string,
  options: { movementId?: string; limit?: number } = {},
) {
  const replaced = new Set(operations.movements.map((m) => m.replaces).filter(Boolean));
  const active = operations.movements.filter((m) => !replaced.has(m.id) && m.date <= date);
  const activeIds = new Set(active.map((m) => m.id));
  const latestCounts = new Map<string, string>();
  for (const c of operations.counts) {
    const scope = key(c.species ?? "cattle", c.lot);
    if (c.date <= date && c.date > (latestCounts.get(scope) ?? "")) latestCounts.set(scope, c.date);
  }
  const departures = new Map<string, Array<{ order: string; total: number; count: number }>>();
  for (const m of active.filter((m) => !incoming(m.type))) {
    const scope = key(m.species ?? "cattle", m.lot),
      rows = departures.get(scope) ?? [];
    rows.push({ order: m.date + ":" + m.source.at, count: m.count, total: 0 });
    departures.set(scope, rows);
  }
  for (const rows of departures.values()) {
    rows.sort((a, b) => a.order.localeCompare(b.order));
    let total = 0;
    for (const row of rows) row.total = total += row.count;
  }
  const departingAfter = (scope: string, order: string) => {
    const rows = departures.get(scope) ?? [];
    let lo = 0,
      hi = rows.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (rows[mid].order < order) lo = mid + 1;
      else hi = mid;
    }
    return (rows.at(-1)?.total ?? 0) - (rows[lo - 1]?.total ?? 0);
  };
  const transfersByGroup = new Map<string, NonNullable<Operations["lotTransfers"]>>();
  for (const t of operations.lotTransfers ?? []) {
    if (t.date > date) continue;
    const rows = transfersByGroup.get(t.movementId) ?? [];
    rows.push(t);
    transfersByGroup.set(t.movementId, rows);
  }
  let groups = active.filter(
    (m) =>
      incoming(m.type) &&
      // The incoming half of the legacy quantitative transfer is not a new group.
      !(
        m.type === "transfer_in" &&
        m.id.endsWith("-in") &&
        activeIds.has(m.id.slice(0, -3) + "-out")
      ),
  );
  if (options.movementId) groups = groups.filter((g) => g.id === options.movementId);
  if (options.limit) groups = groups.slice(-options.limit);
  return groups.map((group) => {
    const placement = operations.lotPlacements
      ?.filter(
        (p) =>
          p.species === (group.species ?? "cattle") &&
          p.date <= date &&
          p.includedMovements.includes(group.id),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))
      .at(-1);
    const positions = new Map<string | undefined, number>([
      [placement?.to ?? group.lot, group.count],
    ]);
    const transfers = (transfersByGroup.get(group.id) ?? [])
      .filter((t) => !placement?.includedTransfers.includes(t.id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at));
    for (const t of transfers) {
      positions.set(t.from, (positions.get(t.from) ?? 0) - t.count);
      positions.set(t.to, (positions.get(t.to) ?? 0) + t.count);
    }
    const species = group.species ?? "cattle";
    const locations = [...positions].flatMap(([lot, count]) => {
      if (count <= 0) return [];
      const recounted =
        (latestCounts.get(key(species)) ?? "") >= group.date ||
        (!!lot && (latestCounts.get(key(species, lot)) ?? "") >= group.date);
      const order = group.date + ":" + group.source.at;
      const departed =
        departingAfter(key(species), order) + (lot ? departingAfter(key(species, lot), order) : 0);
      return [
        {
          ...(lot ? { lot } : {}),
          count,
          available: recounted ? 0 : Math.max(0, count - departed),
        },
      ];
    });
    return {
      movementId: group.id,
      species,
      date: group.date,
      description: group.description,
      locations,
    };
  });
}

export function applyGroupedLotTransfer(
  book: FarmBook,
  action: Extract<OperationsAction, { kind: "lot_transfer" }>,
  source: Provenance,
  id: string,
) {
  const operations = book.operations!;
  const group = herdGroupsAt(operations, action.date, { movementId: action.movementId })[0];
  if (!group) throw Error("Não encontrei esse grupo de animais disponível nesta fazenda.");
  if (action.species && group.species !== action.species)
    throw Error("A espécie precisa corresponder ao grupo de origem.");
  if (action.from === action.to) throw Error("Escolha lotes diferentes para a transferência.");
  const transfers = (operations.lotTransfers ??= []);
  if (transfers.some((t) => t.movementId === group.movementId && t.date > action.date))
    throw Error(
      "Esse grupo já tem movimentação posterior. Confira a data antes de alterar sua localização.",
    );
  const position = group.locations.find((p) => p.lot === action.from);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(source.at),
  );
  const current = herdGroupsAt(operations, today, {
    movementId: group.movementId,
  })[0]?.locations.find((p) => p.lot === action.from);
  if (
    !position ||
    position.available < action.count ||
    !current ||
    current.available < action.count
  )
    throw Error(
      "O grupo não tem essa quantidade disponível na origem informada. Confira o grupo e o lote; não estime uma contagem.",
    );
  // Same-day snapshots are end-of-day declarations, not an opening to move again.
  if (
    operations.counts.some(
      (c) =>
        c.date === action.date &&
        (c.species ?? "cattle") === group.species &&
        (c.lot === action.to || (action.from && c.lot === action.from)),
    )
  )
    throw Error(
      "Há uma contagem de fim do dia nesse lote. Confira a data ou revise a contagem antes de movimentar o grupo.",
    );
  const known =
    operations.lots.some((l) => l.name === action.to) ||
    operations.counts.some((c) => c.lot === action.to) ||
    operations.movements.some((m) => m.lot === action.to) ||
    book.animals.some((a) => a.lot === action.to) ||
    transfers.some((t) => t.from === action.to || t.to === action.to);
  if (!known && !action.createDestination)
    throw Error(`O lote ${action.to} ainda não existe. Posso criá-lo para receber esse grupo?`);
  if (!operations.lots.some((l) => l.name === action.to)) {
    if (operations.lots.length >= 1000) throw Error("O volume atingiu o limite técnico de lotes.");
    operations.lots.push({ name: action.to, ...(!known ? { openedOn: action.date } : {}) });
  }
  if (transfers.length >= 10000)
    throw Error("O volume atingiu o limite técnico de transferências.");
  transfers.push({
    id,
    movementId: group.movementId,
    ...(action.from ? { from: action.from } : {}),
    to: action.to,
    count: action.count,
    date: action.date,
    source,
  });
}
