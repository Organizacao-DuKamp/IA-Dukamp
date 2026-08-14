import {
  ChatCoreResultSchema,
  MAX_CHAT_PROXY_BODY_BYTES,
  MAX_CHAT_PROXY_RESPONSE_BYTES,
  type ChatCoreResult,
  type ChatInput,
} from "./input.ts";
import {
  diagnosticResponseHeaders,
  logDiagnostic,
  withDiagnosticContext,
} from "./diagnostics.server.ts";

export type TpecBackendMode = "local" | "proxy";
type EnvLike = Record<string, string | undefined>;

type LocalBackendModule = {
  handleIncoming: (input: ChatInput) => Promise<ChatCoreResult>;
};

export interface TpecBackendDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  loadLocalBackend?: () => Promise<LocalBackendModule>;
  now?: () => number;
}

export interface BackendDispatchResult {
  status: number;
  body: unknown;
}

export class TpecBackendError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TpecBackendError";
    this.status = status;
    this.code = code;
  }
}

function runtimeEnv(deps: TpecBackendDependencies): EnvLike {
  return deps.env ?? process.env;
}

function traceContext(input: ChatInput) {
  return {
    traceId: (input.clientMessageId || input.conversationId || input.sessionId || "unknown").slice(0, 128),
    conversationId: (input.conversationId || input.sessionId || "unknown").slice(0, 128),
  };
}

function backendErrorSummary(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  return {
    backend_error: typeof record.error === "string" ? record.error : undefined,
    backend_code: typeof record.code === "string" ? record.code : undefined,
  };
}

export function resolveTpecBackendMode(env: EnvLike = process.env): TpecBackendMode {
  const raw = env.TPEC_BACKEND_MODE?.trim().toLowerCase();
  if (!raw || raw === "local") return "local";
  if (raw === "proxy") return "proxy";
  throw new TpecBackendError(
    "TPEC_BACKEND_MODE deve ser local ou proxy.",
    500,
    "invalid_backend_mode",
  );
}

function parseTimeoutMs(env: EnvLike): number {
  const raw = Number(env.TPEC_PROXY_TIMEOUT_MS ?? 45_000);
  if (!Number.isFinite(raw)) return 45_000;
  return Math.min(Math.max(Math.trunc(raw), 5_000), 60_000);
}

export function resolveLovableBackendUrl(env: EnvLike = process.env): URL {
  const raw = env.LOVABLE_BACKEND_URL?.trim();
  if (!raw) {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL não configurada no servidor proxy.",
      500,
      "missing_lovable_backend_url",
    );
  }

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new TpecBackendError("LOVABLE_BACKEND_URL inválida.", 500, "invalid_lovable_backend_url");
  }

  const production = env.NODE_ENV === "production";
  if ((production && base.protocol !== "https:") || !["https:", "http:"].includes(base.protocol)) {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL deve usar HTTPS em produção.",
      500,
      "invalid_lovable_backend_protocol",
    );
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL contém componentes não permitidos.",
      500,
      "invalid_lovable_backend_url",
    );
  }

  const normalizedBase = base.toString().replace(/\/+$/, "");
  const endpoint = new URL(`${normalizedBase}/api/internal/chat`);
  if (endpoint.origin !== base.origin) {
    throw new TpecBackendError("Destino do proxy inválido.", 500, "unexpected_proxy_origin");
  }
  return endpoint;
}

function requireProxySecret(env: EnvLike): string {
  const secret = env.TPEC_PROXY_SECRET?.trim();
  if (!secret) {
    throw new TpecBackendError(
      "TPEC_PROXY_SECRET não configurado no servidor.",
      500,
      "missing_proxy_secret",
    );
  }
  if (secret.length < 32) {
    throw new TpecBackendError(
      "TPEC_PROXY_SECRET deve ter pelo menos 32 caracteres.",
      500,
      "weak_proxy_secret",
    );
  }
  return secret;
}

async function readLimitedResponse(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_CHAT_PROXY_RESPONSE_BYTES) {
    throw new TpecBackendError(
      "Resposta do backend excedeu o limite permitido.",
      502,
      "proxy_response_too_large",
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_CHAT_PROXY_RESPONSE_BYTES) {
    throw new TpecBackendError(
      "Resposta do backend excedeu o limite permitido.",
      502,
      "proxy_response_too_large",
    );
  }
  return new TextDecoder().decode(bytes);
}

