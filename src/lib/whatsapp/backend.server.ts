import { resolveTpecBackendMode, TpecBackendError } from "../chat/backend.server.ts";
import {
  WhatsAppChatResultSchema,
  WhatsAppControlResultSchema,
  type WhatsAppChatInput,
  type WhatsAppChatResult,
  type WhatsAppControlRequest,
  type WhatsAppControlResult,
} from "./types.ts";

type EnvLike = Record<string, string | undefined>;

export interface WhatsAppBackendDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  processLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
  processClaimedLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
}

function envOf(deps: WhatsAppBackendDependencies): EnvLike {
  return deps.env ?? process.env;
}

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";
  const candidate = error as Error & { code?: unknown; status?: unknown };
  const parts = [`name=${candidate.name}`, `message=${candidate.message}`];
  if (typeof candidate.code === "string") parts.push(`code=${candidate.code}`);
  if (typeof candidate.status === "number") parts.push(`status=${candidate.status}`);
  return parts.join(" ");
}

function requireProxySecret(env: EnvLike): string {
  const secret = env.TPEC_PROXY_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new TpecBackendError(
      "TPEC_PROXY_SECRET ausente ou fraco para o proxy do WhatsApp.",
      500,
      "invalid_proxy_secret",
    );
  }
  return secret;
}

function resolveInternalWhatsAppUrl(env: EnvLike, path: string): URL {
  const raw = env.LOVABLE_BACKEND_URL?.trim();
  if (!raw) {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL não configurada para o WhatsApp.",
      500,
      "missing_lovable_backend_url",
    );
  }

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL inválida para o WhatsApp.",
      500,
      "invalid_lovable_backend_url",
    );
  }

  if (
    !["http:", "https:"].includes(base.protocol) ||
    (env.NODE_ENV === "production" && base.protocol !== "https:") ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new TpecBackendError(
      "LOVABLE_BACKEND_URL não é permitida para o WhatsApp.",
      500,
      "invalid_lovable_backend_url",
    );
  }

  const normalized = base.toString().replace(/\/+$/, "");
  const endpoint = new URL(`${normalized}${path}`);
  if (endpoint.origin !== base.origin) {
    throw new TpecBackendError("Destino interno inválido.", 500, "unexpected_proxy_origin");
  }
  return endpoint;
}

function chatTimeoutMs(env: EnvLike): number {
  const value = Number(env.TPEC_PROXY_TIMEOUT_MS ?? 55_000);
  if (!Number.isFinite(value)) return 55_000;
  return Math.min(Math.max(Math.trunc(value), 5_000), 58_000);
}

function controlTimeoutMs(env: EnvLike): number {
  const value = Number(env.TPEC_WHATSAPP_CONTROL_TIMEOUT_MS ?? 8_000);
  if (!Number.isFinite(value)) return 8_000;
  return Math.min(Math.max(Math.trunc(value), 2_000), 15_000);
}

async function proxyJson(
  endpoint: URL,
  payload: unknown,
  env: EnvLike,
  dependencies: WhatsAppBackendDependencies,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<unknown> {
  const secret = requireProxySecret(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await (dependencies.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-secret": secret,
        "x-tpec-proxy-hop": "1",
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: controller.signal,
    });

    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      console.error(
        `[whatsapp-backend] invalid JSON path=${endpoint.pathname} chars=${raw.length}`,
      );
      throw new TpecBackendError(
        "O backend do WhatsApp retornou JSON inválido.",
        502,
        "invalid_whatsapp_proxy_json",
      );
    }

    console.info(
      `[whatsapp-backend] proxy response path=${endpoint.pathname} status=${response.status} duration_ms=${Date.now() - started}`,
    );

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: unknown }).error ?? "whatsapp_proxy_failed")
          : "Falha no backend do WhatsApp.";
      throw new TpecBackendError(message, response.status, "whatsapp_proxy_failed");
    }
    return body;
  } catch (error) {
    if (error instanceof TpecBackendError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new TpecBackendError(
        "O backend da TPEC-IA demorou para responder ao WhatsApp.",
        504,
        "whatsapp_proxy_timeout",
      );
    }
    console.error(`[whatsapp-backend] proxy unavailable source=${errorDetails(error)}`);
    throw new TpecBackendError(
      "Não foi possível acessar o backend da TPEC-IA pelo WhatsApp.",
      502,
      "whatsapp_proxy_unavailable",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchWhatsAppChatInternal(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies,
  alreadyClaimed: boolean,
): Promise<WhatsAppChatResult> {
  const env = envOf(dependencies);
  const mode = resolveTpecBackendMode(env);
  console.info(`[whatsapp-backend] mode=${mode} already_claimed=${alreadyClaimed}`);

  if (mode === "local") {
    const conversation = await import("./conversation.server.ts");
    const processLocal = alreadyClaimed
      ? (dependencies.processClaimedLocal ?? conversation.processClaimedWhatsAppChat)
      : (dependencies.processLocal ?? conversation.processWhatsAppChat);
    return processLocal(input);
  }

  const endpoint = resolveInternalWhatsAppUrl(env, "/api/internal/whatsapp-chat");
  const body = await proxyJson(
    endpoint,
    input,
    env,
    dependencies,
    chatTimeoutMs(env),
    alreadyClaimed ? { "x-tpec-whatsapp-claimed": "1" } : {},
  );
  const parsed = WhatsAppChatResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new TpecBackendError(
      "O backend do WhatsApp retornou formato inesperado.",
      502,
      "invalid_whatsapp_proxy_response",
    );
  }
  return parsed.data;
}

export async function dispatchWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppChatResult> {
  return dispatchWhatsAppChatInternal(input, dependencies, false);
}

export async function dispatchClaimedWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppChatResult> {
  return dispatchWhatsAppChatInternal(input, dependencies, true);
}

async function controlLocal(request: WhatsAppControlRequest): Promise<WhatsAppControlResult> {
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

export async function controlWhatsAppMessage(
  request: WhatsAppControlRequest,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppControlResult> {
  const env = envOf(dependencies);
  const mode = resolveTpecBackendMode(env);
  if (mode === "local") return controlLocal(request);

  const endpoint = resolveInternalWhatsAppUrl(env, "/api/internal/whatsapp-control");
  const body = await proxyJson(endpoint, request, env, dependencies, controlTimeoutMs(env));
  const parsed = WhatsAppControlResultSchema.safeParse(body);
  if (!parsed.success) {
    throw new TpecBackendError(
      "O controle de idempotência do WhatsApp retornou formato inesperado.",
      502,
      "invalid_whatsapp_control_response",
    );
  }
  return parsed.data;
}
