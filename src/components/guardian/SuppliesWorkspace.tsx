import { useState } from "react";
import { supplyLocationBalances } from "@/lib/guardian/supplies";
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
  const [location, setLocation] = useState(""),
    [to, setTo] = useState(""),
    [transfer, setTransfer] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null);
  const [item, setItem] = useState(""),
    [unit, setUnit] = useState<"kg" | "L" | "un" | "saco">("kg"),
    [type, setType] = useState<"balance" | "in" | "out">("balance"),
    [quantity, setQuantity] = useState(""),
    [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
    );
  const rows = supplyLocationBalances(book);
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
              <th>Local</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item + r.unit + (r.location ?? "")} className="border-t">
                <td className="py-3">{r.item}</td>
                <td>{r.unit}</td>
                <td>{r.location ?? "Sem local informado"}</td>
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
            if (transfer)
              await onPropose({
                kind: "supply_transfer",
                item,
                unit,
                quantity: Number(quantity),
                date,
                from: location,
                to,
              });
            else if (editingId)
              await onPropose({
                kind: "supply_edit",
                id: editingId,
                quantity: Number(quantity),
                date,
              });
            else
              await onPropose({
                ...(location ? { location } : {}),
                kind: "supply_movement",
                item,
                unit,
                type,
                quantity: Number(quantity),
                date,
              });
          }}
        >
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              aria-pressed={!transfer}
              onClick={() => {
                setTransfer(false);
                setEditingId(null);
              }}
              className="rounded border px-3 py-2"
            >
              Movimentar ou conferir saldo
            </button>
            <button
              type="button"
              aria-pressed={transfer}
              onClick={() => {
                setTransfer(true);
                setEditingId(null);
              }}
              className="rounded border px-3 py-2"
            >
              Transferir entre locais
            </button>
          </div>
          <label>
            {transfer ? "Local de origem" : "Local de estoque (opcional)"}
            <input
              required={transfer}
              disabled={!!editingId}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </label>
          {transfer && (
            <label>
              Local de destino
              <input
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="block w-full rounded border p-2"
              />
            </label>
          )}
          <label>
            Insumo
            <input
              required
              minLength={2}
              disabled={!!editingId}
              aria-label="Nome do insumo"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="block w-full rounded border p-2"
            />
          </label>
          <label>
            Movimentação
            <select
              disabled={transfer || !!editingId}
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
              disabled={!!editingId}
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
            {editingId
              ? "Revisar correção"
              : transfer
                ? "Revisar transferência"
                : "Revisar movimentação do insumo"}
          </button>
        </form>
      )}
      <h3 className="font-semibold">Movimentações recentes</h3>
      <ul className="space-y-2 text-sm">
        {(book.supplies?.movements ?? [])
          .slice(-30)
          .reverse()
          .map((m) => (
            <li key={m.id} className="rounded border p-3">
              {m.date} · {m.type === "balance" ? "Contagem" : m.type === "in" ? "Entrada" : "Saída"}{" "}
              · {m.quantity} {m.unit} · {m.item}
              {m.location ? " · Local: " + m.location : ""}
              {m.destination ? " · " + m.destination : ""}
              {m.voided
                ? " · Cancelado com histórico"
                : canEdit && (
                    <div className="mt-2 flex gap-3">
                      {!m.transferId && (
                        <button
                          disabled={busy}
                          onClick={() => {
                            setEditingId(m.id);
                            setTransfer(false);
                            setItem(m.item);
                            setUnit(m.unit);
                            setType(m.type);
                            setQuantity(String(m.quantity));
                            setDate(m.date);
                            setLocation(m.location ?? "");
                          }}
                          className="rounded border px-3 py-2"
                        >
                          Corrigir
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() =>
                          void onPropose({
                            kind: "supply_void",
                            id: m.id,
                            reason: "Cancelamento solicitado pelo produtor",
                          })
                        }
                        className="rounded border px-3 py-2 text-rose-700"
                      >
                        {m.transferId ? "Cancelar transferência" : "Cancelar movimento"}
                      </button>
                    </div>
                  )}
            </li>
          ))}
      </ul>
    </section>
  );
}
