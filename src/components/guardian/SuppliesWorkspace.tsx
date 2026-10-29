import { useState } from "react";
import { supplyBalances } from "@/lib/guardian/supplies";
import type { FarmBook, GuardianAction } from "@/lib/guardian/schema";
export function SuppliesWorkspace({
  book,
  busy,
  onPropose,
  canEdit,
}: {
  book: FarmBook;
  busy: boolean;
  onPropose: (a: GuardianAction) => Promise<void>;
  canEdit: boolean;
}) {
  const [item, setItem] = useState(""),
    [unit, setUnit] = useState<"kg" | "L" | "un" | "saco">("kg"),
    [type, setType] = useState<"balance" | "in" | "out">("balance"),
    [quantity, setQuantity] = useState(""),
    [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
    );
  const rows = supplyBalances(book);
  return (
    <section className="space-y-5 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">Estoque e insumos</h2>
      <p className="text-sm text-muted-foreground">
        Saldos por produto e unidade. Uma entrada sem contagem inicial fica registrada com saldo
        total desconhecido.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Unidade</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item + r.unit} className="border-t">
                <td className="py-3">{r.item}</td>
                <td>{r.unit}</td>
                <td>
                  {r.quantity === null
                    ? "Contagem inicial pendente"
                    : r.quantity.toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onPropose({
              kind: "supply_movement",
              item,
              unit,
              type,
              quantity: Number(quantity),
              date,
            });
          }}
        >
          <label>
            Insumo
            <input
              required
              minLength={2}
              aria-label="Nome do insumo"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </label>
          <label>
            Movimentação
            <select
              aria-label="Tipo de movimentação do insumo"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="block w-full rounded border p-2"
            >
              <option value="balance">Contagem do saldo</option>
              <option value="in">Entrada</option>
              <option value="out">Saída</option>
            </select>
          </label>
          <label>
            Quantidade
            <input
              required
              type="number"
              min="0"
              step="any"
              aria-label="Quantidade do insumo"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </label>
          <label>
            Unidade
            <select
              aria-label="Unidade do insumo"
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof unit)}
              className="block w-full rounded border p-2"
            >
              {["kg", "L", "un", "saco"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input
              required
              type="date"
              aria-label="Data do insumo"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </label>
          <button
            disabled={busy || !item || quantity === ""}
            className="rounded bg-emerald-800 p-2 text-white"
          >
            Revisar movimentação do insumo
          </button>
        </form>
      )}
      <h3 className="font-semibold">Movimentações recentes</h3>
      <ul className="space-y-2 text-sm">
        {(book.supplies?.movements ?? [])
          .slice(-30)
          .reverse()
          .map((m) => (
            <li key={m.id}>
              {m.date} · {m.type === "balance" ? "Contagem" : m.type === "in" ? "Entrada" : "Saída"}{" "}
              · {m.quantity} {m.unit} · {m.item}
              {m.destination ? " · " + m.destination : ""}
            </li>
          ))}
      </ul>
    </section>
  );
}
