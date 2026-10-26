import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  guardianIntelligenceOverview,
  guardianResolveReview,
  guardianReviewSource,
} from "@/lib/guardian.functions";

export function GuardianReviewQueue() {
  const overview = useServerFn(guardianIntelligenceOverview),
    resolve = useServerFn(guardianResolveReview),
    source = useServerFn(guardianReviewSource);
  const [data, setData] = useState<Awaited<ReturnType<typeof guardianIntelligenceOverview>> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<{ id: string; text: string } | null>(null),
    [confirm, setConfirm] = useState<{ id: string; status: "resolved" | "rejected" } | null>(null);
  const refresh = useCallback(async () => {
    try {
      setError("");
      setData(await overview());
    } catch (e) {
      setData(null);
      setQuote(null);
      setConfirm(null);
      setError(e instanceof Error ? e.message : "Fila indisponível.");
    }
  }, [overview]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const reasons: Record<string, string> = {
    ambiguous_property: "Propriedade ambígua",
    ambiguous_date: "Data a esclarecer",
    conflict: "Saldo ou informação conflitante",
    persistence_failure: "Falha de gravação",
  };
  async function decision() {
    if (!confirm || busy) return;
    setBusy(true);
    setError("");
    try {
      await resolve({ data: confirm });
      setConfirm(null);
      setQuote(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível encerrar a revisão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Inteligência e revisão"
      className="space-y-5 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Inteligência e revisão</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pendências de interpretação e consistência, sem alterar silenciosamente os relatos
            originais.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          Atualizar fila
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!data && !error && (
        <p role="status" className="text-sm">
          Carregando indicadores…
        </p>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              ["Propriedades", data.farms],
              ["Sem nome informado", data.unnamed],
              ["A revisar", data.pending],
              ["Resolvidas", data.resolved],
              ["Rejeitadas", data.rejected],
            ].map(([label, value]) => (
              <article key={label} className="rounded-xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <strong className="mt-2 block text-2xl">{value}</strong>
              </article>
            ))}
          </div>
          {confirm && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm">
              <p>
                {confirm.status === "rejected"
                  ? "Rejeitar esta interpretação?"
                  : "Marcar como resolvida após conferir e corrigir os registros necessários?"}{" "}
                Esta decisão fica na auditoria e preserva a mensagem original.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  disabled={busy}
                  onClick={() => void decision()}
                  className="rounded bg-emerald-900 px-4 py-2 text-white"
                >
                  Confirmar decisão
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                  className="rounded border px-4 py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {data.entries.map((e) => (
              <article key={e.id} className="rounded-xl border p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{reasons[e.reason] ?? e.reason}</strong>
                  <time className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </time>
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {e.property_id
                    ? `Propriedade: ${e.property_id}`
                    : "A propriedade ainda precisa ser identificada"}
                  . Origem: {e.message_id}.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void source({ data: { id: e.id } })
                        .then((s) =>
                          setQuote({
                            id: e.id,
                            text:
                              s.quote ??
                              "O trecho não está disponível para exibição segura. Confira o histórico autorizado antes de decidir.",
                          }),
                        )
                        .catch(() => setError("Não foi possível consultar a origem."))
                        .finally(() => setBusy(false));
                    }}
                    className="text-emerald-800 underline"
                  >
                    Ver origem
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm({ id: e.id, status: "resolved" })}
                    className="text-emerald-800 underline"
                  >
                    Marcar resolvida
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm({ id: e.id, status: "rejected" })}
                    className="text-red-800 underline"
                  >
                    Rejeitar interpretação
                  </button>
                </div>
                {quote?.id === e.id && (
                  <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-emerald-700 pl-3 text-muted-foreground">
                    {quote.text}
                  </blockquote>
                )}
              </article>
            ))}
          </div>
          {!data.entries.length && (
            <p className="py-5 text-sm text-muted-foreground">Nenhuma pendência de revisão.</p>
          )}
          {data.partial && (
            <p className="text-xs text-muted-foreground">
              Exibindo as 50 pendências mais antigas. Encerre as revisões concluídas para avançar.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Contagens de revisão medem o trabalho de conferência, não a veracidade dos dados nem a
            qualidade global da IA. Uso de modelos, custos e latência continuam no painel
            administrativo de IA.
          </p>
        </>
      )}
    </section>
  );
}
