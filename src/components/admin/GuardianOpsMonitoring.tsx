import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import {
  guardianOperationalHealth,
} from "@/lib/guardian-ops.functions";
import type { GuardianOpsReport } from "@/lib/guardian/ops-health";

const number = (value: number) => new Intl.NumberFormat("pt-BR").format(value);
const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";
const usd = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
const milliseconds = (value: number | null) =>
  value === null ? "Sem dados" : (value / 1000).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  }) + " s";

const tone = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  critical: "border-red-300 bg-red-50 text-red-900",
  unknown: "border-slate-200 bg-slate-50 text-slate-800",
};

export function GuardianOpsMonitoring() {
  const request = useServerFn(guardianOperationalHealth);
  const [report, setReport] = useState<GuardianOpsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await request());
    } catch {
      setError("Não foi possível obter os indicadores. Verifique seu acesso e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-labelledby="guardian-ops-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="guardian-ops-heading" className="flex items-center gap-2 text-base font-semibold">
            <Activity size={18} aria-hidden="true" /> Operação do WhatsApp
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Últimas 24 horas versus 24 horas anteriores. Dados agregados: sem mensagens,
            telefones ou informações das fazendas. Inclui todo atendimento pelo WhatsApp,
            não apenas as operações da Guardiã.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={15} aria-hidden="true" />
          {loading ? "Analisando…" : "Atualizar saúde"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!report && loading && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Carregando indicadores…
        </p>
      )}
      {report && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Atualizado em {new Date(report.generatedAt).toLocaleString("pt-BR")}.
            {report.truncated ? " Amostra limitada: métricas podem estar incompletas." : ""}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Interações / anterior",
                value: number(report.current.turns) + " / " + number(report.previous.turns),
              },
              {
                label: "Falhas / anterior",
                value: percent(report.current.errorPercent) + " / " +
                  percent(report.previous.errorPercent),
              },
              {
                label: "Pendências há mais de 10 min",
                value: number(report.stalledPending),
              },
              {
                label: "Custo estimado / anterior",
                value: usd(report.current.estimatedCostUsd) + " / " +
                  usd(report.previous.estimatedCostUsd),
              },
              {
                label: "P95 de duração",
                value: milliseconds(report.current.p95DurationMs),
              },
              {
                label: "P95 de tokens de entrada",
                value: report.current.p95InputTokens === null
                  ? "Sem dados"
                  : number(report.current.p95InputTokens),
              },
              {
                label: "Interações com entrada ≥30 mil tokens",
                value: number(report.current.highTokenTurns),
              },
              {
                label: "Rastros da Guardiã / recibos",
                value: number(report.current.traces) + " / " +
                  number(report.current.confirmedWrites),
              },
            ].map((metric) => (
              <div key={metric.label} className="rounded-lg border border-border bg-background p-3">
                <span className="block text-xs text-muted-foreground">{metric.label}</span>
                <strong className="mt-1 block break-words text-sm">{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Sinais para investigação</h3>
              <ul className="space-y-2">
                {report.signals.map((signal) => (
                  <li
                    key={signal.id}
                    className={"rounded-lg border px-3 py-2 text-sm " + tone[signal.severity]}
                  >
                    {signal.message}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Custo por etapa</h3>
              {report.stages.length ? (
                <ul className="space-y-2 text-sm">
                  {report.stages.map((stage) => (
                    <li key={stage.name} className="flex justify-between gap-3 border-b py-1">
                      <span className="break-all">{stage.name} ({stage.count})</span>
                      <span className="shrink-0 font-medium">{usd(stage.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma etapa de custo detalhada nesta amostra.
                </p>
              )}
              {!!report.errorsByCode.length && (
                <>
                  <h3 className="mb-2 mt-4 text-sm font-semibold">Códigos de erro</h3>
                  <ul className="space-y-1 text-xs">
                    {report.errorsByCode.map((item) => (
                      <li key={item.code}>
                        {item.code}: {number(item.count)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={15} className="shrink-0" aria-hidden="true" />
            Indicadores de diagnóstico, não comprovantes de gravação. Sem reenvio
            automático de mensagens, sem acesso a dados da fazenda e sem ações destrutivas.
            Custos são estimativas, sujeitas à configuração das tarifas.
          </p>
        </>
      )}
    </section>
  );
}
