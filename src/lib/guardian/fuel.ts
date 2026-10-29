import { z } from "zod";
import type { FarmBook, LedgerEntry, Provenance } from "./schema.ts";
import { ledgerForTotals, fuelCategory } from "./finance.ts";

export const FuelType = z.enum(["diesel", "gasoline", "ethanol", "unspecified"]);
export type FuelType = z.infer<typeof FuelType>;
export const fuelNames: Record<FuelType, string> = {
  diesel: "Diesel",
  gasoline: "Gasolina",
  ethanol: "Etanol",
  unspecified: "Combustível não especificado",
};
const label = z.string().trim().min(1).max(160);
const amount = z.number().int().positive().max(1e12);
const source = z
  .object({
    actor: z.string().regex(/^\d{6,20}$/),
    messageId: z.string().min(1).max(128),
    at: z.iso.datetime(),
    sourceAt: z.iso.datetime().optional(),
    confirmed: z.literal(true),
  })
  .strict();
export const FuelVoidSchema = z.object({ reason: label, source }).strict();
export const FuelActionSchemas = [
  z
    .object({
      kind: z.literal("fuel_movement"),
      fuel: FuelType.exclude(["unspecified"]),
      tank: label,
      type: z.enum(["balance", "in", "out"]),
      liters: z.number().finite().min(0).max(1e9),
      date: z.iso.date(),
      destination: label.optional(),
      amountCents: amount.optional(),
      unitPriceCents: amount.optional(),
    })
    .strict()
    .refine(
      (a) =>
        (a.type === "balance" || a.liters > 0) &&
        (a.type !== "out" || !!a.destination) &&
        (a.amountCents === undefined || a.type === "in") &&
        (a.unitPriceCents === undefined ||
          (a.type === "in" && a.amountCents === Math.round(a.liters * a.unitPriceCents))),
      "Confira litros, destino e custo da entrada.",
    ),
  z
    .object({
      kind: z.literal("fuel_expense"),
      fuel: FuelType,
      amountCents: amount,
      date: z.iso.date(),
      periodMonth: z
        .string()
        .regex(/^20\d{2}-(?:0[1-9]|1[0-2])$/)
        .optional(),
      description: label.optional(),
      totalRelation: z.enum(["included", "additional"]).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("fuel_void"), id: label, reason: label }).strict(),
] as const;
export const FuelActionSchema = z.discriminatedUnion("kind", FuelActionSchemas);
export type FuelAction = z.infer<typeof FuelActionSchema>;
export const FuelBookSchema = z
  .object({
    movements: z
      .array(
        z
          .object({
            id: label,
            fuel: FuelType.exclude(["unspecified"]),
            tank: label,
            type: z.enum(["balance", "in", "out"]),
            liters: z.number().finite().min(0).max(1e9),
            date: z.iso.date(),
            destination: label.optional(),
            unitPriceCents: amount.optional(),
            source,
            voided: FuelVoidSchema.optional(),
          })
          .strict(),
      )
      .max(20000),
  })
  .strict();
export type FuelBook = z.infer<typeof FuelBookSchema>;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
export function ledgerFuel(
  e: Pick<LedgerEntry, "category" | "description" | "direction">,
): FuelType | null {
  return (fuelCategory(e)?.slice(5) as FuelType | undefined) ?? null;
}

