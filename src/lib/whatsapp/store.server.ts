import type { ChatMessage } from "../chat/types.ts";
import { supabaseAdmin } from "../../integrations/supabase/client.server.ts";

export interface WhatsAppConversationSnapshot {
  conversationId: string;
  history: ChatMessage[];
  state?: unknown;
}

export type WhatsAppMessageClaim =
  | { kind: "claimed" }
  | { kind: "completed"; reply: string }
  | { kind: "processing" }
  | { kind: "delivered" };

export type WhatsAppDeliveryClaim =
  | { kind: "claimed"; reply: string }
  | { kind: "processing" }
  | { kind: "delivered" }
  | { kind: "missing" };

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
  if (!data) return { kind: "processing" };

  if (data.status === "completed") {
    if (typeof data.reply === "string" && data.reply.length > 0) {
      return { kind: "completed", reply: data.reply };
    }
    return { kind: "delivered" };
  }

  const updatedAt = Date.parse(String(data.updated_at ?? ""));
  const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > PROCESSING_STALE_MS;
  if (!stale) return { kind: "processing" };

  // Um processamento com reply não nulo é um lease de entrega que ficou órfão.
  // Volte-o para "completed" para permitir uma nova tentativa de envio sem
  // reexecutar a IA. Um processamento sem reply é uma execução da IA que pode
  // ser retomada depois do TTL.
  if (typeof data.reply === "string" && data.reply.length > 0) {
    const { error: restoreError } = await db()
      .from("whatsapp_processed_messages")
      .update({ status: "completed", updated_at: now })
      .eq("message_id", messageId)
      .eq("status", "processing");
    if (restoreError) {
      throw new Error(`whatsapp_delivery_restore_failed:${restoreError.code ?? "unknown"}`);
    }
    return { kind: "completed", reply: data.reply };
  }

  const { error: reclaimError } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "processing", reply: null, updated_at: now })
    .eq("message_id", messageId)
    .eq("status", "processing");
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
    .eq("status", "processing")
    .is("reply", null);
  if (error) throw new Error(`whatsapp_message_release_failed:${error.code ?? "unknown"}`);
}

export async function claimWhatsAppDelivery(messageId: string): Promise<WhatsAppDeliveryClaim> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "processing", updated_at: now })
    .eq("message_id", messageId)
    .eq("status", "completed")
    .not("reply", "is", null)
    .select("reply")
    .maybeSingle();

  if (error) throw new Error(`whatsapp_delivery_claim_failed:${error.code ?? "unknown"}`);
  if (typeof data?.reply === "string" && data.reply.length > 0) {
    return { kind: "claimed", reply: data.reply };
  }

  const { data: current, error: lookupError } = await db()
    .from("whatsapp_processed_messages")
    .select("status,reply")
    .eq("message_id", messageId)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`whatsapp_delivery_claim_lookup_failed:${lookupError.code ?? "unknown"}`);
  }
  if (!current) return { kind: "missing" };
  if (current.status === "completed" && !current.reply) return { kind: "delivered" };
  return { kind: "processing" };
}

export async function markWhatsAppMessageDelivered(
  messageId: string,
  reply: string,
): Promise<void> {
  const { error } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "completed", reply: null, updated_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .eq("status", "processing")
    .eq("reply", reply);
  if (error) throw new Error(`whatsapp_delivery_complete_failed:${error.code ?? "unknown"}`);
}

export async function releaseWhatsAppDelivery(messageId: string, reply: string): Promise<void> {
  const { error } = await db()
    .from("whatsapp_processed_messages")
    .update({ status: "completed", reply, updated_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .eq("status", "processing")
    .eq("reply", reply);
  if (error) throw new Error(`whatsapp_delivery_release_failed:${error.code ?? "unknown"}`);
}
