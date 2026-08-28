/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = {
  supabase: any;
  userId: string;
};

export type AIAnalyticsOverview = {
  unique_users: number;
  whatsapp_numbers: number;
  conversations: number;
  total_turns: number;
  completed_turns: number;
  failed_turns: number;
  total_cost_usd: number;
  total_cost_brl: number | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  deep_research_pct: number;
  knowledge_base_pct: number;
  quick_response_pct: number;
  pricing_configured: boolean;
};

export type AIAnalyticsUser = {
  user_key: string;
  phone_number: string | null;
  channel: "web" | "whatsapp";
  conversation_count: number;
  turn_count: number;
  completed_turns: number;
  total_cost_usd: number;
  last_message_at: string;
  deep_research_pct: number;
  knowledge_base_pct: number;
  quick_response_pct: number;
};

export type AIAnalyticsTurn = {
  id: string;
  conversation_id: string;
  user_key: string;
  phone_number: string | null;
  channel: "web" | "whatsapp";
  client_message_id: string | null;
  user_text: string;
  assistant_text: string | null;
  status: "completed" | "error";
  error_code: string | null;
  error_message: string | null;
  model: string | null;
  model_tier: string | null;
  route_reason: string | null;
  response_mode: string;
  research_depth: "none" | "medium" | "high";
  used_deep_research: boolean;
  used_knowledge_base: boolean;
  knowledge_match_count: number;
  used_quick_response: boolean;
  web_search_enabled: boolean;
  web_search_calls: number;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  estimated_cost_brl: number | null;
  pricing_configured: boolean;
  pricing_source: string | null;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const RangeInput = z.object({
  from: DateString.nullable().optional(),
  to: DateString.nullable().optional(),
});

const UsersInput = RangeInput.extend({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).max(10_000).default(0),
});

const HistoryInput = RangeInput.extend({
  userKey: z.string().min(1).max(256),
  conversationId: z.string().min(1).max(128).optional(),
});

