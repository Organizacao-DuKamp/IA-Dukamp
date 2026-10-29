import { speciesNames } from "./operations.ts";
import type { FarmBook } from "./schema.ts";
import { ledgerForTotals, ledgerPeriod } from "./finance.ts";
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
  for (const m of book.supplies?.movements ?? [])
    rows.push([
      "Estoque de insumos",
      m.id,
      m.date,
      m.item,
      m.quantity,
      m.unit,
      m.destination ?? "",
      m.type,
    ]);
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
  for (const m of book.fuel?.movements ?? [])
    rows.push([
      "Combustível",
      m.id,
      m.date,
      `${m.fuel} · ${m.tank}${m.destination ? " → " + m.destination : ""}`,
      m.liters,
      "L",
      "",
      m.voided ? "cancelado" : m.type,
    ]);
  for (const t of book.tasks)
    rows.push(["Tarefa", t.id, t.dueAt, t.title, "", "", t.lot ?? "", t.status]);
  const ledgerTotals = ledgerForTotals(book.ledger);
  for (const l of book.ledger)
    rows.push([
      l.direction === "expense" ? "Despesa" : "Receita",
      l.id,
      ledgerPeriod(l),
      l.description,
      (l.amountCents / 100).toFixed(2).replace(".", ","),
      "BRL",
      l.lot ?? "",
      l.voided
        ? "cancelado com auditoria"
        : ledgerTotals.includes(l)
          ? "considerado no saldo"
          : "histórico/detalhamento não somado",
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
  for (const f of book.operations?.feed ?? [])
    rows.push(["Consumo", f.id, f.date, f.feed, f.kg, "kg", f.lot ?? "Fazenda", f.basis]);
  for (const c of book.operations?.categoryCounts ?? [])
    rows.push([
      "Categoria declarada",
      c.id,
      c.date,
      c.category,
      c.count,
      "cabeças",
      "",
      "declarado",
    ]);
  for (const inventory of book.operations?.inventories ?? [])
    for (const group of inventory.groups)
      rows.push([
        "Rebanho por grupos",
        inventory.id,
        inventory.date,
        speciesNames[group.species ?? "cattle"] + " — " + group.name + ": " + group.description,
        group.count,
        "cabeças",
        "",
        inventory.mode === "additional"
          ? "acréscimo ao saldo declarado"
          : inventory.complete
            ? "censo declarado"
            : "levantamento parcial",
      ]);
  const replaced = new Set(book.operations?.movements.map((m) => m.replaces).filter(Boolean));
  for (const c of book.operations?.counts ?? [])
    rows.push([
      "Contagem declarada",
      c.id,
      c.date,
      "Quantidade ao fim do dia — " + speciesNames[c.species ?? "cattle"],
      c.count,
      "cabeças",
      c.lot ?? "Fazenda",
      "declarado",
    ]);
  for (const m of book.operations?.movements ?? [])
    rows.push([
      "Movimentação",
      m.id,
      m.date,
      speciesNames[m.species ?? "cattle"] + " — " + m.description,
      m.count,
      "cabeças",
      m.lot ?? "Fazenda",
      replaced.has(m.id) ? "substituído por correção" : m.type,
    ]);
  for (const l of book.operations?.lots ?? [])
    rows.push(["Lote", l.name, "", l.pasture ?? "", l.areaHa ?? "", "ha", l.name, "informado"]);
  return "\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
