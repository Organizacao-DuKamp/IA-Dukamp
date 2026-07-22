// Basic in-memory rate limiter. Per-session (or IP) sliding window.
// Intentionally NOT persisted — resets on worker restart, which is fine
// for anti-abuse on a stateless chat.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_REQUESTS) {
    const retry = Math.ceil((WINDOW_MS - (now - arr[0])) / 1000);
    hits.set(key, arr);
    return { ok: false, retryAfterSec: retry };
  }
  arr.push(now);
  hits.set(key, arr);
  // Opportunistic cleanup
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      const kept = v.filter((t) => now - t < WINDOW_MS);
      if (kept.length === 0) hits.delete(k);
      else hits.set(k, kept);
    }
  }
  return { ok: true };
}
