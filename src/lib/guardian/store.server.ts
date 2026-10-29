import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PreferencesSchema,
  FarmBookSchema,
  type FarmBook,
  type GuardianEvent,
  type GuardianPreferences,
  type GuardianSnapshot,
  type GuardianPending,
} from "./schema.ts";

export interface GuardianCommit {
  phone: string;
  messageId: string;
  accountVersion: number;
  propertyId: string | null;
  propertyVersion: number | null;
  operation:
    | "noop"
    | "pending"
    | "clear"
    | "create"
    | "update"
    | "select"
    | "preferences"
    | "invite"
    | "accept"
    | "revoke"
    | "delete"
    | "link"
    | "calculation";
  book?: FarmBook;
  pending: GuardianPending | null;
  preferences?: GuardianPreferences;
  details?: Record<string, unknown>;
  reply: string;
  events?: GuardianEvent[];
}
export interface TaskNotification {
  id: string;
  propertyId: string;
  taskId: string;
  sentAt: string;
  providerId: string | null;
  answeredAt: string | null;
  taskUpdatedAt?: string;
}
export interface GuardianStore {
  taskNotifications?(
    phone: string,
    propertyIds: string[],
    since: string,
    providerId?: string,
  ): Promise<TaskNotification[]>;
  loadProperty?(phone: string, propertyId: string): Promise<GuardianSnapshot["active"]>;

  load(phone: string): Promise<GuardianSnapshot>;
  receipt(phone: string, messageId: string): Promise<string | null>;
  commit(turn: GuardianCommit): Promise<string>;
}
export async function guardianDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("../../integrations/supabase/client.server.ts");
  return supabaseAdmin as unknown as SupabaseClient;
}
export function mapSnapshot(value: unknown): GuardianSnapshot {
  if (!value || typeof value !== "object") throw new Error("guardian_snapshot_invalid");
  const v = value as GuardianSnapshot;
  if (
    !Array.isArray(v.properties) ||
    !Number.isSafeInteger(v.accountVersion) ||
    (v.active &&
      (v.active.book?.schema !== 1 ||
        !Array.isArray(v.active.book.tasks) ||
        !Array.isArray(v.active.book.animals) ||
        !Array.isArray(v.active.book.ledger) ||
        !Array.isArray(v.active.book.records)))
  )
    throw new Error("guardian_snapshot_invalid");
  return {
    ...v,
    properties: v.properties.map((p) => ({ ...p, name: p.name ?? "Propriedade sem nome" })),
    preferences: PreferencesSchema.parse(v.preferences ?? {}),
    active: v.active ? { ...v.active, book: FarmBookSchema.parse(v.active.book) } : null,
  };
}
export function guardianRpcArgs(t: GuardianCommit) {
  return {
    p_phone: t.phone,
    p_message_id: t.messageId,
    p_account_version: t.accountVersion,
    p_property_id: t.propertyId,
    p_property_version: t.propertyVersion,
    p_operation: t.operation,
    p_book: t.book ?? null,
    p_pending: t.pending,
    p_preferences: t.preferences ?? null,
    p_details: t.details ?? {},
    p_reply: t.reply,
    p_events: t.events ?? [],
  };
}
export const guardianStore: GuardianStore = {
  async taskNotifications(phone, propertyIds, since, providerId) {
    if (!propertyIds.length) return [];
    let q = (await guardianDb())
      .from("guardian_events")
      .select("id,property_id,evidence,sent_at,provider_message_id,answered_at")
      .eq("recipient", phone)
      .eq("type", "task_due")
      .eq("status", "sent")
      .in("property_id", propertyIds);
    q = providerId ? q.eq("provider_message_id", providerId) : q.gte("sent_at", since);
    const { data, error } = await q
      .order("sent_at", { ascending: false })
      .limit(30)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw Error("guardian_task_context_unavailable");
    return (data ?? [])
      .filter((x) => typeof x.evidence?.taskId === "string" && x.sent_at)
      .map((x) => ({
        id: x.id,
        propertyId: x.property_id,
        taskId: x.evidence.taskId as string,
        sentAt: x.sent_at!,
        providerId: x.provider_message_id,
        answeredAt: x.answered_at,
        taskUpdatedAt: typeof x.evidence.updatedAt === "string" ? x.evidence.updatedAt : undefined,
      }));
  },
  async loadProperty(phone, propertyId) {
    const db = await guardianDb();
    const { data: m, error: me } = await db
      .from("guardian_members")
      .select("role")
      .eq("phone_number", phone)
      .eq("property_id", propertyId)
      .eq("active", true)
      .maybeSingle();
    if (me) throw Error("guardian_task_context_unavailable");
    if (!m) return null;
    const { data: p, error: pe } = await db
      .from("guardian_properties")
      .select("id,version,book")
      .eq("id", propertyId)
      .maybeSingle();
    if (pe) throw Error("guardian_task_context_unavailable");
    if (!p) return null;
    return { id: p.id, version: p.version, role: m.role, book: FarmBookSchema.parse(p.book) };
  },
  async load(phone) {
    const { data, error } = await (await guardianDb())
      .rpc("guardian_snapshot", { p_phone: phone })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("guardian_snapshot_unavailable");
    return mapSnapshot(data);
  },
  async receipt(phone, messageId) {
    const { data, error } = await (await guardianDb())
      .from("guardian_turn_receipts")
      .select("reply,property_id")
      .eq("phone_number", phone)
      .eq("message_id", messageId)
      .maybeSingle();
    if (error) throw new Error("guardian_receipt_unavailable");
    if (data?.property_id) {
      const { data: m, error: e } = await (await guardianDb())
        .from("guardian_members")
        .select("active")
        .eq("property_id", data.property_id)
        .eq("phone_number", phone)
        .eq("active", true)
        .maybeSingle();
      if (e || !m) throw new Error("guardian_access_denied");
    }
    return data?.reply ?? null;
  },
  async commit(turn) {
    const { data, error } = await (
      await guardianDb()
    ).rpc("guardian_commit_turn", guardianRpcArgs(turn));
    if (error) {
      const safe = error.message.includes("invalid_guardian_invitation")
        ? "Convite inválido, vencido ou de outro número."
        : error.message.includes("guardian_write_denied") ||
            error.message.includes("guardian_access_denied")
          ? "Seu acesso a esta propriedade mudou. Consulte suas fazendas e tente novamente."
          : "guardian_commit_failed";
      throw new Error(safe);
    }
    if (typeof data !== "string") throw new Error("guardian_commit_unconfirmed");
    return data;
  },
};
