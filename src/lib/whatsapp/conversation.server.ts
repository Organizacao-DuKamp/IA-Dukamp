import { ChatCoreResultSchema, type ChatInput } from "../chat/input.ts";
import { executeLocalChat } from "../chat/backend.server.ts";
import type { ChatMessage } from "../chat/types.ts";
import type { WhatsAppChatInput, WhatsAppChatResult } from "./types.ts";

const MAX_HISTORY_MESSAGES = 40;
const MEMORY_CONVERSATION_TTL_MS = 6 * 60 * 60_000;
const MEMORY_MESSAGE_TTL_MS = 24 * 60 * 60_000;
const MEMORY_PROCESSING_STALE_MS = 2 * 60_000;
const MAX_MEMORY_CONVERSATIONS = 500;
const MAX_MEMORY_MESSAGES = 2_000;

export interface WhatsAppConversationSnapshot {
  conversationId: string;
  history: ChatMessage[];
  state?: unknown;
}

export type WhatsAppMessageClaim =
  | { kind: "claimed" }
  | { kind: "completed"; reply: string }
  | { kind: "processing" };

interface MemoryConversationEntry {
  snapshot: WhatsAppConversationSnapshot;
  updatedAt: number;
}

interface MemoryMessageEntry {
  phone: string;
  status: "processing" | "completed";
  reply?: string;
  updatedAt: number;
}

const memoryConversations = new Map<string, MemoryConversationEntry>();
const memoryMessages = new Map<string, MemoryMessageEntry>();
let memoryFallbackLogged = false;

export interface WhatsAppConversationDependencies {
  claimMessage?: (messageId: string, phone: string) => Promise<WhatsAppMessageClaim>;
  completeMessage?: (messageId: string, reply: string) => Promise<void>;
  releaseMessage?: (messageId: string) => Promise<void>;
  loadConversation?: (phone: string) => Promise<WhatsAppConversationSnapshot | null>;
  saveConversation?: (phone: string, snapshot: WhatsAppConversationSnapshot) => Promise<void>;
  executeChat?: (input: ChatInput) => Promise<{ status: number; body: unknown }>;
}

function cloneSnapshot(snapshot: WhatsAppConversationSnapshot): WhatsAppConversationSnapshot {
  return {
    conversationId: snapshot.conversationId,
    history: snapshot.history.map((message) => ({ ...message })),
    state: snapshot.state === undefined ? undefined : structuredClone(snapshot.state),
  };
}

