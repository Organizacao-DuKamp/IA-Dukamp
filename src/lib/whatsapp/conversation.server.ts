import { ChatCoreResultSchema, type ChatInput } from "../chat/input.ts";
import { executeLocalChat } from "../chat/backend.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import type { WhatsAppChatInput, WhatsAppChatResult } from "./types.ts";
import {
  claimWhatsAppMessage,
  completeWhatsAppMessage,
  loadWhatsAppConversation,
  releaseWhatsAppMessage,
  saveWhatsAppConversation,
  type WhatsAppConversationSnapshot,
  type WhatsAppMessageClaim,
} from "./store.server.ts";

const MAX_HISTORY_MESSAGES = 40;

export interface WhatsAppConversationDependencies {
  claimMessage?: (messageId: string, phone: string) => Promise<WhatsAppMessageClaim>;
  completeMessage?: (messageId: string, reply: string) => Promise<void>;
  releaseMessage?: (messageId: string) => Promise<void>;
  loadConversation?: (phone: string) => Promise<WhatsAppConversationSnapshot | null>;
  saveConversation?: (
    phone: string,
    snapshot: WhatsAppConversationSnapshot,
  ) => Promise<void>;
  executeChat?: (input: ChatInput) => Promise<{ status: number; body: unknown }>;
}

function depsWithDefaults(deps: WhatsAppConversationDependencies) {
  return {
    claimMessage: deps.claimMessage ?? claimWhatsAppMessage,
    completeMessage: deps.completeMessage ?? completeWhatsAppMessage,
    releaseMessage: deps.releaseMessage ?? releaseWhatsAppMessage,
    loadConversation: deps.loadConversation ?? loadWhatsAppConversation,
    saveConversation: deps.saveConversation ?? saveWhatsAppConversation,
    executeChat: deps.executeChat ?? ((input: ChatInput) => executeLocalChat(input)),
  };
}

export async function processWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppConversationDependencies = {},
): Promise<WhatsAppChatResult> {
  const deps = depsWithDefaults(dependencies);
  const claim = await deps.claimMessage(input.messageId, input.phone);

  if (claim.kind === "completed") {
    return { reply: claim.reply, duplicate: true, shouldSend: true };
  }
  if (claim.kind === "processing") {
    return { duplicate: true, shouldSend: false };
  }

  try {
    const previous = await deps.loadConversation(input.phone);
    const conversationId = previous?.conversationId ?? `wa:${input.phone}`;
    const chatInput: ChatInput = {
      sessionId: `wa:${input.phone}`,
      conversationId,
      clientMessageId: input.messageId,
      text: input.text,
      history: previous?.history ?? [],
      state: previous?.state,
    };

    const result = await deps.executeChat(chatInput);
    if (result.status < 200 || result.status >= 300) {
      const message =
        result.body && typeof result.body === "object" && "error" in result.body
          ? String((result.body as { error?: unknown }).error ?? "chat_failed")
          : "chat_failed";
      throw new Error(message);
    }

    const core = ChatCoreResultSchema.parse(result.body);
    const nextHistory: ChatMessage[] = [
      ...(previous?.history ?? []),
      { role: "user", content: input.text },
      { role: "assistant", content: core.reply },
    ].slice(-MAX_HISTORY_MESSAGES);

    await deps.saveConversation(input.phone, {
      conversationId: core.conversationId,
      state: core.state,
      history: nextHistory,
    });
    await deps.completeMessage(input.messageId, core.reply);

    return { reply: core.reply, duplicate: false, shouldSend: true };
  } catch (error) {
    try {
      await deps.releaseMessage(input.messageId);
    } catch {
      console.error("[whatsapp] failed to release message claim");
    }
    throw error;
  }
}
