/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import { logDiagnostic } from "./diagnostics.server.ts";
import {
  aggregateAIUsage,
  getAIUsageEvents,
  type AIUsageAggregate,
  type AIUsageEvent,
  type AIUsageDepth,
} from "./usage.server.ts";
import type { ChatChannel } from "./types";

export interface AIChatTurnTelemetryInput {
  channel?: ChatChannel;
  sessionId: string;
  conversationId: string;
  clientMessageId?: string;
  userText: string;
  assistantText?: string | null;
  status: "completed" | "error";
  error?: unknown;
  diagnostics?: unknown;
  usageEvents?: AIUsageEvent[];
  startedAt: string;
  durationMs: number;
}

const VALID_RESPONSE_MODES = new Set(["standard", "quick", "knowledge", "deep_research", "mixed"]);
let unavailableLogged = false;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
      .trim()
      .slice(0, limit) || null
  );
}

function boolean(value: unknown): boolean {
  return value === true;
}

function number(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function uniqueStrings(values: Array<string | null | undefined>, limit = 500): string {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .join(", ")
    .slice(0, limit);
}

function channelFor(input: AIChatTurnTelemetryInput): "web" | "whatsapp" {
  return input.channel === "whatsapp" || input.sessionId.startsWith("wa:") ? "whatsapp" : "web";
}

function userKeyFor(input: AIChatTurnTelemetryInput, channel: "web" | "whatsapp"): string {
  if (channel === "whatsapp") {
    const phone = input.sessionId.replace(/^wa:/, "").replace(/\D/g, "");
    return phone.slice(0, 20) || "unknown-whatsapp-user";
  }
  return input.sessionId.slice(0, 256);
}

function phoneForUserKey(userKey: string, channel: "web" | "whatsapp"): string | null {
  if (channel !== "whatsapp" || !/^\d{6,20}$/.test(userKey)) return null;
  return userKey;
}

function diagnosticsDepth(
  diagnostics: Record<string, unknown>,
  aggregate: AIUsageAggregate,
): AIUsageDepth {
  const value = diagnostics.research_depth;
  if (value === "high" || value === "medium" || value === "none") return value;
  return aggregate.researchDepth;
}

function responseMode(
  diagnostics: Record<string, unknown>,
  aggregate: AIUsageAggregate,
  usedDeepResearch: boolean,
  usedKnowledgeBase: boolean,
  usedQuickResponse: boolean,
): string {
  const explicit = diagnostics.response_mode;
  if (typeof explicit === "string" && VALID_RESPONSE_MODES.has(explicit)) return explicit;
  const modes: string[] = [];
  if (usedDeepResearch) modes.push("deep_research");
  if (usedKnowledgeBase) modes.push("knowledge");
  if (usedQuickResponse) modes.push("quick");
  if (modes.length > 1) return "mixed";
  return modes[0] ?? (aggregate.webSearchEnabled ? "standard" : "standard");
}

function errorCode(error: unknown): string | null {
  const candidate = asRecord(error);
  const code = text(candidate.code, 80);
  if (code) return code;
  const status = number(candidate.status);
  return status !== null ? "http_" + Math.trunc(status) : null;
}

function errorMessage(error: unknown): string | null {
  if (error instanceof Error) return text(error.message, 500);
  return text(error, 500);
}

function ragMatchCount(retrieved: string[]): number {
  for (const item of retrieved) {
    const match = item.match(/^rag:(\d+)$/);
    if (match) return Number(match[1]);
  }
  return 0;
}

function aggregateMetadata(
  aggregate: AIUsageAggregate,
  retrieved: string[],
): Record<string, unknown> {
  return {
    event_count: aggregate.events,
    operations: aggregate.operations,
    models: aggregate.models,
    retrieved_blocks: retrieved.slice(0, 40),
    web_search_enabled: aggregate.webSearchEnabled,
    web_search_calls: aggregate.webSearchCalls,
    pricing_configured: aggregate.pricingConfigured,
    pricing_source: aggregate.pricingSource,
  };
}

/**
 * Persiste uma linha de auditoria por turno. Esta função é exclusivamente
 * server-side e falha de forma silenciosa para não derrubar o atendimento.
 */
export async function recordAIChatTurn(input: AIChatTurnTelemetryInput): Promise<void> {
  const events = input.usageEvents ?? getAIUsageEvents();
  const aggregate = aggregateAIUsage(events);
  const diagnostics = asRecord(input.diagnostics);
  const channel = channelFor(input);
  const userKey = userKeyFor(input, channel);
  const retrieved = Array.isArray(diagnostics.retrieved_blocks)
    ? diagnostics.retrieved_blocks.filter((value): value is string => typeof value === "string")
    : [];
  const chatEvents = events.filter((event) => event.operation === "chat");
  const usedDeepResearch = boolean(diagnostics.used_deep_research) || aggregate.usedDeepResearch;
  const usedKnowledgeBase =
    boolean(diagnostics.used_knowledge_base) || retrieved.some((value) => value.startsWith("rag:"));
  const usedQuickResponse = boolean(diagnostics.used_quick_response) || aggregate.usedQuickResponse;
  const depth = diagnosticsDepth(diagnostics, aggregate);
  const response = responseMode(
    diagnostics,
    aggregate,
    usedDeepResearch,
    usedKnowledgeBase,
    usedQuickResponse,
  );
  const model =
    uniqueStrings(
      chatEvents.map((event) => event.model),
      500,
    ) || uniqueStrings(aggregate.models, 500);
  const modelTier = uniqueStrings(
    chatEvents.map((event) => event.modelTier),
    120,
  );
  const routeReason = uniqueStrings(
    chatEvents.map((event) => event.routeReason),
    300,
  );
  const webSearchEnabled = boolean(diagnostics.web_search_enabled) || aggregate.webSearchEnabled;
  const webSearchCalls = Math.max(
    0,
    Math.trunc(number(diagnostics.web_search_calls) ?? aggregate.webSearchCalls),
  );
  const matchCount = Math.max(
    0,
    Math.trunc(number(diagnostics.knowledge_match_count) ?? ragMatchCount(retrieved)),
  );
  const durationMs = Math.min(Math.max(Math.trunc(input.durationMs), 0), 86_400_000);
  const startedAt = new Date(input.startedAt);
  const createdAt = Number.isNaN(startedAt.valueOf())
    ? new Date().toISOString()
    : startedAt.toISOString();
  const completedAt = input.status === "completed" ? new Date().toISOString() : null;

  const row = {
    conversation_id: input.conversationId.slice(0, 128),
    user_key: userKey,
    phone_number: phoneForUserKey(userKey, channel),
    channel,
    client_message_id: text(input.clientMessageId, 128),
    user_text: text(input.userText, 8_000) ?? "",
    assistant_text: text(input.assistantText, 12_000),
    status: input.status,
    error_code: input.status === "error" ? errorCode(input.error) : null,
    error_message: input.status === "error" ? errorMessage(input.error) : null,
    model: model || null,
    model_tier: modelTier || null,
    route_reason: routeReason || null,
    response_mode: response,
    research_depth: depth,
    used_deep_research: usedDeepResearch,
    used_knowledge_base: usedKnowledgeBase,
    knowledge_match_count: matchCount,
    used_quick_response: usedQuickResponse,
    web_search_enabled: webSearchEnabled,
    web_search_calls: webSearchCalls,
    input_tokens: aggregate.inputTokens,
    output_tokens: aggregate.outputTokens,
    cached_input_tokens: aggregate.cachedInputTokens,
    reasoning_tokens: aggregate.reasoningTokens,
    total_tokens: aggregate.totalTokens,
    estimated_cost_usd: Number(aggregate.costUsd.toFixed(8)),
    pricing_configured: aggregate.pricingConfigured,
    pricing_source: aggregate.pricingSource.slice(0, 500),
    duration_ms: durationMs,
    created_at: createdAt,
    completed_at: completedAt,
    metadata: aggregateMetadata(aggregate, retrieved),
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    if (!unavailableLogged) {
      unavailableLogged = true;
      logDiagnostic("warn", "chat.analytics.disabled", {
        reason: "missing_service_role",
      });
    }
    return;
  }

  try {
    const db = supabaseAdmin as any;
    const { error } = await db.from("ai_chat_turns").insert(row);
    if (error) {
      logDiagnostic("error", "chat.analytics.persist_error", {
        provider: "supabase",
        error_code: error.code,
        error_message: error.message,
      });
    }
  } catch (error) {
    logDiagnostic("error", "chat.analytics.persist_exception", {
      error_name: error instanceof Error ? error.name : "unknown",
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}
