import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  collectNow,
  deleteQuote,
  listQuotes,
  listSources,
  saveQuotes,
  syncSources,
} from "@/lib/market.functions";
import { LivestockQuotesPanel } from "@/components/admin/LivestockQuotesPanel";

export const Route = createFileRoute("/_authenticated/admin/cotacoes")({
  head: () => ({
    meta: [
      { title: "Cotações e mercado · TPEC-IA" },
      {
        name: "description",
        content: "Gestão das fontes oficiais e das cotações estruturadas de mercado da TPEC-IA.",
      },
      { property: "og:title", content: "Cotações e mercado · TPEC-IA" },
      {
        property: "og:description",
        content: "Gestão das fontes oficiais e das cotações estruturadas de mercado da TPEC-IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminMarket,
});

type SourceRow = {
  id: string;
  code: string;
  name: string;
  org: string;
  category: string;
  url: string;
  kind: "rag" | "dynamic";
  phase: number;
  region: string | null;
  ingest_method: string;
  license_note: string | null;
  active: boolean;
};

type QuoteRow = {
  id: string;
  product: string;
  product_slug: string;
  category: string;
  price: number;
  unit: string;
  locality: string;
  state: string | null;
  quote_type: string;
  reference_date: string;
  source_name: string;
  source_url: string;
  var_daily: number | null;
  var_weekly: number | null;
  var_monthly: number | null;
  collected_at: string;
};

const emptyForm = {
  product: "",
  category: "bovinos",
  price: "",
  unit: "R$/@",
  locality: "",
  state: "",
  payment_condition: "",
  quote_type: "indicador",
  reference_date: new Date().toISOString().slice(0, 10),
  source_code: "cepea_boi_gordo",
  notes: "",
};

function AdminMarket() {
  const fnSync = useServerFn(syncSources);
  const fnSources = useServerFn(listSources);
  const fnQuotes = useServerFn(listQuotes);
  const fnSave = useServerFn(saveQuotes);
  const fnDelete = useServerFn(deleteQuote);
  const fnCollect = useServerFn(collectNow);

  const [sources, setSources] = useState<SourceRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "rag" | "dynamic">("all");

  async function refresh() {
    try {
      const [s, q] = await Promise.all([fnSources(), fnQuotes({ data: { limit: 80 } })]);
      setSources(s as SourceRow[]);
      setQuotes(q as QuoteRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const dynamicSources = useMemo(() => sources.filter((s) => s.kind === "dynamic"), [sources]);
  const visibleSources = useMemo(() => {
    const t = filter.trim().toLowerCase();
    return sources.filter(
      (s) =>
        (kindFilter === "all" || s.kind === kindFilter) &&
        (!t ||
          s.name.toLowerCase().includes(t) ||
          s.org.toLowerCase().includes(t) ||
          s.category.toLowerCase().includes(t)),
    );
  }, [sources, filter, kindFilter]);

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    setErr(null);
    setLog(null);
    try {
      const r = await fn();
      setLog(typeof r === "string" ? r : JSON.stringify(r));
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(String(form.price).replace(",", "."));
    if (!form.product || !price || !form.locality) {
      setErr("Preencha produto, preço e praça.");
      return;
    }
    await run("save", () =>
      fnSave({
        data: {
          quotes: [
            {
              product: form.product,
              category: form.category,
              price,
              unit: form.unit,
              locality: form.locality,
              state: form.state || null,
              payment_condition: form.payment_condition || null,
              quote_type: form.quote_type,
              reference_date: form.reference_date,
              source_code: form.source_code,
              notes: form.notes || null,
            },
          ],
        },
      }),
    );
    setForm({ ...emptyForm, source_code: form.source_code });
  }

  const inputCls = "rounded-md border border-border bg-background px-2 py-1 text-sm";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cotações e mercado</h1>
            <p className="text-sm text-muted-foreground">
              Fontes oficiais e dados dinâmicos usados pela TPEC-IA. Toda cotação exige preço,
              unidade, praça, data e fonte.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              to="/admin/produtos"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Produtos
            </Link>
            <Link
              to="/admin/base-conhecimento"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Base de conhecimento
            </Link>
            <Link
              to="/admin/ia"
              className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
            >
              Análise da IA
            </Link>
            <Link to="/" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Chat
            </Link>
          </div>
        </header>

        {err && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
            <button className="ml-3 underline" onClick={() => setErr(null)}>
              ok
            </button>
          </div>
        )}

        <LivestockQuotesPanel />

        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={busy !== null}
              onClick={() => run("sync", () => fnSync())}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80 disabled:opacity-50"
            >
              {busy === "sync" ? "Registrando..." : "Registrar catálogo de fontes"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => run("collect", () => fnCollect())}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "collect" ? "Coletando..." : "Coletar dados abertos agora"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => run("refresh", async () => "atualizado")}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Atualizar
            </button>
            <span className="text-xs text-muted-foreground">
              {sources.length} fontes · {dynamicSources.length} dinâmicas · {quotes.length} cotações
              recentes
            </span>
          </div>
          {log && <p className="mt-2 break-all text-xs text-muted-foreground">{log}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Coleta automática cobre apenas APIs abertas (Banco Central). Fontes com licença
            restrita, como o CEPEA, devem ser lançadas manualmente ou via contrato/assinatura — link
            público não é autorização de cópia.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
              <h2 className="text-sm font-semibold">Fontes ({visibleSources.length})</h2>
              <div className="flex gap-2">
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
                  className={inputCls}
                >
                  <option value="all">Todas</option>
                  <option value="dynamic">Dados dinâmicos</option>
                  <option value="rag">Base de conhecimento</option>
                </select>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar fonte..."
                  className={`${inputCls} w-48`}
                />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Fonte</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Fase</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSources.map((s) => (
                    <tr key={s.id} className="border-t border-border/60 align-top">
                      <td className="p-2">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {s.name}
                        </a>
                        <div className="text-xs text-muted-foreground">{s.org}</div>
                        {s.license_note && (
                          <div className="text-xs text-muted-foreground">{s.license_note}</div>
                        )}
                      </td>
                      <td className="p-2 text-xs">{s.category}</td>
                      <td className="p-2 text-xs">
                        {s.kind === "dynamic" ? "dinâmico" : "conhecimento"}
                      </td>
                      <td className="p-2 text-xs">{s.phase}</td>
                    </tr>
                  ))}
                  {visibleSources.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">
                        Nenhuma fonte registrada. Clique em "Registrar catálogo de fontes".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Lançar cotação manual</h2>
              <form onSubmit={submitQuote} className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  placeholder="Produto (ex.: Boi gordo)"
                  value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Categoria"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Preço"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Unidade (R$/@)"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Praça / cidade"
                  value={form.locality}
                  onChange={(e) => setForm({ ...form, locality: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="UF"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Pagamento (à vista / 30 dias)"
                  value={form.payment_condition}
                  onChange={(e) => setForm({ ...form, payment_condition: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={form.quote_type}
                  onChange={(e) => setForm({ ...form, quote_type: e.target.value })}
                >
                  <option value="indicador">indicador</option>
                  <option value="fisico">físico</option>
                  <option value="futuro">futuro</option>
                  <option value="nominal">nominal</option>
                  <option value="leilao">leilão</option>
                </select>
                <input
                  className={inputCls}
                  type="date"
                  value={form.reference_date}
                  onChange={(e) => setForm({ ...form, reference_date: e.target.value })}
                />
                <select
                  className={inputCls}
                  value={form.source_code}
                  onChange={(e) => setForm({ ...form, source_code: e.target.value })}
                >
                  {(dynamicSources.length ? dynamicSources : sources).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${inputCls} col-span-2`}
                  placeholder="Observação (opcional)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="col-span-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy === "save" ? "Salvando..." : "Salvar cotação"}
                </button>
              </form>
            </section>

            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border p-3">
                <h2 className="text-sm font-semibold">Cotações recentes ({quotes.length})</h2>
              </div>
              <div className="max-h-[45vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-left">Preço</th>
                      <th className="p-2 text-left">Praça</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <tr key={q.id} className="border-t border-border/60">
                        <td className="p-2">
                          {q.product}
                          <div className="text-xs text-muted-foreground">{q.source_name}</div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {Number(q.price).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          <span className="text-xs text-muted-foreground">{q.unit}</span>
                        </td>
                        <td className="p-2 text-xs">
                          {q.locality}
                          {q.state ? `/${q.state}` : ""}
                        </td>
                        <td className="p-2 text-xs whitespace-nowrap">
                          {q.reference_date.split("-").reverse().join("/")}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() =>
                              run(`del:${q.id}`, () => fnDelete({ data: { id: q.id } }))
                            }
                            className="text-xs text-destructive underline"
                          >
                            remover
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-sm text-muted-foreground">
                          Nenhuma cotação registrada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