export function fuelStocks(book: FarmBook, end = "9999-12-31") {
  const stocks = new Map<
    string,
    { fuel: Exclude<FuelType, "unspecified">; tank: string; liters: number | null; date: string }
  >();
  const rows = (book.fuel?.movements ?? [])
    .filter((x) => !x.voided && x.date <= end)
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.source.sourceAt ?? a.source.at).localeCompare(b.source.sourceAt ?? b.source.at),
    );
  for (const m of rows) {
    const key = m.fuel + ":" + fold(m.tank),
      s = stocks.get(key) ?? { fuel: m.fuel, tank: m.tank, liters: null, date: m.date };
    if (m.type === "balance") s.liters = m.liters;
    else if (s.liters !== null)
      s.liters = Math.round((s.liters + (m.type === "in" ? m.liters : -m.liters)) * 1000) / 1000;
    if (s.liters !== null && s.liters < 0)
      throw Error(
        "A saída deixaria o tanque com saldo negativo. Confira o saldo inicial, os litros e a data.",
      );
    s.date = m.date;
    stocks.set(key, s);
  }
  return [...stocks.values()];
}
export function fuelMonth(book: FarmBook, month: string, filter: FuelType | "all" = "all") {
  const rows = (book.fuel?.movements ?? []).filter(
    (x) => !x.voided && x.date.startsWith(month) && (filter === "all" || x.fuel === filter),
  );
  const ledger = book.ledger.filter(
    (e) => ledgerFuel(e) !== null && (filter === "all" || ledgerFuel(e) === filter),
  );
  const entries = ledgerForTotals(ledger, month + "-01", month + "-31");
  const destinations = new Map<string, { name: string; fuel: FuelType; liters: number }>();
  for (const x of rows.filter((x) => x.type === "out")) {
    const key = x.fuel + ":" + fold(x.destination ?? "Destino não informado"),
      prior = destinations.get(key) ?? {
        name: x.destination ?? "Destino não informado",
        fuel: x.fuel,
        liters: 0,
      };
    prior.liters += x.liters;
    destinations.set(key, prior);
  }
  return {
    entered: rows.filter((x) => x.type === "in").reduce((n, x) => n + x.liters, 0),
    exited: rows.filter((x) => x.type === "out").reduce((n, x) => n + x.liters, 0),
    expenseCents: entries.reduce((n, x) => n + x.amountCents, 0),
    destinations: [...destinations.values()].sort((a, b) => b.liters - a.liters),
    movements: rows,
    expenses: ledger.filter((e) => (e.periodMonth ?? e.date.slice(0, 7)) === month),
    counted: entries,
    stocks: fuelStocks(book, month + "-31").filter((x) => filter === "all" || x.fuel === filter),
  };
}
export function describeFuel(a: FuelAction) {
  const liters = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " L";
  if (a.kind === "fuel_void")
    return `Cancelar o registro de combustível, preservando o original e a auditoria. Motivo: ${a.reason}.`;
  if (a.kind === "fuel_expense")
    return `${a.periodMonth ? "Total mensal informado" : "Despesa"} de ${fuelNames[a.fuel].toLowerCase()}: ${(a.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, ${a.periodMonth ?? a.date}.${a.periodMonth ? " Inclui os detalhes anteriores desse combustível no mês; não será somado a eles." : ""} Não altera litros no tanque.`;
  return `${a.type === "balance" ? "Informar saldo" : a.type === "in" ? "Registrar entrada" : "Registrar saída"} de ${liters(a.liters)} de ${fuelNames[a.fuel].toLowerCase()} no tanque ${a.tank}${a.destination ? `, para ${a.destination}` : ""}, em ${a.date}.${a.amountCents ? ` Custo: ${(a.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, também no financeiro.` : ""}`;
}
export function fuelNeedsTotalRelation(book: FarmBook, a: FuelAction): boolean {
  return (
    a.kind === "fuel_expense" &&
    !!a.periodMonth &&
    !a.totalRelation &&
    book.ledger.some(
      (e) =>
        !e.voided &&
        e.direction === "expense" &&
        e.periodMonth === a.periodMonth &&
        !e.lot &&
        (!e.categoryTotal || (e.category === "fuel:unspecified" && a.fuel !== "unspecified")),
    )
  );
}
export function applyFuel(book: FarmBook, a: FuelAction, s: Provenance, id: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(s.at),
  );
  if (
    a.kind !== "fuel_void" &&
    (a.date > day ||
      (a.kind === "fuel_expense" && a.periodMonth && a.periodMonth > a.date.slice(0, 7)))
  )
    throw Error("A data de um registro de combustível realizado não pode estar no futuro.");
  if (a.kind === "fuel_void") {
    const m = book.fuel?.movements.find((x) => x.id === a.id),
      e = book.ledger.find((x) => x.id === a.id && ledgerFuel(x) !== null);
    if (!m && !e) throw Error("Não encontrei esse registro de combustível nesta fazenda.");
    if (m?.voided || e?.voided)
      throw Error("Esse registro já está cancelado; não repeti a alteração.");
    const voided = { reason: a.reason, source: s };
    if (m) m.voided = voided;
    for (const entry of book.ledger.filter((x) => x.id === a.id || x.fuelMovementId === a.id))
      if (!entry.voided) entry.voided = voided;
  } else if (a.kind === "fuel_movement") {
    const { kind: _kind, amountCents, ...movement } = a;
    const b = (book.fuel ??= { movements: [] });
    if (b.movements.length >= 20000 || b.movements.some((x) => x.id === id))
      throw Error("O registro de combustível já existe ou atingiu o limite técnico.");
    b.movements.push({ ...movement, id, source: s });
    if (amountCents)
      book.ledger.push({
        id: `fuel:${id}`,
        fuelMovementId: id,
        category: `fuel:${a.fuel}`,
        direction: "expense",
        amountCents,
        date: a.date,
        description: `${fuelNames[a.fuel]} — entrada no tanque ${a.tank}`.slice(0, 160),
        source: s,
      });
  } else {
    if (fuelNeedsTotalRelation(book, a))
      throw Error(
        "Esse total de combustível já está incluído no total mensal informado ou é adicional? Informe essa relação antes de salvar.",
      );
    if (book.ledger.some((x) => x.id === id)) throw Error("Esse lançamento já existe.");
    book.ledger.push({
      id,
      direction: "expense",
      amountCents: a.amountCents,
      date: a.date,
      category: `fuel:${a.fuel}`,
      description:
        a.description ??
        `${fuelNames[a.fuel]}${a.periodMonth ? " — total mensal informado" : " — despesa"}`,
      source: s,
      ...(a.periodMonth ? { periodMonth: a.periodMonth, categoryTotal: true } : {}),
      ...(a.totalRelation ? { totalRelation: a.totalRelation } : {}),
    });
  }
  fuelStocks(book);
}
