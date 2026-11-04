import {
  ChevronRight,
  ChevronDown,
  MapPin,
  Sprout,
  FlaskConical,
  Syringe,
  Stethoscope,
  Heart,
  Baby,
  ClipboardCheck,
  Wallet,
  Package,
  Warehouse,
  Wheat,
  Tractor,
  Wrench,
  Receipt,
  AlertTriangle,
  Footprints,
} from "lucide-react";
import { useState } from "react";
import type { FarmBook, GuardianAction } from "@/lib/guardian/schema";
import {
  ManagementValuesSchema,
  managementEntries,
  managementSections,
  managementFieldLabels,
  managementNumericFields,
  type ManagementSection,
  type ManagementValues,
} from "@/lib/guardian/management";

type Props = {
  book: FarmBook;
  area: string;
  busy: boolean;
  canEdit: boolean;
  onPropose: (a: GuardianAction) => Promise<void>;
};
const statuses: Record<string, string> = {
  open: "Pendente",
  in_progress: "Em andamento",
  done: "Concluído",
  cancelled: "Cancelado",
  active: "Ativo",
  inactive: "Inativo",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};
const money = (n: number) =>
  (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function valueText(field: string, value: unknown) {
  return field === "amountCents"
    ? money(Number(value))
    : (statuses[String(value)] ?? String(value));
}
export function ManagementWorkspace({ book, area, busy, canEdit, onPropose }: Props) {
  const sections = (Object.keys(managementSections) as ManagementSection[]).filter(
    (s) => managementSections[s].area === area,
  );
  const [selected, setSelected] = useState<ManagementSection | null>(null);
  if (!sections.length) return null;
  return (
    <section
      aria-label="Funções da fazenda"
      className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5"
    >
      <h2 className="text-lg font-semibold">
        Gerenciar{" "}
        {area === "herd"
          ? "rebanho e pastagens"
          : area === "fuel"
            ? "veículos e manutenção"
            : area === "finance"
              ? "contas"
              : area === "supplies"
                ? "produtos e fórmulas"
                : "rotina da fazenda"}
      </h2>
      <p className="text-sm text-slate-600">
        Toque em um cartão para abrir os registros e fazer alterações. Você também pode pedir à
        TPEC-IA pelo WhatsApp.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => {
          const active = selected === s;
          const count = managementEntries(book, s).length;
          const Icon = {
            pasture: MapPin,
            pasture_management: Sprout,
            soil_analysis: FlaskConical,
            health: Syringe,
            exam: Stethoscope,
            insemination: Heart,
            pregnancy: Heart,
            calving: Baby,
            fecal: ClipboardCheck,
            payable: Wallet,
            receivable: Wallet,
            product: Package,
            storage: Warehouse,
            formula: Wheat,
            feeding: Wheat,
            vehicle: Tractor,
            maintenance: Wrench,
            vehicle_cost: Receipt,
            occurrence: AlertTriangle,
            round: Footprints,
          }[s];
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-expanded={active}
              aria-controls={`farm-function-${area}`}
              onClick={() => setSelected(active ? null : s)}
              className={`group flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-wait disabled:opacity-50 motion-reduce:transform-none ${active ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-900 hover:bg-emerald-50/50"}`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200"}`}
              >
                <Icon size={23} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm leading-snug">
                  {managementSections[s].label}
                </strong>
                <span className="mt-1 block text-xs text-slate-500">
                  {count ? `${count} ${count === 1 ? "registro" : "registros"}` : "Nenhum registro"}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-center gap-1 text-xs font-semibold text-emerald-800">
                {active ? (
                  <ChevronDown size={20} aria-hidden="true" />
                ) : (
                  <ChevronRight size={20} aria-hidden="true" />
                )}
                {active ? "Fechar" : "Abrir"}
              </span>
            </button>
          );
        })}
      </div>
      <div id={`farm-function-${area}`}>
        {selected && (
          <ManagementSectionView
            key={selected}
            {...{ book, busy, canEdit, onPropose }}
            section={selected}
          />
        )}
      </div>
    </section>
  );
}
function ManagementSectionView({
  book,
  section,
  busy,
  canEdit,
  onPropose,
}: Omit<Props, "area"> & { section: ManagementSection }) {
  const def = managementSections[section];
  const [form, setForm] = useState<Record<string, string> | null>(null),
    [reference, setReference] = useState<string | undefined>(),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const [ingredients, setIngredients] = useState<
    Array<{ product: string; quantity: string; unit: string }>
  >([]);
  const rows = managementEntries(book, section).filter(
    (e) =>
      !search || JSON.stringify(e.values).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const account = section === "payable" || section === "receivable";
  function open(row?: (typeof rows)[number]) {
    setReference(row?.id);
    setError("");
    setForm(
      row
        ? Object.fromEntries(
            Object.entries(row.values)
              .filter(([k]) => k !== "ingredients")
              .map(([k, v]) => [k, k === "amountCents" ? String(Number(v) / 100) : String(v)]),
          )
        : {
            ...((def.fields as readonly string[]).includes("date") ? { date: today } : {}),
            ...((def.fields as readonly string[]).includes("status")
              ? { status: section === "vehicle" ? "active" : "open" }
              : {}),
          },
    );
    setIngredients(
      (row?.values.ingredients ?? []).map((i) => ({ ...i, quantity: String(i.quantity) })),
    );
  }
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{def.label}</h3>
        {canEdit && (
          <button
            disabled={busy}
            onClick={() => open()}
            className="rounded-xl bg-emerald-800 px-4 py-2 text-sm text-white"
          >
            Adicionar registro
          </button>
        )}
      </div>
      {account && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          Pendente:{" "}
          {money(
            rows.filter((r) => !r.settlement).reduce((n, r) => n + (r.values.amountCents ?? 0), 0),
          )}
          . A quitação registra o valor no financeiro uma única vez.
        </p>
      )}
      {section === "feeding" && (
        <p className="text-sm text-slate-600">
          Este registro acompanha o fornecimento da dieta. Para atualizar o estoque, registre também
          a saída dos ingredientes com suas quantidades e unidades.
        </p>
      )}
      <label className="block text-sm">
        Buscar registros
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 block w-full rounded-lg border p-2"
        />
      </label>
      {form && canEdit && (
        <form
          className="space-y-3 rounded-xl bg-slate-50 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const values: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(form))
              if (v !== "")
                values[k] = managementNumericFields.includes(k as keyof ManagementValues)
                  ? k === "amountCents"
                    ? Math.round(Number(v) * 100)
                    : Number(v)
                  : v;
            if (section === "formula")
              values.ingredients = ingredients.map((i) => ({ ...i, quantity: Number(i.quantity) }));
            const parsed = ManagementValuesSchema.safeParse(values);
            if (!parsed.success) {
              setError("Confira os campos e as unidades informadas.");
              return;
            }
            try {
              await onPropose({
                kind: "management_save",
                section,
                ...(reference ? { reference } : {}),
                values: parsed.data,
                ...(reference
                  ? {
                      clear: (Object.keys(form) as Array<keyof ManagementValues>).filter(
                        (k) =>
                          form[k] === "" &&
                          managementEntries(book, section).find((r) => r.id === reference)?.values[
                            k
                          ] !== undefined,
                      ),
                    }
                  : {}),
              });
              setForm(null);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Não foi possível preparar o registro.",
              );
            }
          }}
        >
          <h4 className="font-semibold">{reference ? "Editar registro" : "Novo registro"}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {def.fields
              .filter((f) => f !== "ingredients")
              .map((field) => {
                const required = (def.required as readonly string[]).includes(field),
                  label = managementFieldLabels[field];
                const options =
                  field === "unit"
                    ? ["kg", "L", "un", "saco"]
                    : field === "status"
                      ? section === "vehicle"
                        ? ["active", "inactive"]
                        : ["open", "in_progress", "done", "cancelled"]
                      : field === "severity"
                        ? ["low", "medium", "high"]
                        : null;
                return (
                  <label
                    key={field}
                    className={`text-sm ${field === "notes" || field === "action" ? "sm:col-span-2" : ""}`}
                  >
                    {label}
                    {required ? " *" : ""}
                    {options ? (
                      <select
                        aria-label={label + (required ? " *" : "")}
                        required={required}
                        value={form[field] ?? ""}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        className="mt-1 block w-full rounded-lg border bg-white p-2"
                      >
                        <option value="">Selecione</option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {statuses[o] ?? o}
                          </option>
                        ))}
                      </select>
                    ) : field === "notes" || field === "action" ? (
                      <textarea
                        aria-label={label + (required ? " *" : "")}
                        maxLength={1500}
                        value={form[field] ?? ""}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        className="mt-1 block w-full rounded-lg border p-2"
                      />
                    ) : (
                      <input
                        aria-label={label + (required ? " *" : "")}
                        required={required}
                        type={
                          field.toLowerCase().includes("date")
                            ? "date"
                            : managementNumericFields.includes(field)
                              ? "number"
                              : "text"
                        }
                        min={managementNumericFields.includes(field) ? 0 : undefined}
                        step="any"
                        maxLength={160}
                        value={form[field] ?? ""}
                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                        className="mt-1 block w-full rounded-lg border p-2"
                      />
                    )}
                  </label>
                );
              })}
          </div>
          {section === "formula" && (
            <fieldset className="space-y-3">
              <legend className="font-medium">Ingredientes</legend>
              {ingredients.map((i, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
                  <label className="text-sm">
                    Produto
                    <input
                      required
                      value={i.product}
                      onChange={(e) =>
                        setIngredients(
                          ingredients.map((r, n) =>
                            n === index ? { ...r, product: e.target.value } : r,
                          ),
                        )
                      }
                      className="block w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Quantidade
                    <input
                      required
                      type="number"
                      min="0.001"
                      step="any"
                      value={i.quantity}
                      onChange={(e) =>
                        setIngredients(
                          ingredients.map((r, n) =>
                            n === index ? { ...r, quantity: e.target.value } : r,
                          ),
                        )
                      }
                      className="block w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-sm">
                    Unidade
                    <select
                      value={i.unit}
                      onChange={(e) =>
                        setIngredients(
                          ingredients.map((r, n) =>
                            n === index ? { ...r, unit: e.target.value } : r,
                          ),
                        )
                      }
                      className="block w-full rounded border p-2"
                    >
                      {["kg", "L", "un", "saco"].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIngredients(ingredients.filter((_, n) => n !== index))}
                    className="text-sm text-rose-700"
                  >
                    Remover ingrediente
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setIngredients([...ingredients, { product: "", quantity: "", unit: "kg" }])
                }
                className="rounded border px-3 py-2 text-sm"
              >
                Adicionar ingrediente
              </button>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-white">
              Revisar registro
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-lg border px-4 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {!rows.length && <p className="py-4 text-sm text-slate-500">Nenhum registro encontrado.</p>}
      <div className="space-y-3">
        {rows
          .slice()
          .reverse()
          .map((row) => (
            <article key={row.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <strong className="break-words">{row.values.name}</strong>
                {account && (
                  <span className={row.settlement ? "text-emerald-800" : "text-amber-900"}>
                    {row.settlement
                      ? `Quitada em ${row.settlement.date}`
                      : row.values.dueDate! < today
                        ? "Vencida"
                        : "Pendente"}{" "}
                    · {money(row.values.amountCents ?? 0)}
                  </span>
                )}
              </div>
              <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {Object.entries(row.values)
                  .filter(([k]) => k !== "name")
                  .map(([k, v]) => (
                    <div key={k} className="break-words">
                      <dt className="inline text-slate-500">
                        {managementFieldLabels[k as keyof ManagementValues]}:{" "}
                      </dt>
                      <dd className="inline">
                        {Array.isArray(v)
                          ? v.map((i) => `${i.product}: ${i.quantity} ${i.unit}`).join("; ")
                          : valueText(k, v)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {!row.settlement && (
                    <button
                      disabled={busy}
                      onClick={() => open(row)}
                      className="rounded border px-3 py-2"
                    >
                      Editar
                    </button>
                  )}
                  {account && !row.settlement && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void onPropose({
                          kind: "management_settle",
                          section,
                          reference: row.id,
                          date: today,
                        })
                      }
                      className="rounded border border-emerald-700 px-3 py-2 text-emerald-900"
                    >
                      {section === "payable" ? "Registrar pagamento" : "Registrar recebimento"}
                    </button>
                  )}
                  {account && row.settlement && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void onPropose({
                          kind: "management_unsettle",
                          section,
                          reference: row.id,
                          reason: "Estorno solicitado pelo produtor",
                        })
                      }
                      className="rounded border px-3 py-2 text-amber-900"
                    >
                      Estornar quitação
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() =>
                      void onPropose({
                        kind: "management_remove",
                        section,
                        reference: row.id,
                        reason: "Remoção solicitada pelo produtor no painel",
                      })
                    }
                    className="rounded border px-3 py-2 text-rose-700"
                  >
                    Remover
                  </button>
                </div>
              )}
              <details className="mt-3 text-xs text-slate-500">
                <summary>Histórico do registro</summary>
                <p>
                  Criado em {new Date(row.source.at).toLocaleString("pt-BR")}.{" "}
                  {row.revisions.length} alterações preservadas.
                </p>
                <p className="break-all">Código: {row.id}</p>
                {row.revisions.map((r, n) => (
                  <p key={n}>
                    {new Date(r.source.at).toLocaleString("pt-BR")} ·{" "}
                    {Object.entries(r.values)
                      .map(
                        ([k, v]) =>
                          `${managementFieldLabels[k as keyof ManagementValues]}: ${typeof v === "object" ? JSON.stringify(v) : valueText(k, v)}`,
                      )
                      .join("; ")}
                  </p>
                ))}
              </details>
            </article>
          ))}
      </div>
    </div>
  );
}
