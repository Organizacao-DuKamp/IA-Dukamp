import type {
  WhatsAppChatInput,
  WhatsAppChatResult,
  WhatsAppControlRequest,
  WhatsAppControlResult,
} from "./types.ts";

export interface WhatsAppBackendDependencies {
  // Kept for dependency injection in webhook tests and callers.
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  processLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
  processClaimedLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
}

async function dispatchLocal(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies,
  alreadyClaimed: boolean,
): Promise<WhatsAppChatResult> {
  const conversation = await import("./conversation.server.ts");
  const process = alreadyClaimed
    ? (dependencies.processClaimedLocal ?? conversation.processClaimedWhatsAppChat)
    : (dependencies.processLocal ?? conversation.processWhatsAppChat);
  return process(input);
}

/** Processes WhatsApp messages in the same Netlify runtime as the webhook. */
export async function dispatchWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppChatResult> {
  return dispatchLocal(input, dependencies, false);
}

export async function dispatchClaimedWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppChatResult> {
  // O claim já existe neste ponto. Persista a entrada imediatamente antes do
  // pipeline pesado para que uma morte abrupta da função seja recuperável.
  // Falha nesta gravação não bloqueia a resposta normal; apenas reduz a
  // capacidade de replay daquela mensagem específica.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const retryStore = await import("./retry-store.server.ts");
      await retryStore.persistWhatsAppRetryPayload(input);
    } catch (error) {
      console.error(
        `[whatsapp] retry payload persistence failed ${error instanceof Error ? error.message : "unknown_error"}`,
      );
    }
  }
  return dispatchLocal(input, dependencies, true);
}

export async function controlWhatsAppMessage(
  request: WhatsAppControlRequest,
): Promise<WhatsAppControlResult> {
  const conversation = await import("./conversation.server.ts");
  switch (request.action) {
    case "claim":
      return conversation.claimWhatsAppInboundMessage(request.messageId, request.phone);
    case "complete":
      await conversation.completeWhatsAppInboundMessage(request.messageId, request.reply);
      return { kind: "ok" };
    case "release":
      await conversation.releaseWhatsAppInboundMessage(request.messageId);
      return { kind: "ok" };
    case "claim_presence":
      return conversation.claimWhatsAppPresenceNotice(request.messageId);
    case "claim_delivery":
      return conversation.claimPendingWhatsAppDelivery(request.messageId);
    case "delivered":
      await conversation.markPendingWhatsAppDeliveryDone(request.messageId, request.reply);
      return { kind: "ok" };
    case "release_delivery":
      await conversation.releasePendingWhatsAppDelivery(request.messageId, request.reply);
      return { kind: "ok" };
  }
}
