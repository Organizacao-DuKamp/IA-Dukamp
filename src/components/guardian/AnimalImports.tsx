import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  RefreshCw,
  Check,
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
} from "lucide-react";
import { installedPanel } from "@/lib/guardian/app-mode";
import { animalFieldLabels, type AnimalProfile } from "@/lib/guardian/animal-profile";
import type { ImportRow, ImportSource } from "@/lib/guardian/imports";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
interface View {
  batch: { id: string; revision: number; status: string; last_error?: string | null } | null;
  rows: ImportRow[];
  files: ImportSource[];
  page: number;
  total: number;
  totals?: {
    identified: number;
    validated: number;
    created: number;
    updated: number;
    duplicates: number;
    pending: number;
  };
}
const endpoint = "/api/public/farm-panel/imports";
const statusName: Record<string, string> = {
  collecting: "Recebendo arquivos",
  reading: "Lendo os arquivos",
  review: "Lista para conferir",
  importing: "Cadastrando os aprovados",
  completed: "Cadastro concluído",
  cancelled: "Preparação cancelada",
  created: "Cadastrado",
  updated: "Atualizado",
  duplicate: "Repetido",
  excluded: "Retirado da lista",
  error: "Precisa de revisão",
  approved: "Aprovado",
  complete: "Leitura concluída",
  queued: "Aguardando leitura",
};
async function call(url: string, body?: unknown) {
  const form = body instanceof FormData;
  const r = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "x-tpec-panel": "1",
      "x-tpec-panel-mode": installedPanel() ? "installed" : "browser",
      ...(!form && body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error ?? "Não foi possível concluir esta etapa.");
  return d;
}
export function AnimalImports({
  farmName,
  onImported,
}: {
  farmName: string;
  onImported: () => void;
}) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [sex, setSex] = useState(""),
    [year, setYear] = useState(""),
    [sort, setSort] = useState("code"),
    [selected, setSelected] = useState<string[]>([]),
    [editing, setEditing] = useState<ImportRow | null>(null),
    [priceInputs, setPriceInputs] = useState<Record<string, string>>({}),
    [fields, setFields] = useState<string[]>([]),
    [confirm, setConfirm] = useState(false);
  const params = new URLSearchParams({ page: String(page), q: query, sex, year, sort });
  const qs = params.toString();
  const refresh = useCallback(async () => {
    try {
      setView(await call(endpoint + "?" + qs));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [qs]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 7000);
    return () => clearInterval(timer);
  }, [refresh]);
  const mutate = async (kind: string, data: Record<string, unknown> = {}) => {
    if (!view?.batch) return;
    setBusy(true);
    try {
      const result = await call(endpoint, {
        kind,
        batchId: view.batch.id,
        revision: view.batch.revision,
        ...data,
      });
      setNotice(result.message);
      setSelected([]);
      setConfirm(false);
      setEditing(null);
      await refresh();
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const file of Array.from(files)) {
        if (file.size > 4 * 1024 * 1024)
          throw Error(
            `${file.name}: o limite é 4 MB por arquivo no painel. Pelo WhatsApp, envie até 25 MB.`,
          );
        const form = new FormData();
        form.set("file", file);
        await call(endpoint, form);
      }
      setNotice("Arquivos recebidos. A leitura aparece aqui em instantes.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (format: string) => {
    try {
      const r = await fetch(endpoint + "?" + qs + "&export=" + format, {
        headers: { "x-tpec-panel-mode": installedPanel() ? "installed" : "browser" },
        credentials: "same-origin",
      });
      if (!r.ok) throw Error("Não consegui exportar a lista.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `animais.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="min-w-0 space-y-5 print:space-y-2" aria-label="Importação de animais">
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Importação de animais</h2>
            <p className="mt-1 text-sm text-slate-600">
              Destino: <strong>{farmName}</strong>. Primeiro confira a lista; depois autorize o
              cadastro.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} aria-label="Atualizar importação">
            <RefreshCw size={20} />
          </button>
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-600 bg-emerald-50 p-5 font-semibold text-emerald-950 print:hidden">
          <Upload size={22} />
          {busy ? "Enviando…" : "Enviar PDF, fotos ou planilha"}
          <input
            className="sr-only"
            type="file"
            multiple
            accept=".pdf,.csv,.xlsx,.xls,.tsv,image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => void upload(e.target.files)}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          PDF da ABCZ ou de terceiros, Excel (.xlsx/.xls) e CSV, com um ou vários animais. Até 4 MB
          por arquivo neste painel (25 MB pelo WhatsApp) e 100 páginas por PDF. Os lotes iniciados
          no WhatsApp também aparecem aqui.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
          {notice}
        </p>
      )}
      {view?.batch?.last_error && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">
          {view.batch.last_error}
        </p>
      )}
      {view?.batch && (
        <>
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">{statusName[view.batch.status] ?? view.batch.status}</h3>
            <p className="text-sm">
              {view.totals?.identified ?? 0} identificados · {view.totals?.validated ?? 0} validados
              · {view.totals?.created ?? 0} cadastrados · {view.totals?.updated ?? 0} atualizados ·{" "}
              {view.totals?.duplicates ?? 0} repetidos
            </p>
            <div className="mt-3 space-y-2">
              {view.files.map((f) => (
                <div key={f.id} className="flex min-w-0 gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <FileText className="shrink-0" size={18} />
                  <div className="min-w-0">
                    <p className="break-words font-medium">{f.filename}</p>
                    <p>
                      {statusName[f.status] ?? f.status} · {f.completed_pages} página(s)
                      processada(s)
                    </p>
                    {f.error && <p className="text-rose-700">{f.error}</p>}
                  </div>
                </div>
              ))}
            </div>
            {view.files.some((f) => f.status === "error") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate("retry")}
                className="mt-3 rounded-xl border p-3"
              >
                Tentar ler os arquivos com erro novamente
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 print:hidden">
            <input
              aria-label="Pesquisar na lista"
              placeholder="Buscar nome ou identificação"
              className="min-w-0 rounded-xl border p-3"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
                setSelected([]);
              }}
            />
            <select
              aria-label="Filtrar por sexo"
              className="rounded-xl border p-3"
              value={sex}
              onChange={(e) => {
                setSex(e.target.value);
                setPage(1);
                setSelected([]);
              }}
            >
              <option value="">Machos e fêmeas</option>
              <option value="female">Fêmeas</option>
              <option value="male">Machos</option>
            </select>
            <input
              aria-label="Ano de nascimento"
              placeholder="Ano de nascimento"
              inputMode="numeric"
              maxLength={4}
              className="min-w-0 rounded-xl border p-3"
              value={year}
              onChange={(e) => {
                setYear(e.target.value.replace(/\D/g, ""));
                setPage(1);
              }}
            />
            <select
              aria-label="Ordenar lista"
              className="rounded-xl border p-3"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="code">Identificação</option>
              <option value="rgn">RGN</option>
              <option value="name">Nome</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={() => void download("csv")}
              className="flex items-center gap-1 rounded-xl border p-3"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => void download("xlsx")}
              className="rounded-xl border p-3"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => void download("pdf")}
              className="rounded-xl border p-3"
            >
              PDF completo
            </button>
          </div>
          <p className="text-sm">
            {view.total} registros nesta seleção. Página {page} de{" "}
            {Math.max(1, Math.ceil(view.total / 25))}.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {view.rows.map((r) => (
              <article key={r.id} className="min-w-0 rounded-2xl border bg-white p-4">
                <div className="flex items-start gap-3">
                  <input
                    aria-label={`Selecionar ${r.profile.code ?? "registro sem identificação"}`}
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    disabled={r.status !== "review" || r.issues.length > 0 || busy}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((id) => id !== r.id),
                      )
                    }
                    className="mt-1 h-5 w-5 print:hidden"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words font-semibold">
                      {r.profile.code ?? "Sem identificação"} · {r.profile.name ?? "Sem nome"}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {r.profile.sex === "female"
                        ? "Fêmea"
                        : r.profile.sex === "male"
                          ? "Macho"
                          : "Sexo não informado"}{" "}
                      · {r.profile.birthDate ?? "Nascimento não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {view.files.find((f) => f.id === r.source_id)?.filename} · página {r.page},
                      linha {r.ordinal}
                    </p>
                    <p className="mt-1 text-sm">{statusName[r.status] ?? r.status}</p>
                    {r.issues.map((issue, i) => (
                      <p key={i} className="mt-1 flex gap-1 text-sm text-amber-800">
                        <AlertCircle size={16} className="shrink-0" />
                        {issue}
                      </p>
                    ))}
                    {r.result && <p className="text-sm">{r.result}</p>}
                    <div className="mt-3 flex gap-2 print:hidden">
                      {["review", "error", "duplicate", "excluded"].includes(r.status) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditing(structuredClone(r));
                            setPriceInputs({});
                            setFields(r.update_fields);
                          }}
                          className="rounded-lg border px-3 py-2"
                        >
                          Conferir / corrigir
                        </button>
                      )}
                      {r.status === "review" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void mutate("exclude", { id: r.id })}
                          className="rounded-lg border px-3 py-2 text-rose-700"
                        >
                          Retirar da lista
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="flex items-center justify-between print:hidden">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-xl border p-3 disabled:opacity-40"
            >
              <ChevronLeft />
            </button>
            <span>Página {page}</span>
            <button
              type="button"
              disabled={page * 25 >= view.total}
              onClick={() => setPage(page + 1)}
              className="rounded-xl border p-3 disabled:opacity-40"
            >
              <ChevronRight />
            </button>
          </div>
          {view.batch.status === "review" && (
            <div className="flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-900 p-4 font-semibold text-white"
              >
                <Check size={20} />
                {selected.length
                  ? `Cadastrar ${selected.length} selecionados`
                  : "Cadastrar todos os validados"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate("cancel")}
                className="rounded-xl border p-3"
              >
                Cancelar preparação
              </button>
            </div>
          )}
        </>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cadastro em {farmName}?</DialogTitle>
            <DialogDescription>
              {selected.length
                ? `${selected.length} linhas selecionadas`
                : "Todos os registros validados da seleção atual, incluindo outras páginas"}
              . Dados existentes serão preservados; atualizações usarão somente os campos
              escolhidos. Pendências ficam para revisão.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-900 p-4 font-semibold text-white"
            onClick={() =>
              void mutate("approve", {
                ids: selected.length ? selected : undefined,
                filter: { query, sex, year },
              })
            }
          >
            Confirmar cadastro
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferir registro</DialogTitle>
            <DialogDescription>
              Estas alterações ficam na lista. Se o animal já existir, marque os campos que deseja
              atualizar após a aprovação.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <>
              <div className="grid gap-3">
                {Object.entries(animalFieldLabels)
                  .filter(([k]) => k !== "pedigree")
                  .map(([key, label]) => {
                    const k = key as keyof AnimalProfile;
                    return (
                      <label key={key} className="text-sm">
                        {label}
                        {key === "sex" || key === "status" ? (
                          <select
                            className="mt-1 w-full rounded-lg border p-2"
                            value={String(editing.profile[k] ?? "")}
                            onChange={(e) => {
                              const profile = { ...editing.profile };
                              if (e.target.value) Object.assign(profile, { [k]: e.target.value });
                              else delete profile[k];
                              setEditing({ ...editing, profile });
                            }}
                          >
                            <option value="">Não informado</option>
                            {Object.entries(
                              key === "sex"
                                ? { male: "Macho", female: "Fêmea", unknown: "Não informado" }
                                : {
                                    active: "Ativo",
                                    sold: "Vendido",
                                    dead: "Morto",
                                    transferred: "Transferido",
                                  },
                            ).map(([value, name]) => (
                              <option key={value} value={value}>
                                {name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="mt-1 w-full rounded-lg border p-2"
                            type={/Date$/.test(key) ? "date" : "text"}
                            inputMode={/Kg$|Cents$|Percent$/.test(key) ? "decimal" : undefined}
                            value={
                              /Cents$/.test(key) && editing.profile[k] !== undefined
                                ? (priceInputs[key] ??
                                  (Number(editing.profile[k]) / 100).toFixed(2).replace(".", ","))
                                : String(editing.profile[k] ?? "")
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/Cents$/.test(key))
                                setPriceInputs({ ...priceInputs, [key]: value });
                              const profile = { ...editing.profile };
                              if (value)
                                Object.assign(profile, {
                                  [k]: /Cents$/.test(key)
                                    ? Math.round(Number(value.replace(",", ".")) * 100)
                                    : /Kg$|Percent$/.test(key)
                                      ? Number(value.replace(",", "."))
                                      : value,
                                });
                              else delete profile[k];
                              setEditing({ ...editing, profile });
                            }}
                          />
                        )}
                        {key !== "code" && (
                          <span className="mt-1 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fields.includes(key)}
                              onChange={(e) =>
                                setFields(
                                  e.target.checked
                                    ? [...fields, key]
                                    : fields.filter((f) => f !== key),
                                )
                              }
                            />
                            Atualizar este campo se já cadastrado
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
              {editing.profile.pedigree && (
                <p className="text-sm">
                  {editing.profile.pedigree.length} ascendentes extraídos.{" "}
                  <label>
                    <input
                      type="checkbox"
                      checked={fields.includes("pedigree")}
                      onChange={(e) =>
                        setFields(
                          e.target.checked
                            ? [...fields, "pedigree"]
                            : fields.filter((f) => f !== "pedigree"),
                        )
                      }
                    />{" "}
                    Atualizar genealogia (confira pai e mãe)
                  </label>
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void mutate("edit", {
                    id: editing.id,
                    profile: editing.profile,
                    updateFields: fields,
                  })
                }
                className="rounded-xl bg-emerald-900 p-3 text-white"
              >
                Salvar correção na lista
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
