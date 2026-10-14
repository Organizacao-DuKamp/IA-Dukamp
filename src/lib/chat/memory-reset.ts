import type { ChatInput } from "./input.ts";
import type { ChatMessage } from "./types.ts";

/** A one-time reset boundary. Changing this value starts a new memory generation. */
export const USER_MEMORY_EPOCH = "reset-2026-10-14-duk-a91f";
export const MEMORY_INBOX_PREFIX = `[${USER_MEMORY_EPOCH}]\n`;
export const MEMORY_STORAGE_KEY = `tpec-ia:conversation:${USER_MEMORY_EPOCH}`;

function objectState(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return objectState(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function safeMemoryHistory(value: unknown): ChatMessage[] {
  return Array.isArray(value)
    ? value
        .filter(
          (m): m is ChatMessage =>
            m && ["user", "assistant"].includes(m.role) && typeof m.content === "string",
        )
        .slice(-40)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
}
export function currentMemoryMarker(state: unknown) {
  const raw = objectState(objectState(state).memory_reset);
  if (
    raw.epoch !== USER_MEMORY_EPOCH ||
    typeof raw.started_at !== "string" ||
    !Number.isFinite(Date.parse(raw.started_at))
  )
    return null;
  return {
    epoch: USER_MEMORY_EPOCH,
    started_at: raw.started_at,
    history: safeMemoryHistory(raw.history),
  };
}
export function stampMemoryState(state: unknown, history: ChatMessage[]) {
  const raw = objectState(state);
  return {
    ...raw,
    memory_reset: {
      epoch: USER_MEMORY_EPOCH,
      started_at: currentMemoryMarker(raw)?.started_at ?? new Date().toISOString(),
      history: safeMemoryHistory(history),
    },
  };
}
export function prepareWebMemory(input: ChatInput): ChatInput {
  const marker = currentMemoryMarker(input.state);
  return {
    ...input,
    history: marker?.history ?? [],
    state: marker ? objectState(input.state) : undefined,
    conversationId: marker ? input.conversationId : crypto.randomUUID(),
  };
}
export function currentMemoryInboxText(value: string): string | null {
  return value.startsWith(MEMORY_INBOX_PREFIX) ? value.slice(MEMORY_INBOX_PREFIX.length) : null;
}
