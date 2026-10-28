import { cardinal, foldHerd } from "./herd-language.ts";

const clockSource = String.raw`(?<![\p{L}\d])(?:(?<lead>às?|as?|umas?|pelas?|por volta das?|cerca das?|a partir das)\s+)?(?<hour>\d{1,2}|uma?|duas?|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?: e (?:um|dois|tr[eê]s))?)(?:(?::(?<colon>\d{2})|(?<hourUnit>h)(?<h>\d{2})?)|\s+(?:horas?\s+)?e\s+(?<spoken>meia|quinze|trinta|quarenta e cinco))?(?:\s+(?<hours>horas?))?(?:\s+da\s+(?<period>manh[ãa]|tarde|noite|madrugada))?(?![\p{L}\d])`;
export function taskClocks(text: string) {
  return [...text.matchAll(new RegExp(clockSource, "giu"))]
    .filter((m) => {
      const g = m.groups!;
      return !!(g.lead || g.colon || g.hourUnit || g.spoken || g.hours || g.period);
    })
    .map((m) => {
      const g = m.groups!;
      let hour = cardinal(g.hour)!;
      const minute = Number(
        g.colon ??
          g.h ??
          ({ meia: 30, quinze: 15, trinta: 30, "quarenta e cinco": 45 } as Record<string, number>)[
            g.spoken
          ] ??
          0,
      );
      const period = g.period && foldHerd(g.period);
      if (hour >= 1 && hour <= 11 && (period === "tarde" || period === "noite")) hour += 12;
      if (hour === 12 && (period === "madrugada" || period === "manha")) hour = 0;
      return {
        text: m[0],
        index: m.index!,
        hour,
        minute,
        period,
        ambiguous: !period && !/^\d/.test(g.hour) && hour >= 1 && hour <= 12,
      };
    });
}
/** Only explicit clocks are normalized. Animal quantities and dates retain their meaning. */
export function normalizeTaskClock(text: string): string {
  let result = text;
  for (const c of taskClocks(text).reverse())
    result =
      result.slice(0, c.index) +
      `as ${c.hour}:${String(c.minute).padStart(2, "0")}` +
      result.slice(c.index + c.text.length);
  return foldHerd(result);
}
export function removeTaskClocks(text: string): string {
  let result = text;
  for (const c of taskClocks(text).reverse())
    result = result.slice(0, c.index) + " " + result.slice(c.index + c.text.length);
  return result;
}
