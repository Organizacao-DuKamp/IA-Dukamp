export function productPlainText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])\s*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}
function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const HEADINGS =
  /^[ \t]*(?:niveis de garantia|indicacoes de uso|modo de us(?:ar|o)|restricoes[^\n:]*|composicao[^\n:]*|prazo de validade|condicoes de conservacao)(?:[ \t]*:[ \t]*|[ \t]*\n)/gm;
export function technicalProductSections(description: string): Record<string, string> {
  const plain = productPlainText(description);
  const matches = [...normalized(plain).matchAll(HEADINGS)];
  const sections: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][0].replace(/[:\s]+$/, "").trim();
    sections[heading] = plain
      .slice(matches[i].index! + matches[i][0].length, matches[i + 1]?.index ?? plain.length)
      .trim();
  }
  return sections;
}

/** Indicação, consumo e restrições vêm antes da tabela extensa de garantias. */
export function productTechnicalExcerpt(description: string, maxChars: number): string {
  const parts = technicalProductSections(description);
  const entries = Object.entries(parts);
  if (!entries.length) return productPlainText(description).slice(0, maxChars);
  const priority = (key: string) =>
    key.startsWith("indicacoes")
      ? 0
      : key.startsWith("modo")
        ? 1
        : key.startsWith("restricoes")
          ? 2
          : key.startsWith("composicao")
            ? 3
            : 4;
  const sections = entries.sort(([a], [b]) => priority(a) - priority(b));
  const usage = sections.find(([key]) => key.startsWith("modo"))?.[1] ?? "";
  const usageSentences = usage.split(/(?<=[.!?])\s+/);
  const consumption = usageSentences
    .filter((sentence) => /consumo|gramas.*(?:100 kg|peso)|propor[cç][aã]o.*gramas/i.test(sentence))
    .join(" ");
  const adaptation = usageSentences
    .filter((sentence) => /adapta[cç][aã]o|primeira semana|segunda semana/i.test(sentence))
    .join(" ");
  const warnings = productPlainText(description)
    .split(/\n|(?<=[.!?])\s+/)
    .filter((sentence) =>
      /\b(?:n[aã]o fornecer|contraindicado|contra-indicado|cochos cobertos|menos de 4 meses)\b/i.test(
        sentence,
      ),
    );
  const indication = sections
    .filter(([key]) => priority(key) === 0)
    .map(([key, value]) => `${key}: ${value.slice(0, 550)}`);
  const safety = warnings.length
    ? `Cuidados do rótulo: ${[...new Set(warnings)].join(" ").slice(0, 900)}`
    : "";
  return [
    ...indication,
    consumption ? `Consumo do rótulo: ${consumption.slice(0, 800)}` : "",
    adaptation ? `Adaptação do rótulo: ${adaptation.slice(0, 700)}` : "",
    safety,
    ...sections
      .filter(([key]) => priority(key) === 1 || priority(key) === 2)
      .map(([key, value]) => `${key}: ${value.slice(0, 600)}`),
    ...sections.filter(([key]) => priority(key) > 2).map(([key, value]) => `${key}: ${value}`),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, maxChars);
}