export async function proxyChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  const env = runtimeEnv(deps);
  const endpoint = resolveLovableBackendUrl(env);
  const secret = requireProxySecret(env);
  const payload = JSON.stringify(input);
  if (new TextEncoder().encode(payload).byteLength > MAX_CHAT_PROXY_BODY_BYTES) {
    throw new TpecBackendError(
      "Requisição do chat excedeu o limite permitido.",
      413,
      "request_too_large",
    );
  }

  const started = (deps.now ?? Date.now)();
  const timeoutMs = parseTimeoutMs(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  logDiagnostic("info", "proxy.request.start", {
    destination_origin: endpoint.origin,
    timeout_ms: timeoutMs,
    payload_bytes: new TextEncoder().encode(payload).byteLength,
  });

  try {
    const response = await (deps.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-secret": secret,
        "x-tpec-proxy-hop": "1",
      },
      body: payload,
      redirect: "error",
      signal: controller.signal,
    });

    const raw = await readLimitedResponse(response);
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      logDiagnostic("error", "proxy.response.invalid_json", {
        status: response.status,
        duration_ms: (deps.now ?? Date.now)() - started,
        response_bytes: new TextEncoder().encode(raw).byteLength,
        response_headers: diagnosticResponseHeaders(response),
      });
      throw new TpecBackendError(
        "O backend da TPEC-IA retornou uma resposta inválida.",
        502,
        "invalid_proxy_json",
      );
    }

    if (response.ok) {
      const parsed = ChatCoreResultSchema.safeParse(body);
      if (!parsed.success) {
        logDiagnostic("error", "proxy.response.invalid_shape", {
          status: response.status,
          duration_ms: (deps.now ?? Date.now)() - started,
          response_headers: diagnosticResponseHeaders(response),
          schema_issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        });
        throw new TpecBackendError(
          "O backend da TPEC-IA retornou um formato inesperado.",
          502,
          "invalid_proxy_response",
        );
      }
      body = parsed.data;
    } else if (!body || typeof body !== "object") {
      body = { error: "Falha no backend da TPEC-IA." };
    }

    const level = response.ok ? "info" : "error";
    logDiagnostic(level, "proxy.request.finish", {
      status: response.status,
      duration_ms: (deps.now ?? Date.now)() - started,
      response_headers: diagnosticResponseHeaders(response),
      ...backendErrorSummary(body),
    });
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof TpecBackendError) {
      logDiagnostic("error", "proxy.request.error", {
        status: error.status,
        code: error.code,
        message: error.message,
        duration_ms: (deps.now ?? Date.now)() - started,
      });
      throw error;
    }
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      logDiagnostic("error", "proxy.request.timeout", {
        timeout_ms: timeoutMs,
        duration_ms: (deps.now ?? Date.now)() - started,
      });
      throw new TpecBackendError(
        "O backend da TPEC-IA demorou para responder.",
        504,
        "proxy_timeout",
      );
    }
    logDiagnostic("error", "proxy.request.network_error", {
      error_name: error instanceof Error ? error.name : "unknown",
      error_message: error instanceof Error ? error.message : String(error),
      duration_ms: (deps.now ?? Date.now)() - started,
    });
    throw new TpecBackendError(
      "Não foi possível acessar o backend da TPEC-IA.",
      502,
      "proxy_unavailable",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function executeLocalChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  return withDiagnosticContext(traceContext(input), async () => {
    const started = (deps.now ?? Date.now)();
    const load =
      deps.loadLocalBackend ?? (() => import("./core.server.ts") as Promise<LocalBackendModule>);
    logDiagnostic("info", "backend.local.start", {
      history_messages: input.history.length,
      text_chars: input.text.length,
    });
    const local = await load();
    try {
      const result = ChatCoreResultSchema.parse(await local.handleIncoming(input));
      logDiagnostic("info", "backend.local.finish", {
        status: 200,
        duration_ms: (deps.now ?? Date.now)() - started,
        reply_chars: result.reply.length,
      });
      return { status: 200, body: result };
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      logDiagnostic("error", "backend.local.error", {
        status: typeof status === "number" ? status : 500,
        error_name: error instanceof Error ? error.name : "unknown",
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: (deps.now ?? Date.now)() - started,
      });
      if (error instanceof Error && typeof status === "number") {
        return { status, body: { error: error.message } };
      }
      throw error;
    }
  });
}

export async function dispatchChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  const mode = resolveTpecBackendMode(runtimeEnv(deps));
  if (mode === "local") return executeLocalChat(input, deps);

  return withDiagnosticContext(traceContext(input), async () => {
    logDiagnostic("info", "backend.dispatch", { mode });
    return proxyChat(input, deps);
  });
}
