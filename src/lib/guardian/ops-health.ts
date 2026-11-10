/**
 * Read-only, privacy-preserving operational monitoring of WhatsApp turns.
 * No producer messages, numbers or farm records are read or returned.
 */
export type GuardianOpsTurn = {
  channel?: string | null;
  status?: string | null;
  created_at: string;
  duration_ms?: number | null;
  input_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost_usd?: number | null;
  pricing_configured?: boolean | null;
  error_code?: string | null;
  metadata?: unknown;
};

type OpsWindow = {
  turns: number;
  completed: number;
  errors: number;
  pending: number;
  errorPercent: number;
  estimatedCostUsd: number;
  avgCostUsd: number;
  p95DurationMs: number | null;
  p95InputTokens: number | null;
  highTokenTurns: number;
  pricingIncomplete: number;
  traces: number;
  confirmedWrites: number;
  replays: number;
};

type OpsSignal = {
  id: string;
  severity: "ok" | "warning" | "critical" | "unknown";
  message: string;
};

export type GuardianOpsReport = {
  generatedAt: string;
  windowHours: 24;
  source: "whatsapp_turns";
  truncated: boolean;
  current: OpsWindow;
  previous: OpsWindow;
  stalledPending: number;
  errorsByCode: Array<{ code: string; count: number }>;
  stages: Array<{ name: string; count: number; costUsd: number }>;
  signals: OpsSignal[];
};

const DAY_MS = 86_400_000;
const nonnegative = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
const pct = (part: number, total: number): number =>
  total ? Math.round((part / total) * 10_000) / 100 : 0;
const p95 = (items: number[]): number | null => {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
};
const object = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

function summarize(rows: GuardianOpsTurn[]): OpsWindow {
  const errors = rows.filter((row) => row.status === "error").length;
  const validDurations = rows
    .map((row) => row.duration_ms)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0);
  const validTokens = rows
    .map((row) => row.input_tokens)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0);
  const totalCost = rows.reduce((sum, row) => sum + nonnegative(row.estimated_cost_usd), 0);
  const traceRows = rows.map((row) => object(object(row.metadata).guardian));
  return {
    turns: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    errors,
    pending: rows.filter((row) => row.status === "pending").length,
    errorPercent: pct(errors, rows.length),
    estimatedCostUsd: Math.round(totalCost * 1e8) / 1e8,
    avgCostUsd: rows.length ? Math.round((totalCost / rows.length) * 1e8) / 1e8 : 0,
    p95DurationMs: p95(validDurations),
    p95InputTokens: p95(validTokens),
    highTokenTurns: rows.filter((row) => nonnegative(row.input_tokens) >= 30_000).length,
    pricingIncomplete: rows.filter((row) => row.pricing_configured === false).length,
    traces: traceRows.filter((row) => row.version === 1).length,
    confirmedWrites: traceRows.filter(
      (row) => row.version === 1 && row.stage === "receipt" && row.status === "completed",
    ).length,
    replays: traceRows.filter((row) => row.version === 1 && row.status === "replay").length,
  };
}

/** Only sanitized aggregated metrics leave this function. */
export function guardianOpsReport(
  turns: GuardianOpsTurn[],
  at: Date,
  truncated = false,
): GuardianOpsReport {
  const now = at.getTime();
  if (!Number.isFinite(now)) throw new Error("invalid_monitoring_clock");
  const start = now - DAY_MS;
  const baseline = start - DAY_MS;
  const relevant = turns.filter((turn) => {
    const timestamp = Date.parse(turn.created_at);
    return turn.channel === "whatsapp" && timestamp >= baseline && timestamp <= now;
  });
  const currentRows = relevant.filter((row) => Date.parse(row.created_at) >= start);
  const previousRows = relevant.filter((row) => Date.parse(row.created_at) < start);
  const current = summarize(currentRows);
  const previous = summarize(previousRows);
  const stalledPending = currentRows.filter(
    (row) => row.status === "pending" && now - Date.parse(row.created_at) > 10 * 60_000,
  ).length;

  const errors = new Map<string, number>();
  const stages = new Map<string, { name: string; count: number; costUsd: number }>();
  for (const row of currentRows) {
    if (row.status === "error") {
      // Avoid echoing raw diagnostic messages or producer-provided text.
      const code = String(row.error_code ?? "sem_codigo");
      const safe = /^[a-zA-Z][\w-]{0,63}$/.test(code) ? code : "outros";
      errors.set(safe, (errors.get(safe) ?? 0) + 1);
    }
    const usage = object(row.metadata).usage_events;
    if (!Array.isArray(usage)) continue;
    for (const entry of usage.slice(0, 32)) {
      const value = object(entry);
      const name = value.stage;
      if (typeof name !== "string" || !/^[a-z][a-z_0-9-]{0,63}$/i.test(name))
        continue;
      const currentStage = stages.get(name) ?? { name, count: 0, costUsd: 0 };
      currentStage.count += 1;
      currentStage.costUsd += nonnegative(value.estimated_cost_usd);
      stages.set(name, currentStage);
    }
  }

  const signals: OpsSignal[] = [];
  if (truncated)
    signals.push({
      id: "sample",
      severity: "unknown",
      message: "A amostra atingiu o limite. Os totais podem estar incompletos.",
    });
  if (!current.turns)
    signals.push({
      id: "no-data",
      severity: "unknown",
      message: "Nenhuma interação WhatsApp observada nas últimas 24 horas; isso não comprova disponibilidade.",
    });
  if (stalledPending)
    signals.push({
      id: "pending",
      severity: "critical",
      message: String(stalledPending) + " interação(ões) pendente(s) há mais de 10 minutos.",
    });
  if (current.turns >= 20 && current.errorPercent >= 5)
    signals.push({
      id: "errors",
      severity: "warning",
      message: "Falhas atingiram " + current.errorPercent.toFixed(1) + "% do WhatsApp em 24 horas.",
    });
  if (current.turns >= 10 && current.p95InputTokens !== null && current.p95InputTokens > 30_000)
    signals.push({
      id: "tokens",
      severity: "warning",
      message: "P95 de entrada ultrapassou 30 mil tokens. Revisar o contexto do planejador.",
    });
  if (
    current.turns >= 10 &&
    previous.turns >= 10 &&
    previous.avgCostUsd > 0 &&
    current.avgCostUsd >= 2 * previous.avgCostUsd
  )
    signals.push({
      id: "cost",
      severity: "warning",
      message: "Custo estimado médio por interação dobrou em relação às 24 horas anteriores.",
    });
  if (current.pricingIncomplete)
    signals.push({
      id: "pricing",
      severity: "unknown",
      message: "Algumas interações não têm preço completo configurado; custos podem estar subestimados.",
    });
  if (!signals.length)
    signals.push({
      id: "no-alert",
      severity: "ok",
      message: "Nenhum limite desta amostra foi ultrapassado. Não substitui testes reais de gravação.",
    });

  return {
    generatedAt: at.toISOString(),
    windowHours: 24,
    source: "whatsapp_turns",
    truncated,
    current,
    previous,
    stalledPending,
    errorsByCode: [...errors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
    stages: [...stages.values()]
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 8)
      .map((stage) => ({
        ...stage,
        costUsd: Math.round(stage.costUsd * 1e8) / 1e8,
      })),
    signals,
  };
}
