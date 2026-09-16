/** Stable namespace per authenticated account; never trust a caller's session ID. */
export function conversationIdFor(userId: string, conversationId?: string): string {
  const prefix = `web:${userId}:`;
  const id = conversationId?.startsWith(prefix)
    ? conversationId.slice(prefix.length)
    : conversationId;
  return prefix + (id || "default").slice(-60);
}
