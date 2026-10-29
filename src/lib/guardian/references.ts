import { cardinal, foldHerd } from "./herd-language.ts";
import type { FarmBook, GuardianAction } from "./schema.ts";
function lotKey(value: string) {
  const text = foldHerd(value).replace(/^lote\s+/u, "");
  // Real identifiers may have meaningful leading zeros.
  if (/^\d+$/.test(text)) return text;
  const number = cardinal(text);
  return number === null ? text : String(number);
}
/** Resolve labels against real records before accepting a new label. Exact
 * registered names win; competing equivalent labels require clarification. */
export function resolveLotReference(reference: string, book: FarmBook): string {
  const known = [
    ...new Set([
      ...(book.operations?.lots.map((l) => l.name) ?? []),
      ...(book.operations?.counts.flatMap((c) => (c.lot ? [c.lot] : [])) ?? []),
      ...(book.operations?.movements.flatMap((m) => (m.lot ? [m.lot] : [])) ?? []),
      ...(book.operations?.lotTransfers?.flatMap((t) => [t.to, ...(t.from ? [t.from] : [])]) ?? []),
      ...book.animals.flatMap((a) => (a.lot ? [a.lot] : [])),
    ]),
  ];
  const exact = known.filter((name) => foldHerd(name) === foldHerd(reference));
  if (exact.length === 1) return exact[0];
  const matches = known.filter((name) => lotKey(name) === lotKey(reference));
  if (matches.length > 1)
    throw Error(
      "Há mais de um lote com referência equivalente. Informe o nome cadastrado completo.",
    );
  if (matches.length === 1) return matches[0];
  const stripped = reference.trim().replace(/^lote\s+/iu, "");
  const number = cardinal(stripped);
  return /^\d+$/.test(stripped) ? stripped : number === null ? stripped : String(number);
}
export function resolveActionReferences(action: GuardianAction, book: FarmBook): GuardianAction {
  if (action.kind === "lot_transfer")
    return {
      ...action,
      ...(action.from ? { from: resolveLotReference(action.from, book) } : {}),
      to: resolveLotReference(action.to, book),
    };
  if (action.kind === "property_transfer")
    return {
      ...action,
      ...(action.fromLot ? { fromLot: resolveLotReference(action.fromLot, book) } : {}),
      ...(action.toLot ? { toLot: action.toLot } : {}),
    };
  if (action.kind === "edit_record" && action.changes.lot)
    return {
      ...action,
      changes: { ...action.changes, lot: resolveLotReference(action.changes.lot, book) },
    };
  if ("lot" in action && typeof action.lot === "string")
    return { ...action, lot: resolveLotReference(action.lot, book) };
  return action;
}
