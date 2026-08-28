import { AsyncLocalStorage } from "node:async_hooks";

export type AIUsageOperation = "chat" | "embedding" | "media_analysis" | "transcription";
export type AIUsageDepth = "none" | "medium" | "high";

export interface AIUsageEvent {
  provider: string;
  operation: AIUsageOperation;
  model: string;
  modelTier?: string | null;
  routeReason?: string | null;
  researchDepth?: AIUsageDepth;
  webSearchEnabled?: boolean;
  webSearchCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  audioSeconds?: number;
}

export interface ParsedAIUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

export interface AIUsageAggregate extends ParsedAIUsage {
  events: number;
  costUsd: number;
  pricingConfigured: boolean;
  pricingSource: string;
  webSearchEnabled: boolean;
  webSearchCalls: number;
  researchDepth: AIUsageDepth;
  usedDeepResearch: boolean;
  usedQuickResponse: boolean;
  models: string[];
  operations: Record<string, number>;
}

type UsageContext = { events: AIUsageEvent[] };

const usageContext = new AsyncLocalStorage<UsageContext>();

function finiteNonNegative(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function parseOpenAIUsage(raw: unknown): ParsedAIUsage {
  const usage = objectValue(raw);
  const inputDetails = objectValue(usage.input_tokens_details ?? usage.prompt_tokens_details);
  const outputDetails = objectValue(usage.output_tokens_details);
  const inputTokens = finiteNonNegative(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = finiteNonNegative(usage.output_tokens ?? usage.completion_tokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    finiteNonNegative(inputDetails.cached_tokens ?? usage.cached_input_tokens),
  );
  const reasoningTokens = finiteNonNegative(
    outputDetails.reasoning_tokens ?? usage.reasoning_tokens,
  );
  const totalTokens = Math.max(inputTokens + outputTokens, finiteNonNegative(usage.total_tokens));

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens,
  };
}

export function withAIUsageContext<T>(fn: (events: AIUsageEvent[]) => Promise<T>): Promise<T> {
  const existing = usageContext.getStore();
  if (existing) return fn(existing.events);
  const events: AIUsageEvent[] = [];
  return usageContext.run({ events }, () => fn(events));
}

export function recordAIUsageEvent(event: AIUsageEvent): void {
  usageContext.getStore()?.events.push({
    ...event,
    model: event.model.slice(0, 180),
    routeReason: event.routeReason?.slice(0, 120),
  });
}

export function getAIUsageEvents(): AIUsageEvent[] {
  return [...(usageContext.getStore()?.events ?? [])];
}

/**
 * Identifica fontes internas que sustentaram a resposta, incluindo RAG,
 * catálogo, mercado e o site oficial. Isso evita classificar como "standard"
 * uma resposta que usou dados internos, mas não encontrou um trecho RAG.
 */
export function isInternalKnowledgeSupportBlock(value: string): boolean {
  return /^(?:rag:\d+|sql:context|site(?:[-:].*)?|produto|mercado|dukamp:)/i.test(value);
}

export function hasInternalKnowledgeSupport(values: string[]): boolean {
  const hasWeatherEvidence = values.some(
    (value) => /^weather:/i.test(value) || value === "chatgpt:web-weather",
  );
  return values.some(
    (value) =>
      isInternalKnowledgeSupportBlock(value) &&
      (!hasWeatherEvidence || !/^sql:context$/i.test(value)),
  );
}

export function internalKnowledgeMatchCount(values: string[]): number {
  let count = 0;
  for (const value of values) {
    const rag = value.match(/^rag:(\d+)$/i);
    if (rag) count = Math.max(count, Number(rag[1]));
    else if (hasInternalKnowledgeSupport([value])) count = Math.max(count, 1);
  }
  return count;
}

function depthRank(depth: AIUsageDepth): number {
  return depth === "high" ? 2 : depth === "medium" ? 1 : 0;
}

function maxDepth(events: AIUsageEvent[]): AIUsageDepth {
  let result: AIUsageDepth = "none";
  for (const event of events) {
    const depth = event.researchDepth ?? "none";
    if (depthRank(depth) > depthRank(result)) result = depth;
  }
  return result;
}

function envRate(names: string[]): { value: number | null; source: string } {
  for (const name of names) {
    const raw = process.env[name]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return { value, source: name };
  }
  return { value: null, source: "" };
}

type RateKind = "input" | "cached" | "output";

// Tarifas de referência usadas quando o ambiente ainda não recebeu as mesmas
// variáveis no Netlify. Elas também ficam declaradas em netlify.toml para que
// o custo seja explícito no deploy.
const TPEC_TIER_RATES: Record<string, Record<Exclude<RateKind, "cached">, number>> = {
  luna: { input: 0.2, output: 1.2 },
  terra: { input: 2, output: 12 },
  sol: { input: 5, output: 30 },
};

function rateFor(
  event: AIUsageEvent,
  kind: RateKind,
): {
  value: number | null;
  source: string;
} {
  const model = event.model.toLowerCase();
  const tier = event.modelTier?.toLowerCase() ?? "";
  const names: string[] = [];

  if (event.operation === "chat" && ["luna", "terra", "sol"].includes(tier)) {
    const tierName = tier.toUpperCase();
    const suffix = kind === "output" ? "OUTPUT" : kind === "cached" ? "CACHED_INPUT" : "INPUT";
    names.push("OPENAI_TPEC_" + tierName + "_" + suffix + "_USD_PER_1M");
  }
  if (event.operation === "media_analysis") {
    const suffix = kind === "output" ? "OUTPUT" : kind === "cached" ? "CACHED_INPUT" : "INPUT";
    names.push("OPENAI_MEDIA_" + suffix + "_USD_PER_1M");
  }
  if (event.operation === "embedding" && kind === "input") {
    names.push("OPENAI_EMBEDDING_INPUT_USD_PER_1M");
  }
  if (kind === "input") names.push("OPENAI_TPEC_DEFAULT_INPUT_USD_PER_1M");
  if (kind === "output") names.push("OPENAI_TPEC_DEFAULT_OUTPUT_USD_PER_1M");

  const configured = envRate(names);
  if (configured.value !== null) return configured;

  if (event.operation === "chat" && TPEC_TIER_RATES[tier] && kind !== "cached") {
    return {
      value: TPEC_TIER_RATES[tier][kind],
      source: `built-in:tpec-${tier}-${kind}-usd-per-1m`,
    };
  }

  // This fallback is only for the stable, explicitly named mini model already
  // used by media processing. New/custom GPT tiers must be configured through
  // environment variables so the panel does not pretend to know their tariff.
  if (
    event.operation !== "transcription" &&
    model.includes("gpt-4o-mini") &&
    (kind === "input" || kind === "output")
  ) {
    return {
      value: kind === "input" ? 0.15 : 0.6,
      source: "built-in:gpt-4o-mini",
    };
  }

  if (
    event.operation === "embedding" &&
    kind === "input" &&
    model.includes("text-embedding-3-large")
  ) {
    return { value: 0.13, source: "built-in:text-embedding-3-large" };
  }

  if (kind === "cached") {
    const input = rateFor(event, "input");
    if (input.value !== null) return input;
  }

  return { value: null, source: "" };
}

export function aggregateAIUsage(events: AIUsageEvent[]): AIUsageAggregate {
  const chatEvents = events.filter((event) => event.operation === "chat");
  const models = [...new Set(events.map((event) => event.model).filter(Boolean))];
  const operations: Record<string, number> = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let reasoningTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;
  let pricingConfigured = true;
  const configuredSources = new Set<string>();
  let webSearchCalls = 0;
  let webSearchEnabled = false;

  for (const event of events) {
    const input = finiteNonNegative(event.inputTokens);
    const output = finiteNonNegative(event.outputTokens);
    const cached = Math.min(input, finiteNonNegative(event.cachedInputTokens));
    inputTokens += input;
    outputTokens += output;
    cachedInputTokens += cached;
    reasoningTokens += finiteNonNegative(event.reasoningTokens);
    totalTokens += finiteNonNegative(event.totalTokens) || input + output;
    operations[event.operation] = (operations[event.operation] ?? 0) + 1;
    webSearchCalls += Math.trunc(finiteNonNegative(event.webSearchCalls));
    webSearchEnabled ||= Boolean(event.webSearchEnabled);

    if (event.operation === "transcription") {
      const seconds = finiteNonNegative(event.audioSeconds);
      const perMinute = envRate(["OPENAI_TRANSCRIPTION_USD_PER_MINUTE"]);
      if (seconds > 0) {
        if (perMinute.value === null) pricingConfigured = false;
        else costUsd += (seconds / 60) * perMinute.value;
        if (perMinute.source) configuredSources.add(perMinute.source);
      } else {
        pricingConfigured = false;
        configuredSources.add("transcription:duration-missing");
      }
      continue;
    }

    const inputRate = rateFor(event, "input");
    const cachedRate = rateFor(event, "cached");
    const outputRate = rateFor(event, "output");
    if (input > cached) {
      if (inputRate.value === null) pricingConfigured = false;
      else costUsd += ((input - cached) / 1_000_000) * inputRate.value;
    }
    if (cached > 0) {
      if (cachedRate.value === null) pricingConfigured = false;
      else costUsd += (cached / 1_000_000) * cachedRate.value;
    }
    if (output > 0) {
      if (outputRate.value === null) pricingConfigured = false;
      else costUsd += (output / 1_000_000) * outputRate.value;
    }
    if (inputRate.source) configuredSources.add(inputRate.source);
    if (cachedRate.source) configuredSources.add(cachedRate.source);
    if (outputRate.source) configuredSources.add(outputRate.source);
  }

  if (webSearchCalls > 0) {
    const searchRate = envRate(["OPENAI_WEB_SEARCH_USD_PER_CALL"]);
    if (searchRate.value === null) pricingConfigured = false;
    else costUsd += webSearchCalls * searchRate.value;
    if (searchRate.source) configuredSources.add(searchRate.source);
  }

  const researchDepth = maxDepth(events);
  const usedDeepResearch = researchDepth === "high";
  const usedQuickResponse =
    chatEvents.length > 0 &&
    chatEvents.every(
      (event) => event.modelTier === "luna" || event.routeReason === "lightweight_turn",
    );

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    totalTokens,
    events: events.length,
    costUsd,
    pricingConfigured,
    pricingSource: pricingConfigured
      ? [...configuredSources].join(",") || "sem tarifas aplicáveis"
      : [...configuredSources, "configuração incompleta"].join(","),
    webSearchEnabled,
    webSearchCalls,
    researchDepth,
    usedDeepResearch,
    usedQuickResponse,
    models,
    operations,
  };
}
