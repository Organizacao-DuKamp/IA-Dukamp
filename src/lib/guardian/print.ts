import type { FarmBook } from "./schema.ts";
import { farmReport } from "./book.ts";

/** Browser print dialog can save a complete report as PDF; no external data transfer. */
export function printFarm(book: FarmBook) {
  const frame = document.createElement("iframe");
  frame.title = "Relatório da fazenda para impressão";
  frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10000px;border:0";
  document.body.append(frame);
  const doc = frame.contentDocument,
    win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório da Fazenda · TPEC-IA</title><style>@page{size:A4;margin:18mm}body{font:11pt Arial,sans-serif;color:#18362b}h1{font-size:21pt}pre{font:10pt Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}footer{font-size:9pt;color:#57675e}</style></head><body></body></html>',
  );
  const title = doc.createElement("h1");
  title.textContent = book.name ?? "Propriedade sem nome";
  const pre = doc.createElement("pre");
  pre.textContent = farmReport(book, { maxChars: Infinity });
  const footer = doc.createElement("footer");
  footer.textContent =
    "TPEC-IA • Guardiã da Fazenda • Dados confirmados do caderno • " +
    new Date().toLocaleString("pt-BR");
  doc.body.append(title, pre, footer);
  doc.close();
  win.focus();
  win.print();
  setTimeout(() => frame.remove(), 60000);
}
