import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteLivestockQuote,
  listLivestockCatalog,
  listLivestockQuotes,
  livestockStatus,
  saveLivestockQuotes,
} from "@/lib/market.functions";

type Category = {
  slug: string;
  nome: string;
  unidade_padrao: string;
  max_idade_dias: number;
};
type Place = { slug: string; municipio: string; uf: string; regiao: string | null };
type Row = {
  id: string;
  categoria: string;
  cidade: string | null;
  estado: string;
  regiao: string;
  abrangencia: string;
  preco_minimo: number | null;
  preco_maximo: number | null;
  preco_referencia: number;
  unidade: string;
  condicao_pagamento: string | null;
  data_cotacao: string;
  fonte: string;
  nivel_confiabilidade: string;
};
type Status = {
  categoria: string;
  nome: string;
  registros: number;
  ultima_data: string | null;
  dias: number | null;
  validade: number;
  vencido: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

const blank = {
  categoria: "boi-gordo",
  cidade: "",
  abrangencia: "municipal",
  preco_minimo: "",
  preco_maximo: "",
  preco_referencia: "",
  unidade: "@",
  condicao_pagamento: "",
  data_cotacao: today(),
  fonte: "",
  url_fonte: "",
  nivel_confiabilidade: "alta",
  observacao: "",
};

export function LivestockQuotesPanel() {
  const fnCatalog = useServerFn(listLivestockCatalog);
  const fnList = useServerFn(listLivestockQuotes);
  const fnSave = useServerFn(saveLivestockQuotes);
  const fnDelete = useServerFn(deleteLivestockQuote);
  const fnStatus = useServerFn(livestockStatus);

  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<Status[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const [cat, list, st] = await Promise.all([
        fnCatalog(),
        fnList({ data: { limit: 80 } }),
        fnStatus(),
      ]);
      setCategories((cat as any).categories ?? []);
      setPlaces((cat as any).places ?? []);
      setRows(list as Row[]);
      setStatus(st as Status[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === form.categoria),
    [categories, form.categoria],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const num = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
    try {
      const ref = num(form.preco_referencia);
      if (!ref) throw new Error("Informe o preço de referência.");
      if (!form.fonte.trim()) throw new Error("Informe a fonte da cotação.");
      const place = places.find((p) => p.municipio === form.cidade);
      const res = await fnSave({
        data: {
          quotes: [
            {
              categoria: form.categoria,
              cidade: form.cidade || null,
              estado: place?.uf,
              abrangencia: form.abrangencia as any,
              preco_minimo: num(form.preco_minimo),
              preco_maximo: num(form.preco_maximo),
              preco_referencia: ref,
              unidade: form.unidade,
              condicao_pagamento: form.condicao_pagamento || null,
              data_cotacao: form.data_cotacao,
              fonte: form.fonte,
              url_fonte: form.url_fonte || null,
              nivel_confiabilidade: form.nivel_confiabilidade as any,
              observacao: form.observacao || null,
            },
          ],
        },
      });
      const r = res as { saved: number; skipped: string[] };
      setMsg(
        r.skipped.length
          ? `Salvas ${r.saved}. Ignoradas: ${r.skipped.join("; ")}`
          : `Cotação salva (${r.saved}).`,
      );
      setForm({ ...blank, categoria: form.categoria, fonte: form.fonte });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fnDelete({ data: { id } });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "rounded-md border border-border bg-background px-2 py-1 text-sm";

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-lg font-semibold">Cotações pecuárias</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Base própria por categoria e praça. A IA responde na ordem cidade → praça vizinha →
        região → estado, sempre com selo, data e fonte.
      </p>

      {err && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">{msg}</div>
      )}

      {/* Frescor por categoria */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {status.map((s) => (
          <div
            key={s.categoria}
            className={`rounded-md border px-3 py-2 text-sm ${
              s.vencido ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40"
            }`}
          >
            <div className="font-medium">
              {s.vencido ? "🔴" : "🟢"} {s.nome}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.registros} registro(s) ·{" "}
              {s.ultima_data
                ? `última ${s.ultima_data.split("-").reverse().join("/")} (${s.dias}d, validade ${s.validade}d)`
                : "sem cotação registrada"}
            </div>
          </div>
        ))}
      </div>

      {/* Lançamento */}
      <form onSubmit={submit} className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <select
          className={inputCls}
          value={form.categoria}
          onChange={(e) => {
            const c = categories.find((x) => x.slug === e.target.value);
            setForm({ ...form, categoria: e.target.value, unidade: c?.unidade_padrao ?? "@" });
          }}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={form.abrangencia}
          onChange={(e) => setForm({ ...form, abrangencia: e.target.value })}
        >
          <option value="municipal">Municipal</option>
          <option value="regional">Regional</option>
          <option value="estadual">Estadual</option>
          <option value="nacional">Nacional</option>
        </select>
        <select
          className={inputCls}
          value={form.cidade}
          onChange={(e) => setForm({ ...form, cidade: e.target.value })}
        >
          <option value="">— praça —</option>
          {places
            .slice()
            .sort((a, b) => a.municipio.localeCompare(b.municipio))
            .map((p) => (
              <option key={p.slug} value={p.municipio}>
                {p.municipio}/{p.uf}
              </option>
            ))}
        </select>
        <input
          className={inputCls}
          placeholder={`Unidade (${selectedCategory?.unidade_padrao ?? "@"})`}
          value={form.unidade}
          onChange={(e) => setForm({ ...form, unidade: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Preço mínimo"
          value={form.preco_minimo}
          onChange={(e) => setForm({ ...form, preco_minimo: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Preço de referência *"
          value={form.preco_referencia}
          onChange={(e) => setForm({ ...form, preco_referencia: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Preço máximo"
          value={form.preco_maximo}
          onChange={(e) => setForm({ ...form, preco_maximo: e.target.value })}
        />
        <input
          className={inputCls}
          type="date"
          value={form.data_cotacao}
          onChange={(e) => setForm({ ...form, data_cotacao: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Condição de pagamento"
          value={form.condicao_pagamento}
          onChange={(e) => setForm({ ...form, condicao_pagamento: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="Fonte *"
          value={form.fonte}
          onChange={(e) => setForm({ ...form, fonte: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="URL da fonte"
          value={form.url_fonte}
          onChange={(e) => setForm({ ...form, url_fonte: e.target.value })}
        />
        <select
          className={inputCls}
          value={form.nivel_confiabilidade}
          onChange={(e) => setForm({ ...form, nivel_confiabilidade: e.target.value })}
        >
          <option value="alta">Confiabilidade alta</option>
          <option value="media">Confiabilidade média</option>
          <option value="baixa">Confiabilidade baixa</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Lançar cotação"}
        </button>
      </form>

      {/* Lista */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Categoria</th>
              <th className="py-1 pr-3">Praça</th>
              <th className="py-1 pr-3">Preço</th>
              <th className="py-1 pr-3">Data</th>
              <th className="py-1 pr-3">Fonte</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-1 pr-3">{r.categoria}</td>
                <td className="py-1 pr-3">
                  {r.cidade ?? (r.regiao || r.estado)}
                  {r.estado ? `/${r.estado}` : ""}{" "}
                  <span className="text-xs text-muted-foreground">({r.abrangencia})</span>
                </td>
                <td className="py-1 pr-3">
                  R$ {Number(r.preco_referencia).toFixed(2)}/{r.unidade}
                </td>
                <td className="py-1 pr-3">{r.data_cotacao.split("-").reverse().join("/")}</td>
                <td className="py-1 pr-3">{r.fonte}</td>
                <td className="py-1">
                  <button className="text-xs underline" onClick={() => remove(r.id)}>
                    excluir
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-sm text-muted-foreground">
                  Nenhuma cotação pecuária registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
