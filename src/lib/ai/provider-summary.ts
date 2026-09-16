export const ACTIVE_PROVIDERS = ["openai", "gemini", "deepseek", "perplexity"] as const;
export function providerName(provider: string): string {
  return (
    (
      {
        openai: "OpenAI",
        gemini: "Gemini",
        deepseek: "DeepSeek",
        perplexity: "Perplexity",
        unassigned: "Não atribuído",
      } as Record<string, string>
    )[provider] ?? `${provider} (histórico)`
  );
}
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
export interface SpendRow {
  metadata?: unknown;
  estimated_cost_usd?: number;
  pricing_configured?: boolean;
  model?: string | null;
  user_key?: string;
  conversation_id?: string;
}
export interface SpendSummary {
  providers: ProviderSummary[];
  totalCost: number;
  pricingConfigured: boolean;
  leaders: ProviderSummary[];
  turns: number;
}
export interface ProviderSpendAnalytics extends SpendSummary {
  users: Array<SpendSummary & { userKey: string }>;
  conversations: Array<SpendSummary & { userKey: string; conversationId: string }>;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function blank(provider: string): ProviderSummary {
  return {
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
}
function legacyProvider(model: unknown): string {
  if (typeof model !== "string") return "unassigned";
  if (/gpt|text-embedding|whisper|\bo[134]\b/i.test(model)) return "openai";
  if (/gemini/i.test(model)) return "gemini";
  if (/deepseek/i.test(model)) return "deepseek";
  if (/sonar/i.test(model)) return "perplexity";
  return "unassigned";
}
export function summarizeProviders(rows: SpendRow[]): ProviderSummary[] {
  const stats = new Map<string, ProviderSummary>();
  const itemFor = (provider: string) => {
    if (!stats.has(provider)) stats.set(provider, blank(provider));
    return stats.get(provider)!;
  };
  for (const row of rows) {
    const raw = object(row.metadata).usage_events;
    const events = Array.isArray(raw)
      ? raw.filter((e) => e && typeof e === "object" && !Array.isArray(e)).map(object)
      : [];
    const providers = new Set<string>();
    let eventTotal = 0;
    for (const event of events) {
      const provider =
        typeof event.provider === "string" && event.provider.trim()
          ? event.provider.trim().toLowerCase()
          : legacyProvider(event.model ?? row.model);
      providers.add(provider);
      const item = itemFor(provider);
      item.calls++;
      item.failures += event.success === false ? 1 : 0;
      item.fallbacks += event.fallback_from ? 1 : 0;
      const cost = numeric(event.estimated_cost_usd);
      eventTotal += cost;
      item.cost += cost;
      item.inputTokens += numeric(event.input_tokens);
      item.outputTokens += numeric(event.output_tokens);
      item.latencyMs += numeric(event.duration_ms);
      const hasEventCost =
        typeof event.estimated_cost_usd === "number" &&
        Number.isFinite(event.estimated_cost_usd) &&
        event.estimated_cost_usd >= 0;
      item.pricingConfigured &&= hasEventCost
        ? event.pricing_configured === true
        : row.pricing_configured === true;
    }
    // Historical single-provider totals are exact, even without individual call prices.
    // Mixed-provider remainder stays unassigned; never fabricate a proportional split.
    const remainder = Math.max(0, numeric(row.estimated_cost_usd) - eventTotal);
    if (remainder > 0) {
      const provider =
        providers.size === 1
          ? [...providers][0]
          : providers.size === 0
            ? legacyProvider(row.model)
            : "unassigned";
      const item = itemFor(provider);
      item.cost += remainder;
      item.pricingConfigured &&= row.pricing_configured === true && provider !== "unassigned";
    }
    if (row.pricing_configured === false)
      for (const provider of providers) itemFor(provider).pricingConfigured = false;
  }
  const total = [...stats.values()].reduce((n, s) => n + s.calls, 0);
  return [...stats.values()].map((s) => ({
    ...s,
    latencyMs: s.calls ? s.latencyMs / s.calls : 0,
    share: total ? (s.calls / total) * 100 : 0,
  }));
}
export function summarizeSpend(rows: SpendRow[], includeInactive = false): SpendSummary {
  const providers = summarizeProviders(rows);
  if (includeInactive)
    for (const provider of ACTIVE_PROVIDERS)
      if (!providers.some((p) => p.provider === provider)) providers.push(blank(provider));
  providers.sort((a, b) => b.cost - a.cost || a.provider.localeCompare(b.provider));
  const maxCost = providers[0]?.cost ?? 0;
  const leaders =
    maxCost > 0
      ? providers.filter((p) => p.provider !== "unassigned" && Math.abs(p.cost - maxCost) < 1e-10)
      : [];
  return {
    providers,
    totalCost: providers.reduce((n, p) => n + p.cost, 0),
    pricingConfigured:
      rows.every((r) => r.pricing_configured !== false) &&
      providers.every((p) => p.pricingConfigured),
    leaders,
    turns: rows.length,
  };
}
export function summarizeProviderAnalytics(rows: SpendRow[]): ProviderSpendAnalytics {
  const users = new Map<string, SpendRow[]>();
  const conversations = new Map<string, SpendRow[]>();
  for (const row of rows) {
    if (!row.user_key) continue;
    const userRows = users.get(row.user_key) ?? [];
    userRows.push(row);
    users.set(row.user_key, userRows);
    if (row.conversation_id) {
      const key = JSON.stringify([row.user_key, row.conversation_id]);
      const conversationRows = conversations.get(key) ?? [];
      conversationRows.push(row);
      conversations.set(key, conversationRows);
    }
  }
  return {
    ...summarizeSpend(rows, true),
    users: [...users].map(([userKey, turns]) => ({ userKey, ...summarizeSpend(turns) })),
    conversations: [...conversations.values()].map((turns) => ({
      userKey: turns[0].user_key!,
      conversationId: turns[0].conversation_id!,
      ...summarizeSpend(turns),
    })),
  };
}
