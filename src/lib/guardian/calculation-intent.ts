import { CalculationInput, type Calculation } from "./calculators.ts";

function number(raw: string): number {
  return Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
}
/** Conservative grammar: calculations must have explicit units and all indispensable inputs. */
export function parseCalculation(raw: string, previous?: Calculation): Calculation | null {
  const t = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(?:dose|medicamento|recomende|recomenda|dieta|exigencia nutricional|formule)\b/.test(t))
    return null;
  const repeat = t.match(
    /^(?:faz|faca) (?:o )?mesmo (?:para|pra) (\d+)(?: animais| cabecas)?[.!? ]*$/,
  );
  if (repeat && previous && (previous.kind === "feeding" || previous.kind === "scenario")) {
    const parsed = CalculationInput.safeParse({ ...previous, heads: Number(repeat[1]) });
    return parsed.success ? parsed.data : null;
  }
  const gmd = t.match(
    /^(?:calcule |calcular |qual (?:e |foi )?o )?(?:gmd|ganho medio diario)(?: de|:)?\s*([\d.,]+)\s*kg\s*(?:para|a|ate|→|e)\s*([\d.,]+)\s*kg\s*(?:em|durante|por)\s*(\d+)\s*dias?[.!? ]*$/,
  );
  if (gmd) {
    const parsed = CalculationInput.safeParse({
      kind: "gmd",
      initialKg: number(gmd[1]),
      finalKg: number(gmd[2]),
      days: Number(gmd[3]),
    });
    return parsed.success ? parsed.data : null;
  }
  const feeding = t.match(
    /^(?:simular alimentacao|calcular alimentacao|custo de alimentacao)(?::| de)?\s*(\d+)\s*(?:animais|cabecas)\s*[,;]?\s*([\d.,]+)\s*kg\s*(?:por cabeca por dia|\/cabeca\/dia|por animal por dia)\s*[,;]?\s*(?:por |durante |em )?(\d+)\s*dias\s*[,;]?\s*(?:a |por )?(?:r\$\s*)?([\d.,]+)\s*(?:reais por kg|r\$\/kg|\/kg)[.!? ]*$/,
  );
  if (feeding) {
    const parsed = CalculationInput.safeParse({
      kind: "feeding",
      heads: Number(feeding[1]),
      kgPerHeadDay: number(feeding[2]),
      days: Number(feeding[3]),
      pricePerKg: number(feeding[4]),
    });
    return parsed.success ? parsed.data : null;
  }
  return null;
}
