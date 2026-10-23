import type { FarmBook } from "./schema.ts";
/** Protect CSV consumers from spreadsheet formula injection in user-controlled text. */
function cell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // eslint-disable-next-line no-control-regex
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function farmCsv(book: FarmBook): string {
  const rows: unknown[][] = [
    ["Seção", "Código", "Data", "Descrição", "Valor", "Unidade", "Lote", "Estado"],
  ];
  for (const a of book.animals) {
    rows.push(["Animal", a.code, a.birthDate ?? "", a.breed ?? "", "", "", a.lot ?? "", a.sex]);
    for (const w of a.weights)
      rows.push([
        "Pesagem",
        a.code,
        w.date,
        w.corrections.length ? `${w.corrections.length} correções auditadas` : "",
        w.weightKg,
        "kg",
        a.lot ?? "",
        w.estimated ? "estimado" : "informado",
      ]);
  }
  for (const t of book.tasks)
    rows.push(["Tarefa", t.id, t.dueAt, t.title, "", "", t.lot ?? "", t.status]);
  for (const l of book.ledger)
    rows.push([
      l.direction === "expense" ? "Despesa" : "Receita",
      l.id,
      l.date,
      l.description,
      (l.amountCents / 100).toFixed(2).replace(".", ","),
      "BRL",
      l.lot ?? "",
      "confirmado",
    ]);
  for (const r of book.records)
    rows.push([
      "Caderno",
      r.id,
      r.date,
      r.description,
      r.count ?? "",
      "quantidade informada",
      r.lot ?? "",
      r.type,
    ]);
  return "\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
