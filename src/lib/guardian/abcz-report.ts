import { fold } from "./book.ts";
import type { ImportProfile } from "./imports.ts";
export interface ReportText {
  text: string;
  x: number;
  y: number;
}
export interface ReportMetadata {
  breed?: string;
  category?: string;
  documentBreeder?: string;
  documentFarm?: string;
}
export function abczReportMetadata(items: ReportText[]): ReportMetadata {
  const value = (label: string) => {
    const k = items.find((i) => fold(i.text) === label);
    return k
      ? items
          .filter((i) => Math.abs(i.y - k.y) < 2 && i.x > k.x + 15)
          .sort((a, b) => a.x - b.x)[0]
          ?.text.replace(/^\d+\s*-\s*/, "")
          .trim()
      : undefined;
  };
  return {
    breed: value("raca:"),
    category: value("categoria:"),
    documentBreeder: value("criador:"),
    documentFarm: value("fazenda:"),
  };
}
export function isAbczReport(items: ReportText[]) {
  const labels = new Set(items.map((i) => fold(i.text)));
  return ["rg", "nome", "sexo", "dt. nasc.", "pai", "mae", "receptora", "status"].every((k) =>
    labels.has(k),
  );
}
/** Recognizes the eight JasperReports ABCZ columns. Positions are in displayed,
 * rotation-corrected page coordinates. Blank cells never shift adjacent values. */
export function parseAbczReport(
  items: ReportText[],
  width: number,
  height: number,
  metadata: ReportMetadata = {},
  page = 1,
): { profiles: ImportProfile[]; issues: string[] } | null {
  if (!isAbczReport(items)) return null;
  const scale = width / 842,
    header = items.find((i) => fold(i.text) === "rg")!;
  const expected: Record<string, number> = {
    rg: 61.14,
    nome: 189.53,
    sexo: 294.08,
    "dt. nasc.": 329.56,
    pai: 435.51,
    mae: 558.11,
    receptora: 655.44,
    status: 759.88,
  };
  if (
    Object.entries(expected).some(
      ([label, x]) =>
        !items.some(
          (i) =>
            fold(i.text) === label &&
            Math.abs(i.y - header.y) < 2 * scale &&
            Math.abs(i.x - x * scale) < 8 * scale,
        ),
    )
  )
    return null;
  const bounds = [20, 116, 276, 320, 385, 503, 625, 725, 822].map((x) => x * scale);
  const lines: Array<{ y: number; items: ReportText[] }> = [];
  for (const item of items
    .filter((i) => i.y > header.y + 4 * scale && i.y < height - 25 * scale)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    let line = lines.find((l) => Math.abs(l.y - item.y) < 1.5 * scale);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }
  const profiles: ImportProfile[] = [],
    issues: string[] = [];
  for (const line of lines) {
    const cells = Array.from({ length: 8 }, (_, column) =>
      line.items
        .filter((i) => i.x >= bounds[column] - 0.5 && i.x < bounds[column + 1] - 0.5)
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (!cells.some(Boolean)) continue;
    // A footer/subtotal is not a new animal. A malformed data row remains a review issue.
    if (/^(?:sistema de genealogia|pagina|total)\b/.test(fold(cells[0]))) continue;
    const [code, name, sex, date, sire, dam, receptor, status] = cells;
    if (
      !/^[A-Z][A-Z\d]*\s+[A-Z\d]+$/i.test(code) ||
      !name ||
      !/^[MF]$/.test(sex) ||
      !/^\d{2}\/\d{2}\/\d{4}$/.test(date)
    ) {
      issues.push(
        `Linha ${profiles.length + 1} da página ${page} não corresponde às colunas esperadas; confira esse trecho.`,
      );
    }
    const birth = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    profiles.push({
      ...Object.fromEntries(Object.entries(metadata).filter(([, v]) => v)),
      ...(code ? { code, registry: code } : {}),
      ...(name ? { name } : {}),
      sex: sex === "F" ? "female" : sex === "M" ? "male" : "unknown",
      ...(birth ? { birthDate: `${birth[3]}-${birth[2]}-${birth[1]}` } : {}),
      ...(sire ? { sire } : {}),
      ...(dam ? { dam } : {}),
      notes: [
        status ? `Situação do registro: ${status}` : "",
        receptor ? `Receptora: ${receptor}` : "",
      ]
        .filter(Boolean)
        .join(". "),
      documentSource: `Relatório de produtos ativos ABCZ · página ${page}`,
    });
  }
  if (!profiles.length) issues.push(`Nenhuma linha de animal foi identificada na página ${page}.`);
  return { profiles, issues };
}
