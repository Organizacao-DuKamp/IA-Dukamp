import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { verifyAIProviders } from "@/lib/ai-health.functions";
import {
  HEALTH_LABELS,
  HEALTH_PROVIDERS,
  type HealthReport,
  type HealthStatus,
} from "@/lib/ai/health";

function statusColor(status: HealthStatus) {
  if (status === "operational" || status === "balance_available")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "no_credits" || status === "invalid_key")
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

export function AIHealthCheck() {
  const verify = useServerFn(verifyAIProviders);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function check() {
    if (inFlight.current) return;
    // Reopening the dialog reuses the last result, even across server instances.
    if (report && Date.now() < Date.parse(report.nextCheckAt)) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      setReport(await verify());
    } catch {
      setError(
        "Não foi possível verificar as IAs. Confira sua sessão administrativa e tente novamente.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void check();
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
      >
        <Activity className="h-4 w-4" /> Verificar IA
      </button>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" /> Verificar IA
          </DialogTitle>
          <DialogDescription>
            Confira quais provedores estão disponíveis e quais precisam de créditos ou ajustes.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-sm">
          DeepSeek: consulta de saldo sem gerar texto. Demais IAs: uma solicitação curtíssima no
          modelo econômico, sem histórico ou documentos. Pode haver cobrança mínima, inclusive taxa
          por requisição do provedor.
          <p className="mt-1 text-xs text-muted-foreground">
            Resultados reaproveitados por 5 minutos. O teste não verifica todos os modelos nem
            garante pesquisas, mídia ou disponibilidade futura.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div aria-live="polite" aria-busy={loading} className="grid gap-3 sm:grid-cols-2">
          {HEALTH_PROVIDERS.map((provider) => {
            const result = report?.providers.find((item) => item.provider === provider.id);
            return (
              <section key={provider.id} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-base font-semibold">{provider.name}</h3>
                <div className="my-3">
                  {loading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
                    </span>
                  ) : result ? (
                    <span
                      className={`inline-block rounded-md border px-2 py-1 text-xs font-semibold ${statusColor(result.status)}`}
                    >
                      {HEALTH_LABELS[result.status]}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Aguardando verificação</span>
                  )}
                </div>
                {result && !loading && (
                  <>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    <div className="mt-3 border-t border-border pt-3 text-sm">
                      <span className="font-medium">Saldo restante: </span>
                      {result.balances.length
                        ? result.balances
                            .map((balance) =>
                              new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: balance.currency,
                                maximumFractionDigits: 4,
                              }).format(balance.amount),
                            )
                            .join(" · ")
                        : "não disponível"}
                    </div>
                    {result.model && (
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        Modelo testado: {result.model}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verificado em {new Date(result.checkedAt).toLocaleString("pt-BR")}
                    </p>
                  </>
                )}
                <a
                  href={provider.billingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
                >
                  Saldo e recarga no provedor <ExternalLink className="h-3 w-3" />
                </a>
              </section>
            );
          })}
        </div>
        {report && !report.multimodelEnabled && (
          <p className="text-xs text-muted-foreground">
            O roteamento multimodelo está desativado neste ambiente. Os testes mostram a
            disponibilidade das chaves configuradas.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {report
              ? `Novo teste disponível após ${new Date(report.nextCheckAt).toLocaleTimeString("pt-BR")}.${report.cached ? " Resultado reaproveitado." : ""}`
              : "A verificação começa ao abrir esta tela."}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void check()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Verificar novamente
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
