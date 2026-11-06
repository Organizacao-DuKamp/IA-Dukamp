import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ImportRow } from "./imports.ts";
export async function importPdf(rows: ImportRow[], farm: string) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const plain = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ");
  let page = pdf.addPage([842, 595]),
    y = 550,
    pageNumber = 1;
  const header = () => {
    page.drawText(plain(`Lista de animais - ${farm}`), { x: 25, y: 565, size: 14, font });
    page.drawText(
      `Identificacao                 Nome                                                 Sexo     Nascimento    Pagina origem`,
      { x: 25, y: 540, size: 10, font },
    );
    y = 520;
  };
  header();
  for (const r of rows) {
    if (y < 35) {
      page.drawText(`Pagina ${pageNumber++}`, { x: 760, y: 15, size: 9, font });
      page = pdf.addPage([842, 595]);
      header();
    }
    const values = [
      [25, r.profile.code ?? "Sem identificacao", 24],
      [175, r.profile.name ?? "Sem nome", 48],
      [470, r.profile.sex ?? "unknown", 8],
      [545, r.profile.birthDate ?? "", 12],
      [655, String(r.page), 5],
    ] as const;
    for (const [x, value, max] of values)
      page.drawText(plain(String(value)).slice(0, max), {
        x,
        y,
        size: 9,
        font,
        color: rgb(0.1, 0.15, 0.15),
      });
    y -= 15;
  }
  page.drawText(
    `Pagina ${pageNumber} - ${rows.length} registros na selecao. A lista nao comprova cadastro.`,
    { x: 25, y: 15, size: 9, font },
  );
  return new Uint8Array(await pdf.save());
}
