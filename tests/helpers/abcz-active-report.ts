import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import type { ReportText } from "../../src/lib/guardian/abcz-report.ts";

// Synthetic, anonymized reproduction of the rotated JasperReports eight-column layout.
export function reportItems(count: number, first = 1, page = 1): ReportText[] {
  const headerY = page === 1 ? 160 : 35;
  const items: ReportText[] = [
    ...(page === 1 ? [{ text: "RELATÓRIO DE PRODUTOS ATIVOS", x: 280, y: 60 }] : []),
    ...Object.entries({
      RG: 61.14,
      Nome: 189.53,
      Sexo: 294.08,
      "Dt. Nasc.": 329.56,
      Pai: 435.51,
      Mãe: 558.11,
      Receptora: 655.44,
      Status: 759.88,
    }).map(([text, x]) => ({ text, x, y: headerY })),
    { text: "Sistema de Genealogia - Impresso em: 06/11/2026", x: 22, y: 580 },
    { text: `Página ${page}`, x: 780, y: 580 },
  ];
  if (page === 1)
    items.push(
      { text: "Criador:", x: 22, y: 85 },
      { text: "999 - CRIADOR EXEMPLO", x: 90, y: 85 },
      { text: "Fazenda:", x: 22, y: 107 },
      { text: "1 - FAZENDA DO DOCUMENTO", x: 90, y: 107 },
      { text: "Raça:", x: 300, y: 130 },
      { text: "5 - NELORE", x: 340, y: 130 },
      { text: "Categoria:", x: 547, y: 130 },
      { text: "1 - PURO DE ORIGEM", x: 620, y: 130 },
    );
  for (let i = 0; i < count; i++) {
    const n = first + i,
      y = headerY + 15 + i * 14;
    items.push(
      // Separate text fragments are intentional, as in the producer's report.
      { text: "TEST", x: 42, y },
      { text: String(n), x: 80, y },
      { text: `ANIMAL EXEMPLO ${n}`, x: 122, y },
      { text: n % 2 ? "F" : "M", x: 298, y },
      { text: "15/07/2024", x: 331, y },
      { text: "NEL/PO PAI", x: 400, y },
      { text: "101", x: 465, y },
      { text: "NEL/PO MAE", x: 515, y },
      { text: "202", x: 580, y },
      { text: i % 3 ? "RG D" : "Pendente", x: 747, y },
    );
    if (i % 4 === 0) items.push({ text: "RECEPTORA 1", x: 638, y });
  }
  return items;
}
export async function activeReportPdf(counts = [25, ...Array<number>(11).fill(34), 20]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let first = 1;
  counts.forEach((count, i) => {
    const page = pdf.addPage([595, 842]);
    page.setRotation(degrees(90));
    for (const item of reportItems(count, first, i + 1))
      page.drawText(item.text, { x: item.y, y: item.x, rotate: degrees(90), font, size: 6 });
    first += count;
  });
  return pdf.save();
}
