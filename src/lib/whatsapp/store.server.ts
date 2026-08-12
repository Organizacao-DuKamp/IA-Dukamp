import type { ChatMessage } from "../chat/types.ts";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface WhatsAppConversationSnapshot {
  conversationId: string;
  history: ChatMessage[];
  state?: unknown;
}

export type WhatsAppMessageClaim =
  | { kind: "claimed" }
  | { kind: "completed"; reply: string }
  | { kind: "processing" };

const MAX_STORED_HISTORY = 40;
const PROCESSING_STALE_MS = 2 * 60_000;

function db() {
  // The generated Database type is refreshed separately by Supabase. Keep the
  // new server-only tables isolated here until the generated file is updated.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ChatMessage =>
        Boolean(item) &&
        typeof item === "object" &&
        ["user", "assistant", "system"].includes(String((item as ChatMessage).role)) &&
        typeof (item as ChatMessage).content === "string" &&
        (item as ChatMessage).content.length > 0,
    )
    .map((item) => ({ role: item.role, content: item.content.slice(0, 8000) }))
    .slice(-MAX_STORED_HISTORY);
}

export async function loadWhatsAppConversation(
  phone: string,
): Promise<WhatsAppConversationSnapshot | null> {
  const { data, error } = await db()
    .from("whatsapp_conversations")
    .select("conversation_id,state,history")
    .eq("phone_number", phone)
    .maybeSingle();

  if (error) throw new Error(`whatsapp_conversation_load_failed:${error.code ?? "unknown"}`);
  if (!data) return null;

  return {
    conversationId: String(data.conversation_id),
    history: normalizeHistory(data.history),
    state: data.state ?? undefined,
  };
}

export async function saveWhatsAppConversation(
  phone: string,
  snapshot: WhatsAppConversationSnapshot,
): Promise<void> {
  const payload = {
    phone_number: phone,
    conversation_id: snapshot.conversationId,
    state: snapshot.state ?? null,
    history: normalizeHistory(snapshot.history),
    updated_at: new Date().toISOString(),
  };

  const { error } = await db()
    .from("whatsapp_conversations")
    .upsert(payload, { onConflict: "phone_number" });

  if (error) throw new Error(`whatsapp_conversation_save_failed:${error.code ?? "unknown"}`);
}

export async function claimWhatsAppMessage(
  messageId: string,
  phone: string,
): Promise<WhatsAppMessageClaim> {
  const now = new Date().toISOString();
  const { error: insertError } = await db().from("whatsapp_processed_messages").insert({
    message_id: messageId,
    phone_number: phone,
    status: "processing",
    reply: null,
    updated_at: now,
  });

  if (!insertError) return { kind: "claimed" };
  if (insertError.code !== "23505") {
    throw new Error(`whatsapp_message_claim_failed:${insertError.code ?? "unknown"}`);
  }

  const { data, error } = await db()
    .from("whatsapp_processed_messages")
    .select("status,reply,updated_at")
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) throw new Error(`whatsapp_message_claim_lookup_failed:${error.code ?? "unknown"}`);
  if (data?.status === "completed" && typeof data.reply === "string" && data.reply.length > 0) {
    return { kind: "completed", reply: data.reply };
  }

  const updatedAt = Date.parse(String(data?.updated_at ?? ""));
  const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > PROCESSING_STALE_MS;
  if (!stale) return { kind: "processing" };

  const { error: reclaimError } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "processing", reply: null, updated_at: now })
    .eq("message_id", messageId);
  if (reclaimError) {
    throw new Error(`whatsapp_message_reclaim_failed:${reclaimError.code ?? "unknown"}`);
  }
  return { kind: "claimed" };
}

export async function completeWhatsAppMessage(messageId: string, reply: string): Promise<void> {
  const { error } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "completed", reply, updated_at: new Date().toISOString() })
    .eq("message_id", messageId);
  if (error) throw new Error(`whatsapp_message_complete_failed:${error.code ?? "unknown"}`);
}

export async function releaseWhatsAppMessage(messageId: string): Promise<void> {
  const { error } = await db()
    .from("whatsapp_processed_messages")
    .delete()
    .eq("message_id", messageId)
    .eq("status", "processing");
  if (error) throw new Error(`whatsapp_message_release_failed:${error.code ?? "unknown"}`);
}
