import { supabaseAdmin } from "../../integrations/supabase/client.server.ts";
import type { WhatsAppChatInput } from "./types.ts";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

/**
 * Persiste a entrada normalizada antes do trabalho pesado de IA. Se a função
 * de background morrer depois disso, o watcher consegue reconstruir a mesma
 * solicitação sem depender de um novo webhook da Meta.
 */
export async function persistWhatsAppRetryPayload(input: WhatsAppChatInput): Promise<void> {
  const { error } = await db()
    .from("whatsapp_processed_messages")
    .update({ request_payload: input })
    .eq("message_id", input.messageId)
    .eq("phone_number", input.phone)
    .eq("status", "processing")
    .is("reply", null)
    .is("delivered_at", null);

  if (error) {
    throw new Error(`whatsapp_retry_payload_persist_failed:${error.code ?? "unknown"}`);
  }
}
