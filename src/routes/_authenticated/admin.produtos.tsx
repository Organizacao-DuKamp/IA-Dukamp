import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addProductAlias,
  deleteProductAlias,
  extractProductsFromKnowledge,
  listProductAliases,
  listProducts,
  listReviewQueue,
  resolveReview,
  updateProduct,
} from "@/lib/products.functions";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos · TPEC-IA" },
      { name: "description", content: "Gestão estruturada do catálogo de produtos da Dukamp." },
      { property: "og:title", content: "Produtos · TPEC-IA" },
      { property: "og:description", content: "Gestão estruturada do catálogo de produtos da Dukamp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProducts,
});

type Product = {
  id: string;
  official_name: string;
  slug: string;
  description: string | null;
  category: string | null;
  species: string | null;
  animal_phase: string | null;
  package_weight: string | null;
  indication: string | null;
  consumption: string | null;
  usage_instructions: string | null;
  composition: string | null;
  guarantee_levels: string | null;
  active: boolean;
  requires_review: boolean;
  is_duplicate: boolean;
};

type Alias = { id: string; alias: string; alias_normalized: string; origin: string };
type ReviewRow = { id: string; product_id: string | null; reason: string; details: unknown; status: string; created_at: string };

function AdminProducts() {
  const list = useServerFn(listProducts);
  const update = useServerFn(updateProduct);
  const listAliases = useServerFn(listProductAliases);
  const addAlias = useServerFn(addProductAlias);
  const delAlias = useServerFn(deleteProductAlias);
  const review = useServerFn(listReviewQueue);
  const resolve = useServerFn(resolveReview);
  const extract = useServerFn(extractProductsFromKnowledge);

  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);

  async function refresh() {
    try {
      const [p, r] = await Promise.all([list(), review()]);
      setProducts(p as Product[]);
      setReviews(r as ReviewRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function openProduct(p: Product) {
    setSelected(p);
    try {
      const rows = await listAliases({ data: { product_id: p.id } });
      setAliases(rows as Alias[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveField(field: keyof Product, value: unknown) {
    if (!selected) return;
    try {
      setBusy(`save:${String(field)}`);
      await update({ data: { id: selected.id, patch: { [field]: value } as Record<string, unknown> as never } });
      setSelected({ ...selected, [field]: value } as Product);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleAddAlias() {
    if (!selected || !newAlias.trim()) return;
    try {
      setBusy("alias:add");
      await addAlias({ data: { product_id: selected.id, alias: newAlias.trim() } });
      setNewAlias("");
      const rows = await listAliases({ data: { product_id: selected.id } });
      setAliases(rows as Alias[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteAlias(id: string) {
    if (!selected) return;
    setBusy(`alias:del:${id}`);
    try {
      await delAlias({ data: { id } });
      setAliases((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function runExtract(publish: boolean) {
    setBusy("extract");
    setLog(null);
    try {
      const res = (await extract({ data: { dryRun: !publish, publish } })) as {
        candidates?: number;
        published?: number;
        divergences?: number;
      };
      setLog(
        `Candidatos: ${res.candidates ?? 0} · Divergências: ${res.divergences ?? 0}${
          publish ? ` · Publicados: ${res.published ?? 0}` : " (dry-run)"
        }`,
      );
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleResolve(id: string, status: "aprovado" | "rejeitado" | "mesclado") {
    setBusy(`resolve:${id}`);
    try {
      await resolve({ data: { id, status } });
      setReviews((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const filtered = q.trim()
    ? products.filter(
        (p) =>
          p.official_name.toLowerCase().includes(q.toLowerCase()) ||
          (p.category ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (p.species ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : products;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Produtos Dukamp</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo estruturado usado pelo chatbot para respostas diretas (contagem, listagem, especificações).
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link to="/admin/base-conhecimento" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Base de conhecimento
            </Link>
            <Link to="/" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              Chat
            </Link>
          </div>
        </header>

        {err && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
            <button className="ml-3 underline" onClick={() => setErr(null)}>ok</button>
          </div>
        )}

        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={busy === "extract"}
              onClick={() => runExtract(false)}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80 disabled:opacity-50"
            >
              {busy === "extract" ? "Analisando…" : "Analisar base (dry-run)"}
            </button>
            <button
              disabled={busy === "extract"}
              onClick={() => runExtract(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Extrair e publicar
            </button>
            {log && <span className="ml-2 text-xs text-muted-foreground">{log}</span>}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h2 className="text-sm font-semibold">Catálogo ({products.length})</h2>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, categoria, espécie…"
                className="w-64 rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Espécie</th>
                    <th className="p-2 text-left">Categoria</th>
                    <th className="p-2 text-center">Ativo</th>
                    <th className="p-2 text-center">Revisar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => openProduct(p)}
                      className={`cursor-pointer border-b border-border/50 hover:bg-accent/40 ${
                        selected?.id === p.id ? "bg-accent/60" : ""
                      }`}
                    >
                      <td className="p-2 font-medium">{p.official_name}</td>
                      <td className="p-2 text-muted-foreground">{p.species ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{p.category ?? "—"}</td>
                      <td className="p-2 text-center">{p.active ? "✅" : "—"}</td>
                      <td className="p-2 text-center">{p.requires_review ? "⚠️" : ""}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Nenhum produto. Rode "Analisar base" para extrair a partir dos documentos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Selecione um produto ao lado para editar.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Nome oficial</label>
                  <input
                    key={`name-${selected.id}`}
                    defaultValue={selected.official_name}
                    onBlur={(e) => e.target.value !== selected.official_name && saveField("official_name", e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Espécie" value={selected.species} onSave={(v) => saveField("species", v)} />
                  <TextField label="Categoria" value={selected.category} onSave={(v) => saveField("category", v)} />
                  <TextField label="Fase" value={selected.animal_phase} onSave={(v) => saveField("animal_phase", v)} />
                </div>
                <TextField label="Embalagem" value={selected.package_weight} onSave={(v) => saveField("package_weight", v)} />
                <TextArea label="Indicação" value={selected.indication} onSave={(v) => saveField("indication", v)} />
                <TextArea label="Consumo diário" value={selected.consumption} onSave={(v) => saveField("consumption", v)} />
                <TextArea label="Modo de uso" value={selected.usage_instructions} onSave={(v) => saveField("usage_instructions", v)} />
                <TextArea label="Composição" value={selected.composition} onSave={(v) => saveField("composition", v)} rows={4} />
                <TextArea label="Níveis de garantia" value={selected.guarantee_levels} onSave={(v) => saveField("guarantee_levels", v)} rows={4} />
                <TextArea label="Descrição" value={selected.description} onSave={(v) => saveField("description", v)} rows={3} />

                <div className="flex items-center gap-4 border-t border-border pt-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => saveField("active", e.target.checked)}
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.requires_review}
                      onChange={(e) => saveField("requires_review", e.target.checked)}
                    />
                    Requer revisão
                  </label>
                </div>

                <div className="border-t border-border pt-3">
                  <h3 className="text-sm font-semibold">Sinônimos / apelidos</h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    O chatbot reconhece o produto quando o usuário digita qualquer um desses nomes.
                  </p>
                  <div className="mb-2 flex gap-2">
                    <input
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      placeholder="Novo apelido (ex: DK 80S)"
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      disabled={busy === "alias:add"}
                      onClick={handleAddAlias}
                      className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {aliases.map((a) => (
                      <li key={a.id} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                        <span>{a.alias}</span>
                        <span className="text-muted-foreground">({a.origin})</span>
                        <button
                          onClick={() => handleDeleteAlias(a.id)}
                          disabled={busy === `alias:del:${a.id}`}
                          className="text-destructive hover:underline"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {aliases.length === 0 && <li className="text-xs text-muted-foreground">Nenhum apelido.</li>}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3">
            <h2 className="text-sm font-semibold">Fila de revisão ({reviews.length})</h2>
            <p className="text-xs text-muted-foreground">
              Divergências detectadas durante a extração (ex: mesma composição em dois arquivos com nomes diferentes).
            </p>
          </div>
          <div className="max-h-[40vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Motivo</th>
                  <th className="p-2 text-left">Detalhes</th>
                  <th className="p-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="p-2 font-medium">{r.reason}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      <pre className="max-w-xl whitespace-pre-wrap break-words">{JSON.stringify(r.details, null, 2)}</pre>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleResolve(r.id, "aprovado")}
                          disabled={busy === `resolve:${r.id}`}
                          className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleResolve(r.id, "rejeitado")}
                          disabled={busy === `resolve:${r.id}`}
                          className="rounded-md border border-border px-2 py-1 text-xs"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reviews.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">
                      Sem itens pendentes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TextField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        key={`${label}-${value ?? ""}`}
        defaultValue={value ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (value ?? "")) onSave(v || null);
        }}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onSave, rows = 2 }: { label: string; value: string | null; onSave: (v: string | null) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <textarea
        key={`${label}-${value ?? ""}`}
        defaultValue={value ?? ""}
        rows={rows}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (value ?? "")) onSave(v || null);
        }}
        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
    </div>
  );
}
