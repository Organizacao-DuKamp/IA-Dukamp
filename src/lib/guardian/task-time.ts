import { cardinal, foldHerd } from "./herd-language.ts";

/** Normalize only an explicit clock, never cattle quantities or dates. */
export function normalizeTaskClock(text: string): string {
  return foldHerd(text).replace(
    /\b(?:as|a|a partir das)\s+(\d{1,2}|uma?|duas?|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze)(?:(?::(\d{2})|h(\d{2})?)|\s+(?:horas?\s+)?e\s+(meia|quinze|trinta|quarenta e cinco))?(?:\s+horas?)?(?:\s+da\s+(manha|tarde|noite|madrugada))?\b/g,
    (whole, hour: string, colon: string, h: string, spoken: string, period: string) => {
      let value = cardinal(hour);
      if (value === null) return whole;
      const minute =
        colon ??
        h ??
        (
          { meia: "30", quinze: "15", trinta: "30", "quarenta e cinco": "45" } as Record<
            string,
            string
          >
        )[spoken] ??
        "00";
      if (value >= 1 && value <= 11 && (period === "tarde" || period === "noite")) value += 12;
      if (value === 12 && (period === "madrugada" || period === "manha")) value = 0;
      return `as ${value}:${minute}`;
    },
  );
}
