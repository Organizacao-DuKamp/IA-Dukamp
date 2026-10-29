import { foldHerd } from "./herd-language.ts";
import type { GuardianSnapshot } from "./schema.ts";

/** Resolve only names/IDs from the authenticated sender's memberships. Similar
 * names are useful for speech, but tied/plausible alternatives require a choice. */
export function propertyKey(value: string) {
  return foldHerd(value)
    .replace(/\b(?:fazenda|estancia|sitio|chacara|propriedade)\b/g, " ")
    .replace(/[^\p{L}\d]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function propertyDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}
export function resolveProperty(reference: string | null, snapshot: GuardianSnapshot) {
  const properties = snapshot.properties;
  if (!reference) return { status: "missing" as const, choices: properties };
  const byId = properties.find((p) => p.id === reference);
  if (byId) return { status: "resolved" as const, property: byId, approximate: false };
  // An unknown ID is not a misspelled farm name.
  if (/^[a-f\d]{8}-[a-f\d-]{27,}$/i.test(reference))
    return { status: "missing" as const, choices: properties };
  const key = propertyKey(reference);
  if (!key) return { status: "missing" as const, choices: properties };
  const exact = properties.filter((p) => propertyKey(p.name) === key);
  if (exact.length === 1)
    return { status: "resolved" as const, property: exact[0], approximate: false };
  if (exact.length > 1) return { status: "ambiguous" as const, choices: exact };
  const aliases = snapshot.active?.book.operations?.aliases ?? [];
  if (snapshot.active && aliases.some((a) => propertyKey(a) === key)) {
    const p = properties.find((p) => p.id === snapshot.active!.id);
    if (p) return { status: "resolved" as const, property: p, approximate: false };
  }
  const plausible = properties
    .map((p) => ({ property: p, distance: propertyDistance(key, propertyKey(p.name)) }))
    .filter(
      (p) =>
        key.length >= 4 &&
        p.distance <= (key.length >= 6 ? 2 : 1) &&
        p.distance / Math.max(key.length, propertyKey(p.property.name).length) <= 0.3,
    )
    .sort((a, b) => a.distance - b.distance);
  if (plausible.length === 1)
    return { status: "resolved" as const, property: plausible[0].property, approximate: true };
  if (plausible.length > 1)
    return { status: "ambiguous" as const, choices: plausible.map((p) => p.property) };
  return { status: "missing" as const, choices: properties };
}

/** Resolve only explicit names among the sender's authorized memberships. */
export function namedProperty(text: string, snapshot: GuardianSnapshot) {
  const t = foldHerd(text).replace(/[.!?]+$/, "");
  if (
    /\b(?:transferir|transfira|transferi|transferimos)\b[\s\S]*\bpara\b[\s\S]*\bfazenda\b/.test(t)
  )
    return null;
  if (/\b(?:vizinho|disse|suponha|simule|hipotetic|nao quero|fazenda dele|fazenda dela)\b/.test(t))
    return null;
  const candidates = snapshot.properties.filter((p) => {
    const name = foldHerd(p.name);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      t === name ||
      new RegExp(
        `\\b(?:fazenda|propriedade|sitio|chacara)\\s+${escaped}(?=$|[^\\p{L}\\d_-])`,
        "u",
      ).test(t)
    );
  });
  return candidates.length === 1 ? candidates[0] : null;
}