function trimOldest<K, V>(map: Map<K, V>, limit: number): void {
  while (map.size > limit) {
    const oldest = map.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function gcMemory(now = Date.now()): void {
  for (const [phone, entry] of memoryConversations) {
    if (now - entry.updatedAt > MEMORY_CONVERSATION_TTL_MS) memoryConversations.delete(phone);
  }
  for (const [messageId, entry] of memoryMessages) {
    if (now - entry.updatedAt > MEMORY_MESSAGE_TTL_MS) memoryMessages.delete(messageId);
  }
  trimOldest(memoryConversations, MAX_MEMORY_CONVERSATIONS);
  trimOldest(memoryMessages, MAX_MEMORY_MESSAGES);
}

function stateStoreMode(): "memory" | "supabase" {
  const configured = process.env.WHATSAPP_STATE_STORE?.trim().toLowerCase();
  if (configured === "memory") return "memory";
  if (configured === "supabase") return "supabase";

  // Netlify não precisa receber uma chave administrativa só para o WhatsApp.
  // Quando a service-role não está disponível, mantenha contexto/idempotência
  // em memória da função. Em runtimes com a chave, preserve o store durável.
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "supabase" : "memory";
}

function logMemoryFallbackOnce(): void {
  if (memoryFallbackLogged) return;
  memoryFallbackLogged = true;
  console.info(
    "[whatsapp] state store=memory (SUPABASE_SERVICE_ROLE_KEY ausente; contexto persiste enquanto a instância estiver ativa)",
  );
}

async function memoryClaimMessage(messageId: string, phone: string): Promise<WhatsAppMessageClaim> {
  const now = Date.now();
  gcMemory(now);
  const existing = memoryMessages.get(messageId);
  if (existing?.status === "completed" && existing.reply) {
    return { kind: "completed", reply: existing.reply };
  }
  if (existing?.status === "processing" && now - existing.updatedAt <= MEMORY_PROCESSING_STALE_MS) {
    return { kind: "processing" };
  }

  memoryMessages.delete(messageId);
  memoryMessages.set(messageId, { phone, status: "processing", updatedAt: now });
  trimOldest(memoryMessages, MAX_MEMORY_MESSAGES);
  return { kind: "claimed" };
}

async function memoryCompleteMessage(messageId: string, reply: string): Promise<void> {
  const existing = memoryMessages.get(messageId);
  memoryMessages.delete(messageId);
  memoryMessages.set(messageId, {
    phone: existing?.phone ?? "unknown",
    status: "completed",
    reply,
    updatedAt: Date.now(),
  });
  trimOldest(memoryMessages, MAX_MEMORY_MESSAGES);
}

async function memoryReleaseMessage(messageId: string): Promise<void> {
  const existing = memoryMessages.get(messageId);
  if (existing?.status === "processing") memoryMessages.delete(messageId);
}

async function memoryLoadConversation(phone: string): Promise<WhatsAppConversationSnapshot | null> {
  gcMemory();
  const entry = memoryConversations.get(phone);
  return entry ? cloneSnapshot(entry.snapshot) : null;
}

async function memorySaveConversation(
  phone: string,
  snapshot: WhatsAppConversationSnapshot,
): Promise<void> {
  memoryConversations.delete(phone);
  memoryConversations.set(phone, { snapshot: cloneSnapshot(snapshot), updatedAt: Date.now() });
  trimOldest(memoryConversations, MAX_MEMORY_CONVERSATIONS);
}

async function defaultClaimMessage(
  messageId: string,
  phone: string,
): Promise<WhatsAppMessageClaim> {
  if (stateStoreMode() === "memory") {
    logMemoryFallbackOnce();
    return memoryClaimMessage(messageId, phone);
  }
  const store = await import("./store.server.ts");
  return store.claimWhatsAppMessage(messageId, phone);
}

async function defaultCompleteMessage(messageId: string, reply: string): Promise<void> {
  if (stateStoreMode() === "memory") return memoryCompleteMessage(messageId, reply);
  const store = await import("./store.server.ts");
  return store.completeWhatsAppMessage(messageId, reply);
}

async function defaultReleaseMessage(messageId: string): Promise<void> {
  if (stateStoreMode() === "memory") return memoryReleaseMessage(messageId);
  const store = await import("./store.server.ts");
  return store.releaseWhatsAppMessage(messageId);
}

async function defaultLoadConversation(
  phone: string,
): Promise<WhatsAppConversationSnapshot | null> {
  if (stateStoreMode() === "memory") return memoryLoadConversation(phone);
  const store = await import("./store.server.ts");
  return store.loadWhatsAppConversation(phone);
}

async function defaultSaveConversation(
  phone: string,
  snapshot: WhatsAppConversationSnapshot,
): Promise<void> {
  if (stateStoreMode() === "memory") return memorySaveConversation(phone, snapshot);
  const store = await import("./store.server.ts");
  return store.saveWhatsAppConversation(phone, snapshot);
}

function depsWithDefaults(deps: WhatsAppConversationDependencies) {
  return {
    claimMessage: deps.claimMessage ?? defaultClaimMessage,
    completeMessage: deps.completeMessage ?? defaultCompleteMessage,
    releaseMessage: deps.releaseMessage ?? defaultReleaseMessage,
    loadConversation: deps.loadConversation ?? defaultLoadConversation,
    saveConversation: deps.saveConversation ?? defaultSaveConversation,
    executeChat: deps.executeChat ?? ((input: ChatInput) => executeLocalChat(input)),
  };
}

function greetingReply(text: string, hasHistory: boolean): string | null {
  const normalized = text
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[!.?…]+$/g, "")
    .replace(/\s+/g, " ");
  if (!/^(oi|ol[aá]|opa|e\s?a[ií]|bom dia|boa tarde|boa noite|hey|hi|hello)$/.test(normalized)) {
    return null;
  }

  if (hasHistory) {
    if (normalized === "bom dia") return "Bom dia! Tô por aqui 😊 Pode mandar.";
    if (normalized === "boa tarde") return "Boa tarde! Tô por aqui 😊 Pode mandar.";
    if (normalized === "boa noite") return "Boa noite! Tô por aqui 😊 Pode mandar.";
    return "Opa! Tô por aqui 😊 Pode mandar — o que você quer conferir agora?";
  }

  return "Oi! 👋 Sou a TPEC-IA, da DuKamp. Pode mandar sua dúvida. Se precisar de preço, mercado ou informação atual, eu pesquiso pra você.";
}

function appendTurn(history: ChatMessage[], user: string, assistant: string): ChatMessage[] {
  return [
    ...history,
    { role: "user" as const, content: user },
    { role: "assistant" as const, content: assistant },
  ].slice(-MAX_HISTORY_MESSAGES);
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
    const casualGreeting = greetingReply(input.text, Boolean(previous?.history.length));

    if (casualGreeting) {
      const nextHistory = appendTurn(previous?.history ?? [], input.text, casualGreeting);
      await deps.saveConversation(input.phone, {
        conversationId,
        state: previous?.state,
        history: nextHistory,
      });
      await deps.completeMessage(input.messageId, casualGreeting);
      return { reply: casualGreeting, duplicate: false, shouldSend: true };
    }

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
    const nextHistory = appendTurn(previous?.history ?? [], input.text, core.reply);

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