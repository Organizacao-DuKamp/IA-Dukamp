import {
  ChatCoreResultSchema,
  MAX_CHAT_PROXY_BODY_BYTES,
  MAX_CHAT_PROXY_RESPONSE_BYTES,
  type ChatCoreResult,
  type ChatInput,
} from "./input";

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
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

function runtimeEnv(deps: TpecBackendDependencies): EnvLike {
  return deps.env ?? process.env;
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
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL inválida.",
      500,
      "invalid_lovable_backend_url",
    );
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
    throw new TpecBackendError(
      "Destino do proxy inválido.",
      500,
      "unexpected_proxy_origin",
    );
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), parseTimeoutMs(env));
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
      throw new TpecBackendError(
        "O backend da TPEC-IA retornou uma resposta inválida.",
        502,
        "invalid_proxy_json",
      );
    }

    if (response.ok) {
      const parsed = ChatCoreResultSchema.safeParse(body);
      if (!parsed.success) {
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

    console.info(
      `[tpec-proxy] request completed status=${response.status} duration_ms=${(deps.now ?? Date.now)() - started}`,
    );
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof TpecBackendError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new TpecBackendError(
        "O backend da TPEC-IA demorou para responder.",
        504,
        "proxy_timeout",
      );
    }
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
  const load =
    deps.loadLocalBackend ??
    (() => import("./core.server") as Promise<LocalBackendModule>);
  const local = await load();
  try {
    const result = ChatCoreResultSchema.parse(await local.handleIncoming(input));
    return { status: 200, body: result };
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    if (error instanceof Error && typeof status === "number") {
      return { status, body: { error: error.message } };
    }
    throw error;
  }
}

export async function dispatchChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  const mode = resolveTpecBackendMode(runtimeEnv(deps));
  console.info(`[tpec-backend] mode=${mode}`);
  if (mode === "proxy") return proxyChat(input, deps);
  return executeLocalChat(input, deps);
}
