import { z } from "zod";
import type { FarmBook, Provenance } from "./schema.ts";
const day = z
  .string()
  .regex(/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/)
  .refine((s) => {
    const value = new Date(s + "T12:00:00Z");
    return Number.isFinite(value.getTime()) && value.toISOString().startsWith(s);
  });
export const SupplyActionSchema = z
  .object({
    kind: z.literal("supply_movement"),
    item: z.string().trim().min(2).max(160),
    unit: z.enum(["kg", "L", "un", "saco"]),
    type: z.enum(["balance", "in", "out"]),
    quantity: z.number().finite().nonnegative().max(1e9),
    date: day,
    destination: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .refine((a) => a.type === "balance" || a.quantity > 0);
export const SupplyBookSchema = z
  .object({
    movements: z
      .array(
        SupplyActionSchema.safeExtend({
          id: z.string().min(1).max(160),
          source: z
            .object({
              actor: z.string(),
              messageId: z.string().max(128),
              at: z.iso.datetime(),
              sourceAt: z.iso.datetime().optional(),
              confirmed: z.literal(true),
            })
            .strict(),
        }),
      )
      .max(10000),
  })
  .strict();
export type SupplyBook = z.infer<typeof SupplyBookSchema>;
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function supplyBalances(book: Pick<FarmBook, "supplies">, day = "2099-12-31") {
  const groups = new Map<string, { item: string; unit: string; quantity: number | null }>();
  for (const m of (book.supplies?.movements ?? [])
    .filter((m) => m.date <= day)
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))) {
    const id = key(m.item) + ":" + m.unit;
    const row = groups.get(id) ?? { item: m.item, unit: m.unit, quantity: null };
    if (m.type === "balance") row.quantity = m.quantity;
    else if (row.quantity !== null) row.quantity += m.type === "in" ? m.quantity : -m.quantity;
    groups.set(id, row);
  }
  return [...groups.values()];
}
export function describeSupply(a: z.infer<typeof SupplyActionSchema>) {
  return `${a.type === "balance" ? "Contagem" : a.type === "in" ? "Entrada" : "Saída"} de estoque: ${a.quantity} ${a.unit} de ${a.item}, em ${a.date}${a.destination ? ", destino: " + a.destination : ""}.`;
}
export function applySupply(
  book: FarmBook,
  action: z.infer<typeof SupplyActionSchema>,
  source: Provenance,
  id: string,
) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(source.at),
  );
  if (action.date > today)
    throw Error("Movimentações realizadas de insumos não podem ter data futura.");
  const supplies = (book.supplies ??= { movements: [] });
  if (supplies.movements.length >= 10000) throw Error("Limite técnico de movimentações atingido.");
  if (action.type === "out") {
    const balance = supplyBalances(book, action.date).find(
      (r) => key(r.item) === key(action.item) && r.unit === action.unit,
    );
    if (balance?.quantity === null || balance?.quantity === undefined)
      throw Error("Informe o saldo inicial desse insumo e sua unidade antes de registrar a saída.");
  }
  supplies.movements.push({ ...action, id, source });
  // Verify every prefix, including retroactive inserts and intermediate same-day
  // balances. Units are distinct; no sack-to-kg or inferred opening balance.
  const balances = new Map<string, number | null>();
  for (const m of [...supplies.movements].sort(
    (a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at),
  )) {
    const k = key(m.item) + ":" + m.unit;
    const current = balances.get(k) ?? null;
    if (m.type === "out" && current === null)
      throw Error("Informe o saldo inicial desse insumo e sua unidade antes de registrar a saída.");
    const next =
      m.type === "balance"
        ? m.quantity
        : current === null
          ? null
          : current + (m.type === "in" ? m.quantity : -m.quantity);
    if (next !== null && next < 0)
      throw Error("O estoque desse insumo ficaria negativo. Confira quantidade, unidade e data.");
    balances.set(k, next);
  }
}
