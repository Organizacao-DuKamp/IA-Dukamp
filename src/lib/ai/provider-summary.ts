export interface ProviderSummary {
  provider: string;
  calls: number;
  failures: number;
  fallbacks: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  pricingConfigured: boolean;
  share: number;
}
export function summarizeProviders(rows: Array<{ metadata?: unknown }>): ProviderSummary[] {
  const stats = new Map<string, ProviderSummary>();
  for (const row of rows) {
    const metadata = row.metadata as { usage_events?: Array<Record<string, unknown>> } | undefined;
    for (const event of metadata?.usage_events ?? []) {
      const provider = String(event.provider ?? "openai");
      const item = stats.get(provider) ?? {
        provider,
        calls: 0,
        failures: 0,
        fallbacks: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        pricingConfigured: true,
        share: 0,
      };
      item.calls++;
      item.failures += event.success === false ? 1 : 0;
      item.fallbacks += event.fallback_from ? 1 : 0;
      const numeric = (key: string) =>
        typeof event[key] === "number" && Number.isFinite(event[key]) ? Number(event[key]) : 0;
      item.cost += numeric("estimated_cost_usd");
      item.inputTokens += numeric("input_tokens");
      item.outputTokens += numeric("output_tokens");
      item.latencyMs += numeric("duration_ms");
      item.pricingConfigured &&= event.pricing_configured === true;
      stats.set(provider, item);
    }
  }
  const total = [...stats.values()].reduce((n, s) => n + s.calls, 0);
  return [...stats.values()].map((s) => ({
    ...s,
    latencyMs: s.calls ? s.latencyMs / s.calls : 0,
    share: total ? (s.calls / total) * 100 : 0,
  }));
}