async function assertAdmin(ctx: AdminContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

function dateBoundary(value: string | null | undefined, end: boolean): string | null {
  if (!value) return null;
  const suffix = end ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00";
  const parsed = new Date(value + suffix);
  if (Number.isNaN(parsed.valueOf())) throw new Error("Período inválido.");
  return parsed.toISOString();
}

function rangeValues(data: { from?: string | null; to?: string | null }) {
  return {
    from: dateBoundary(data.from, false),
    to: dateBoundary(data.to, true),
  };
}

function asNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeOverview(value: unknown): AIAnalyticsOverview {
  const row = asRecord(value);
  return {
    unique_users: asNumber(row.unique_users),
    whatsapp_numbers: asNumber(row.whatsapp_numbers),
    conversations: asNumber(row.conversations),
    total_turns: asNumber(row.total_turns),
    completed_turns: asNumber(row.completed_turns),
    failed_turns: asNumber(row.failed_turns),
    total_cost_usd: asNumber(row.total_cost_usd),
    total_cost_brl: asNullableNumber(row.total_cost_brl),
    input_tokens: asNumber(row.input_tokens),
    output_tokens: asNumber(row.output_tokens),
    total_tokens: asNumber(row.total_tokens),
    deep_research_pct: asNumber(row.deep_research_pct),
    knowledge_base_pct: asNumber(row.knowledge_base_pct),
    quick_response_pct: asNumber(row.quick_response_pct),
    pricing_configured: asBoolean(row.pricing_configured),
  };
}

function normalizeUser(value: unknown): AIAnalyticsUser {
  const row = asRecord(value);
  return {
    user_key: String(row.user_key ?? ""),
    phone_number: typeof row.phone_number === "string" ? row.phone_number : null,
    channel: row.channel === "whatsapp" ? "whatsapp" : "web",
    conversation_count: asNumber(row.conversation_count),
    turn_count: asNumber(row.turn_count),
    completed_turns: asNumber(row.completed_turns),
    total_cost_usd: asNumber(row.total_cost_usd),
    last_message_at: String(row.last_message_at ?? ""),
    deep_research_pct: asNumber(row.deep_research_pct),
    knowledge_base_pct: asNumber(row.knowledge_base_pct),
    quick_response_pct: asNumber(row.quick_response_pct),
  };
}

function normalizeTurn(value: unknown): AIAnalyticsTurn {
  const row = asRecord(value);
  const channel = row.channel === "whatsapp" ? "whatsapp" : "web";
  const depth =
    row.research_depth === "high" || row.research_depth === "medium" ? row.research_depth : "none";
  const status = row.status === "error" ? "error" : "completed";
  return {
    id: String(row.id ?? ""),
    conversation_id: String(row.conversation_id ?? ""),
    user_key: String(row.user_key ?? ""),
    phone_number: typeof row.phone_number === "string" ? row.phone_number : null,
    channel,
    client_message_id: typeof row.client_message_id === "string" ? row.client_message_id : null,
    user_text: String(row.user_text ?? ""),
    assistant_text: typeof row.assistant_text === "string" ? row.assistant_text : null,
    status,
    error_code: typeof row.error_code === "string" ? row.error_code : null,
    error_message: typeof row.error_message === "string" ? row.error_message : null,
    model: typeof row.model === "string" ? row.model : null,
    model_tier: typeof row.model_tier === "string" ? row.model_tier : null,
    route_reason: typeof row.route_reason === "string" ? row.route_reason : null,
    response_mode: String(row.response_mode ?? "standard"),
    research_depth: depth,
    used_deep_research: asBoolean(row.used_deep_research),
    used_knowledge_base: asBoolean(row.used_knowledge_base),
    knowledge_match_count: asNumber(row.knowledge_match_count),
    used_quick_response: asBoolean(row.used_quick_response),
    web_search_enabled: asBoolean(row.web_search_enabled),
    web_search_calls: asNumber(row.web_search_calls),
    input_tokens: asNumber(row.input_tokens),
    output_tokens: asNumber(row.output_tokens),
    cached_input_tokens: asNumber(row.cached_input_tokens),
    reasoning_tokens: asNumber(row.reasoning_tokens),
    total_tokens: asNumber(row.total_tokens),
    estimated_cost_usd: asNumber(row.estimated_cost_usd),
    estimated_cost_brl: asNullableNumber(row.estimated_cost_brl),
    pricing_configured: asBoolean(row.pricing_configured),
    pricing_source: typeof row.pricing_source === "string" ? row.pricing_source : null,
    duration_ms: row.duration_ms === null ? null : asNumber(row.duration_ms),
    created_at: String(row.created_at ?? ""),
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    metadata: asRecord(row.metadata),
  };
}

const HISTORY_COLUMNS =
  "id,conversation_id,user_key,phone_number,channel,client_message_id,user_text,assistant_text,status,error_code,error_message,model,model_tier,route_reason,response_mode,research_depth,used_deep_research,used_knowledge_base,knowledge_match_count,used_quick_response,web_search_enabled,web_search_calls,input_tokens,output_tokens,cached_input_tokens,reasoning_tokens,total_tokens,estimated_cost_usd,estimated_cost_brl,pricing_configured,pricing_source,duration_ms,created_at,completed_at,metadata";

function applyDateRange(query: any, range: { from: string | null; to: string | null }) {
  let current = query;
  if (range.from) current = current.gte("created_at", range.from);
  if (range.to) current = current.lte("created_at", range.to);
  return current;
}

export const aiAnalyticsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const db = (await getPrivilegedClient((context as AdminContext).supabase)) as any;
    const range = rangeValues(data);
    const { data: rows, error } = await db.rpc("admin_ai_chat_overview_v2", {
      p_from: range.from,
      p_to: range.to,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return normalizeOverview(row);
  });

export const aiAnalyticsUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UsersInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const db = (await getPrivilegedClient((context as AdminContext).supabase)) as any;
    const range = rangeValues(data);
    const { data: rows, error } = await db.rpc("admin_ai_chat_users", {
      p_from: range.from,
      p_to: range.to,
      p_limit: data.limit,
      p_offset: data.offset,
    });
    if (error) throw new Error(error.message);
    return (Array.isArray(rows) ? rows : []).map(normalizeUser);
  });

export const aiChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistoryInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const db = (await getPrivilegedClient((context as AdminContext).supabase)) as any;
    const range = rangeValues(data);
    let query = db
      .from("ai_chat_turns")
      .select(HISTORY_COLUMNS)
      .eq("user_key", data.userKey)
      .order("created_at", { ascending: true })
      .limit(2_000);
    if (data.conversationId) query = query.eq("conversation_id", data.conversationId);
    query = applyDateRange(query, range);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(normalizeTurn);
  });
