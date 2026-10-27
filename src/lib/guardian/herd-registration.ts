import { cardinal, foldHerd, herdStatement } from "./herd-language.ts";
import { cattleWords, eventDay, hasEventVerb } from "./herd-event-language.ts";
import type { HerdRegistrationDraft } from "./schema.ts";
import { localDay } from "../chat/context/recall.ts";

export function missingRegistrationField(text: string): "count" | "date" | null {
  const t = herdStatement(text);
  if (!hasEventVerb(t)) return null;
  // A single asserted event with an absent/unspecified quantity can be completed later.
  if (
    (t.match(/\b(?:nasceu|nasceram|morreu|morreram|comprei|compramos|vendi|vendemos)\b/gi)
      ?.length ?? 0) === 1 &&
    !new RegExp(`\\d+\\s+(?:novos?\\s+)?${cattleWords}\\b`, "iu").test(t)
  )
    return "count";
  return null;
}
export function registrationQuestion(missing: "count" | "date") {
  return missing === "count"
    ? "Quantos animais foram? Pode responder apenas a quantidade; vou manter os outros dados que você já informou. Ainda não salvei a movimentação."
    : "Em qual dia ocorreu? Pode responder “hoje”, “ontem” ou a data. Vou manter a quantidade e os outros dados já informados. Ainda não salvei a movimentação.";
}
export function registrationAnswer(
  text: string,
  draft: HerdRegistrationDraft,
  at: Date,
): string | null {
  const t = foldHerd(text)
    .replace(/[.!?]+$/g, "")
    .trim();
  if (draft.missing === "count") {
    const value = cardinal(
      t
        .replace(/^(?:foram|sao|foi|nasceram|nasceu)\s+/, "")
        .replace(new RegExp(`\\s+${cattleWords}$`, "iu"), ""),
    );
    if (!value || value > 1e7) return null;
    const original = herdStatement(draft.text);
    // Keep any original date explicit, including across a midnight/restart boundary.
    const day = eventDay(original, new Date(draft.sourceAt));
    const rebuilt = original.replace(
      /\b(nasceram|nasceu|morreram|morreu|comprei|compramos|vendi|vendemos)\s+(?:(?:mais|alguns|algumas|uns|umas|poucos|poucas|v[aá]rios|v[aá]rias|muitos|muitas)\s+)?/i,
      `$1 ${value} `,
    );
    return day.day
      ? rebuilt.replace(/\b(?:hoje|ontem|anteontem)\b/gi, day.day)
      : `${rebuilt} em ${localDay(new Date(draft.sourceAt))}`;
  }
  const day = eventDay(t.replace(/^foi\s+/, ""), at);
  if (!day.day || day.ambiguous || day.invalid) return null;
  const original = herdStatement(draft.text).replace(
    /\b(?:20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/20\d{2})?|hoje|ontem|anteontem|(?:na |nesta |essa |esta )?semana(?: passada)?|(?:no |nesse |neste )?m[eê]s(?: passado)?|antes|passad[oa])\b/gi,
    "",
  );
  return `${original} em ${day.day}`;
}
