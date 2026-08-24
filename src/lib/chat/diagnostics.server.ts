import { AsyncLocalStorage } from "node:async_hooks";

type DiagnosticContext = {
  traceId: string;
  conversationId?: string;
};

type DiagnosticLevel = "info" | "warn" | "error";

const diagnostics = new AsyncLocalStorage<DiagnosticContext>();
const SECRET_KEY =
  /^(authorization|api[_-]?key|token|access[_-]?token|refresh[_-]?token|id[_-]?token|.*secret.*|password|cookie|set-cookie)$/i;
const SECRET_VALUE =
  /(Bearer\s+)[A-Za-z0-9._~+/-]+|\b(?:sk-(?:proj-)?|pplx-|sb_(?:secret|publishable)_)[A-Za-z0-9._-]{10,}/gi;

function replaceControlCharacters(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ");
}

function cleanString(value: string, limit = 1500): string {
  const redacted = value.replace(SECRET_VALUE, (match, bearer) =>
    bearer ? `${bearer}[REDACTED]` : "[REDACTED]",
  );
  return replaceControlCharacters(redacted).slice(0, limit);
}

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string") return cleanString(value);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, key, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>).slice(
      0,
      40,
    )) {
      out[childKey] = sanitize(childValue, childKey, depth + 1);
    }
    return out;
  }
  return String(value);
}

export async function withDiagnosticContext<T>(
  context: DiagnosticContext,
  fn: () => Promise<T>,
): Promise<T> {
  return diagnostics.run(context, fn);
}

export function safeErrorSnippet(raw: string, limit = 1500): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as unknown;
    return cleanString(JSON.stringify(sanitize(parsed)), limit);
  } catch {
    return cleanString(raw, limit);
  }
}

export function diagnosticResponseHeaders(response: Response): Record<string, string> {
  const names = [
    "x-request-id",
    "request-id",
    "cf-ray",
    "retry-after",
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
  ];
  const result: Record<string, string> = {};
  for (const name of names) {
    const value = response.headers.get(name);
    if (value) result[name] = cleanString(value, 200);
  }
  return result;
}

export function logDiagnostic(
  level: DiagnosticLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const context = diagnostics.getStore();
  const payload = sanitize({
    trace_id: context?.traceId ?? "unscoped",
    conversation_id: context?.conversationId,
    event,
    ...details,
  });
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  logger("[tpec-diag]", payload);
}
