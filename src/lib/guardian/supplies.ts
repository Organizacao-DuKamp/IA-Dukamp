import { z } from "zod";
import type { FarmBook, Provenance } from "./schema.ts";
const day = z
  .string()
  .regex(/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/)
  .refine((s) => {
    const value = new Date(s + "T12:00:00Z");
    return Number.isFinite(value.getTime()) && value.toISOString().startsWith(s);
  });
export const SupplyMovementSchema = z
  .object({
    kind: z.literal("supply_movement"),
    item: z.string().trim().min(2).max(160),
    unit: z.enum(["kg", "L", "un", "saco"]),
    type: z.enum(["balance", "in", "out"]),
    quantity: z.number().finite().nonnegative().max(1e9),
    date: day,
    location: z.string().trim().min(1).max(160).optional(),
    destination: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .refine((a) => a.type === "balance" || a.quantity > 0);
const label = z.string().trim().min(1).max(160);
export const SupplyActionSchemas = [
  SupplyMovementSchema,
  z
    .object({
      kind: z.literal("supply_transfer"),
      item: label,
      unit: z.enum(["kg", "L", "un", "saco"]),
      quantity: z.number().positive().max(1e9),
      from: label,
      to: label,
      date: day,
    })
    .strict(),
  z.object({ kind: z.literal("supply_void"), id: label, reason: label }).strict(),
  z
    .object({
      kind: z.literal("supply_edit"),
      id: label,
      quantity: z.number().nonnegative().max(1e9),
      date: day,
    })
    .strict(),
] as const;
export const SupplyActionSchema = z.discriminatedUnion("kind", SupplyActionSchemas);
export const SupplyBookSchema = z
  .object({
    movements: z
      .array(
        SupplyMovementSchema.safeExtend({
          transferId: label.optional(),
          voided: z
            .object({ reason: label, at: z.iso.datetime(), actor: label })
            .strict()
            .optional(),
          revisions: z
            .array(
              z
                .object({ quantity: z.number(), date: day, at: z.iso.datetime(), messageId: label })
                .strict(),
            )
            .max(500)
            .optional(),
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
export function supplyLocationBalances(book: Pick<FarmBook, "supplies">, day = "2099-12-31") {
  const groups = new Map<
    string,
    { item: string; unit: string; location?: string; quantity: number | null }
  >();
  for (const m of (book.supplies?.movements ?? [])
    .filter((m) => !m.voided && m.date <= day)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))) {
    const id = key(m.item) + ":" + m.unit + ":" + key(m.location ?? "");
    const row = groups.get(id) ?? {
      item: m.item,
      unit: m.unit,
      ...(m.location ? { location: m.location } : {}),
      quantity: null,
    };
    row.quantity =
      m.type === "balance"
        ? m.quantity
        : row.quantity === null
          ? null
          : row.quantity + (m.type === "in" ? m.quantity : -m.quantity);
    groups.set(id, row);
  }
  return [...groups.values()];
}
export function supplyBalances(book: Pick<FarmBook, "supplies">, day = "2099-12-31") {
  const groups = new Map<string, { item: string; unit: string; quantity: number | null }>();
  for (const row of supplyLocationBalances(book, day)) {
    const id = key(row.item) + ":" + row.unit,
      prior = groups.get(id);
    groups.set(id, {
      item: row.item,
      unit: row.unit,
      quantity: !prior
        ? row.quantity
        : prior.quantity === null || row.quantity === null
          ? null
          : prior.quantity + row.quantity,
    });
  }
  return [...groups.values()];
}
export function describeSupply(a: z.infer<typeof SupplyActionSchema>) {
  if (a.kind === "supply_transfer")
    return `Transferir ${a.quantity} ${a.unit} de ${a.item} de ${a.from} para ${a.to} em ${a.date}.`;
  if (a.kind === "supply_void")
    return `Cancelar movimento de estoque ${a.id}: ${a.reason}. Preservar histórico.`;
  if (a.kind === "supply_edit")
    return `Corrigir movimento de estoque ${a.id} para ${a.quantity} em ${a.date}.`;
  return `${a.type === "balance" ? "Contagem" : a.type === "in" ? "Entrada" : "Saída"} de estoque: ${a.quantity} ${a.unit} de ${a.item}, em ${a.date}${a.location ? ", local: " + a.location : ""}${a.destination ? ", destino: " + a.destination : ""}.`;
}
function validateSupply(book: FarmBook) {
  const balances = new Map<string, number | null>();
  for (const m of [...(book.supplies?.movements ?? [])]
    .filter((m) => !m.voided)
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.at.localeCompare(b.source.at))) {
    const k = key(m.item) + ":" + m.unit + ":" + key(m.location ?? ""),
      current = balances.get(k) ?? null;
    if (m.type === "out" && current === null)
      throw Error(
        "Informe o saldo inicial desse insumo, local e unidade antes de registrar a saída.",
      );
    const next =
      m.type === "balance"
        ? m.quantity
        : current === null
          ? null
          : current + (m.type === "in" ? m.quantity : -m.quantity);
    if (next !== null && next < 0)
      throw Error(
        "O estoque desse insumo ficaria negativo. Confira quantidade, local, unidade e data.",
      );
    balances.set(k, next);
  }
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
  if ("date" in action && action.date > today)
    throw Error("Movimentações realizadas de insumos não podem ter data futura.");
  const supplies = (book.supplies ??= { movements: [] });
  if (action.kind === "supply_void" || action.kind === "supply_edit") {
    const row = supplies.movements.find((m) => m.id === action.id && !m.voided);
    if (!row) throw Error("Não encontrei esse movimento ativo nesta fazenda.");
    if (action.kind === "supply_edit") {
      if (row.transferId)
        throw Error("Cancele a transferência inteira e registre novamente para corrigir.");
      if (row.type !== "balance" && action.quantity === 0)
        throw Error("Quantidade deve ser positiva.");
      const revisions = (row.revisions ??= []);
      if (revisions.length >= 500) throw Error("Limite de correções atingido.");
      revisions.push({
        quantity: row.quantity,
        date: row.date,
        at: source.at,
        messageId: source.messageId,
      });
      row.quantity = action.quantity;
      row.date = action.date;
    } else
      for (const m of supplies.movements.filter(
        (m) => m.id === row.id || (row.transferId && m.transferId === row.transferId),
      ))
        m.voided = { reason: action.reason, at: source.at, actor: source.actor };
  } else if (action.kind === "supply_transfer") {
    if (key(action.from) === key(action.to))
      throw Error("Escolha locais de origem e destino diferentes.");
    const balances = supplyLocationBalances(book, action.date);
    for (const place of [action.from, action.to])
      if (
        balances.find(
          (r) =>
            key(r.item) === key(action.item) &&
            r.unit === action.unit &&
            key(r.location ?? "") === key(place),
        )?.quantity == null
      )
        throw Error(
          "Informe a contagem inicial do produto nos dois locais antes da transferência.",
        );
    if (supplies.movements.length > 9998) throw Error("Limite técnico de movimentações atingido.");
    for (const [suffix, type, location] of [
      ["out", "out", action.from],
      ["in", "in", action.to],
    ] as const)
      supplies.movements.push({
        kind: "supply_movement",
        id: id + ":" + suffix,
        transferId: id,
        item: action.item,
        unit: action.unit,
        quantity: action.quantity,
        date: action.date,
        type,
        location,
        source,
      });
  } else {
    if (supplies.movements.length >= 10000)
      throw Error("Limite técnico de movimentações atingido.");
    supplies.movements.push({ ...action, id, source });
  }
  validateSupply(book);
}
