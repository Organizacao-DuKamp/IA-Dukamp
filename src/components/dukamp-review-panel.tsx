import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listDuKampReviews, reviewDuKampProduct } from "@/lib/dukamp-knowledge.functions";
import { REVIEW_FIELDS, issueKey, reviewIsOperational } from "@/lib/rag/dukamp-package";
import type { CatalogEnvelope } from "@/lib/rag/dukamp-package";

const labels: Record<string, string> = {
  classificacao: "Classificação",
  indicacao: "Indicação e categorias",
  composicao: "Composição",
  garantias: "Garantias nutricionais",
  modo_de_usar: "Mistura, consumo e adaptação",
  restricoes: "Restrições e incompatibilidades",
  unidades_e_bases: "Unidades, bases e limites conferidos",
};

export function DuKampReviewPanel() {
  const list = useServerFn(listDuKampReviews),
    save = useServerFn(reviewDuKampProduct);
  const [records, setRecords] = useState<CatalogEnvelope[]>([]);
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [species, setSpecies] = useState<string[]>([]);
  const [available, setAvailable] = useState(false);
  const [attest, setAttest] = useState(false);
  const [release, setRelease] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const entry = records.find((r) => r.product.produto_id === selected);
  const refresh = useCallback(async () => {
    try {
      setRecords(JSON.parse(await list()) as CatalogEnvelope[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar revisões.");
    }
  }, [list]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  function choose(id: string) {
    const record = records.find((r) => r.product.produto_id === id);
    setSelected(id);
    setSource(
      record?.review?.source_id_aprovado ?? record?.product.principal_documental_source_id ?? "",
    );
    setReviewer(record?.review?.revisor_responsavel ?? "");
    setEvidence(record?.review?.evidencia_rotulo_atual ?? "");
    setNotes(record?.review?.observacoes ?? "");
    setFields(record?.review?.campos_validados ?? {});
    setResolutions(record?.review?.resolucoes ?? {});
    setSpecies(record?.review?.especies_autorizadas ?? []);
    setAvailable(record?.review?.disponibilidade_confirmada ?? false);
    setRelease(false);
    setAttest(false);
    setMessage(null);
  }
  async function submit() {
    if (!entry) return;
    setBusy(true);
    setMessage(null);
    try {
      await save({
        data: {
          produto_id: entry.product.produto_id,
          product_fingerprint: entry.fingerprint,
          source_id_aprovado: source,
          evidencia_rotulo_atual: evidence,
          revisor_responsavel: reviewer,
          campos_validados: fields,
          resolucoes: resolutions,
          especies_autorizadas: species as Array<"bovinos" | "equinos" | "ovinos" | "caprinos">,
          disponibilidade_confirmada: available,
          confirmar_responsabilidade_tecnica: true,
          liberar: release,
          observacoes: notes || null,
        },
      });
      await refresh();
      setAttest(false);
      setMessage(
        release
          ? "Revisão e liberação registradas com sua autoria e data."
          : "Revisão registrada. Uso operacional permanece bloqueado.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao registrar revisão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">Revisão técnica dos produtos Dukamp</h2>
        <p className="text-sm text-muted-foreground">
          Confronte a ficha com o rótulo vigente. Importar documentos ou gerar vetores não libera
          doses nem indicações.
        </p>
      </div>
      <div className="flex gap-3">
        <select
          aria-label="Produto para revisão"
          className="min-w-0 flex-1 rounded border bg-background p-2"
          value={selected}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Selecione um produto ou variante</option>
          {records.map((r) => (
            <option key={r.product.produto_id} value={r.product.produto_id}>
              {r.product.nome_comercial_documental} -{" "}
              {reviewIsOperational(r) ? "liberado" : "pendente"}
            </option>
          ))}
        </select>
        <button className="rounded border px-3 py-2" onClick={refresh}>
          Atualizar fichas
        </button>
      </div>
      {entry && (
        <div className="space-y-3">
          <p className="text-sm">{entry.product.descricao_documental}</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {entry.product.restricoes_documentais}
          </p>
          <label className="block text-sm">
            Versão documental conferida
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
            >
              {entry.product.fontes.map((s) => (
                <option
                  key={s.source_id}
                  value={s.source_id}
                  disabled={s.versao_papel === "historico_obsoleto"}
                >
                  {s.source_id} - {s.arquivo_original}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Responsável técnico autorizado
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
            />
          </label>
          <label className="block text-sm">
            Referência do rótulo vigente (arquivo ou link)
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              className="mt-1 block w-full rounded border bg-background p-2"
            />
          </label>
          {REVIEW_FIELDS.map((key) => (
            <label className="block text-sm" key={key}>
              {labels[key]}
              <textarea
                rows={3}
                value={fields[key] ?? ""}
                onChange={(e) => setFields((v) => ({ ...v, [key]: e.target.value }))}
                className="mt-1 block w-full rounded border bg-background p-2"
              />
            </label>
          ))}
          {entry.product.bloqueios.map((issue, index) => {
            const key = issueKey(issue, index);
            return (
              <label key={key} className="block text-sm">
                <span className="block text-destructive">Pendência: {issue.descricao}</span>
                <textarea
                  rows={2}
                  placeholder="Descreva a resolução e a evidência conferida"
                  value={resolutions[key] ?? ""}
                  onChange={(e) => setResolutions((v) => ({ ...v, [key]: e.target.value }))}
                  className="mt-1 block w-full rounded border bg-background p-2"
                />
              </label>
            );
          })}
          <label className="block text-sm">
            Observações da revisão
            <textarea
              className="mt-1 w-full rounded border bg-background p-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <fieldset>
            <legend className="text-sm">Espécies autorizadas no rótulo conferido</legend>
            <div className="flex flex-wrap gap-4">
              {["bovinos", "equinos", "ovinos", "caprinos"].map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={species.includes(s)}
                    onChange={(e) =>
                      setSpecies((v) => (e.target.checked ? [...v, s] : v.filter((x) => x !== s)))
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Conferi a vigência e a disponibilidade atual desta variante.
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={release}
              onChange={(e) => setRelease(e.target.checked)}
            />
            Liberar uso operacional após resolver todas as pendências.
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
            Sou responsável técnico autorizado e conferi os campos e as evidências desta revisão.
          </label>
          <button
            disabled={!attest || busy}
            onClick={submit}
            className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Registrando…" : "Registrar revisão"}
          </button>
          {entry.review && (
            <p className="text-xs text-muted-foreground">
              Última revisão: {entry.review.revisor_responsavel}, {entry.review.data_revisao}. A
              revisão fica vinculada à versão e aos dados desta ficha.
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
