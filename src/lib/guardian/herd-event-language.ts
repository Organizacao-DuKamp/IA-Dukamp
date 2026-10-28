import { certainStatement } from "../whatsapp/learned-notes.ts";
import { recallPeriod } from "../chat/context/recall.ts";
import { foldHerd } from "./herd-language.ts";
import type { GuardianSnapshot } from "./schema.ts";

export const cattleWords =
  "(?:cabe[cç]as?(?: de gado)?|animais|animal|bovinos?|gados?|bois|boi|vacas?|bezerros?|bezerras?|novilhas?|novilhos?|touros?)";
const eventVerb = "(?:nasceram|nasceu|morreram|morreu|vendi|vendemos|comprei|compramos)";
const modifiers =
  "(?:(?:mais|outros?|outras?|novos?|novas?|aqui|hoje|ontem|anteontem|agora|mesmo|tamb[eé]m)\\s+)*";
const count = "(?:\\+\\s*)?(\\d{1,7})(?!\\d|[.,]\\d)";
const afterVerb = new RegExp(
  `\\b(${eventVerb})\\s+${modifiers}${count}\\s+(?:(?:novos?|novas?)\\s+)?${cattleWords}\\b`,
  "iu",
);
const beforeVerb = new RegExp(
  `\\b${count}\\s+(?:(?:novos?|novas?)\\s+)?${cattleWords}\\s+(?:(?:novos?|novas?|que|hoje|ontem|anteontem|mesmo|aqui|agora|tamb[eé]m)\\s+)*(${eventVerb})\\b`,
  "iu",
);
export const hasEventVerb = (text: string) => new RegExp(`\\b${eventVerb}\\b`, "iu").test(text);
export function certainHerdStatement(text: string) {
  return (
    certainStatement(text) &&
    !/\b(?:se|dizem|ouvi|soube|contaram|confirmar se|fazenda del[ea]|nao|n[aã]o)\b|["“”]/iu.test(
      text,
    )
  );
}
export function movementInClause(text: string, previousHerd: boolean) {
  const forward = text.match(afterVerb),
    reverse = text.match(beforeVerb);
  const match = forward ?? reverse;
  if (match) {
    const verb = (forward ? match[1] : match[2]).toLowerCase();
    return {
      type: verb.startsWith("nasc")
        ? ("birth" as const)
        : verb.startsWith("morr")
          ? ("death" as const)
          : verb.startsWith("vend")
            ? ("sale" as const)
            : ("purchase" as const),
      count: Number(forward ? match[2] : match[1]),
    };
  }
  // A bare quantity only inherits the immediately preceding cattle subject.
  const elliptical = previousHerd
    ? text.match(
        new RegExp(
          `^${modifiers}(${eventVerb})\\s+${modifiers}${count}(?:\\s+(?:hoje|ontem|anteontem|mesmo))*[.! ]*$`,
          "iu",
        ),
      )
    : null;
  if (!elliptical) return null;
  const verb = elliptical[1].toLowerCase();
  return {
    type: verb.startsWith("nasc")
      ? ("birth" as const)
      : verb.startsWith("morr")
        ? ("death" as const)
        : verb.startsWith("vend")
          ? ("sale" as const)
          : ("purchase" as const),
    count: Number(elliptical[2]),
  };
}
export function herdClauses(text: string) {
  return text
    .split(/(?<=[.!?;])\s+|\n+/u)
    .flatMap((sentence) =>
      sentence
        .split(
          new RegExp(
            `(?:,\\s*|\\s+(?:e|mas)\\s+)(?=${modifiers}(?:${eventVerb}\\b|[+\\d](?=[^.;!?\\n]*\\b${eventVerb}\\b)))`,
            "iu",
          ),
        )
        .map((quote) => ({ quote: quote.trim(), sentence })),
    )
    .filter(({ quote }) => quote);
}
export function eventDay(
  text: string,
  now: Date,
): { day?: string; ambiguous?: boolean; invalid?: boolean } {
  const iso = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)];
  if (
    iso.some(
      (m) =>
        !Number.isFinite(Date.parse(m[1])) || new Date(m[1]).toISOString().slice(0, 10) !== m[1],
    )
  )
    return { invalid: true };
  const period = recallPeriod(text, now);
  const calendar = [...text.matchAll(/\b\d{1,2}\/\d{1,2}(?:\/20\d{2})?\b/g)].map((m) =>
    recallPeriod(m[0], now),
  );
  if (calendar.some((p) => !p)) return { invalid: true };
  const mentions = text.match(/\b(?:hoje|ontem|anteontem)\b/gi) ?? [];
  const days = new Set([
    ...iso.map((m) => m[1]),
    ...mentions.map((m) => recallPeriod(m, now)!.startDay),
    ...calendar.map((p) => p!.startDay),
  ]);
  if (
    days.size > 1 ||
    (period && Date.parse(period.endDay) - Date.parse(period.startDay) !== 86400000) ||
    (!period &&
      !iso.length &&
      /\b(?:semanas?|m[eê]s|meses|anos?|antes|atr[aá]s|passad[oa]s?|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|dia\s+\d)\b/i.test(
        text,
      ))
  )
    return { ambiguous: true };
  return { day: [...days][0] ?? period?.startDay };
}
/** A scope check for the whole batch: don't infer a farm name from 'aqui/hoje'. */
export function farmScopeMatches(
  text: string,
  snapshot: GuardianSnapshot,
  _selectedJustNow: boolean,
) {
  if (!snapshot.active) return false;
  for (const match of text.matchAll(
    /\b(?:fazenda|propriedade|s[ií]tio|ch[aá]cara)\s+([^,.;!?\n]+)/giu,
  )) {
    const tail = foldHerd(match[1]);
    if (
      /^(?:hoje|ontem|anteontem|aqui|agora|ok|ta|tem|tenho|teve|possui|esta|estao|e|fica|localizada|no|na|em|com|para|pra|que|onde|nasceram|nasceu|comprei|compramos|vendi|vendemos|morreu|morreram)\b/.test(
        tail,
      ) ||
      new RegExp(`^\\d+\\s+${cattleWords}\\b`, "iu").test(tail)
    )
      continue;
    const matches = snapshot.properties.filter(
      (p) => tail === foldHerd(p.name) || tail.startsWith(foldHerd(p.name) + " "),
    );
    // An unnamed active farm can still be the only scope, but an invented name cannot.
    if (matches.length !== 1 || matches[0].id !== snapshot.active.id) return false;
  }
  // A persisted active selection remains the conversational scope between turns.
  // Every explicitly named property above must still match it.
  return true;
}
