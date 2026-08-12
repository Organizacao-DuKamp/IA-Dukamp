import { resolveTpecBackendMode, TpecBackendError } from "../chat/backend.server.ts";
import {
  WhatsAppChatResultSchema,
  type WhatsAppChatInput,
  type WhatsAppChatResult,
} from "./types.ts";

type EnvLike = Record<string, string | undefined>;

export interface WhatsAppBackendDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  processLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
}

function envOf(deps: WhatsAppBackendDependencies): EnvLike {
  return deps.env ?? process.env;
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

function resolveInternalWhatsAppUrl(env: EnvLike): URL {
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
  const endpoint = new URL(`${normalized}/api/internal/whatsapp-chat`);
  if (endpoint.origin !== base.origin) {
    throw new TpecBackendError("Destino interno inválido.", 500, "unexpected_proxy_origin");
  }
  return endpoint;
}

function timeoutMs(env: EnvLike): number {
  const value = Number(env.TPEC_PROXY_TIMEOUT_MS ?? 45_000);
  if (!Number.isFinite(value)) return 45_000;
  return Math.min(Math.max(Math.trunc(value), 5_000), 60_000);
}

export async function dispatchWhatsAppChat(
  input: WhatsAppChatInput,
  dependencies: WhatsAppBackendDependencies = {},
): Promise<WhatsAppChatResult> {
  const env = envOf(dependencies);
  const mode = resolveTpecBackendMode(env);
  if (mode === "local") {
    const processLocal =
      dependencies.processLocal ?? (await import("./conversation.server.ts")).processWhatsAppChat;
    return processLocal(input);
  }

  const endpoint = resolveInternalWhatsAppUrl(env);
  const secret = requireProxySecret(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs(env));

  try {
    const response = await (dependencies.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-secret": secret,
        "x-tpec-proxy-hop": "1",
      },
      body: JSON.stringify(input),
      redirect: "error",
      signal: controller.signal,
    });

    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new TpecBackendError(
        "O backend do WhatsApp retornou JSON inválido.",
        502,
        "invalid_whatsapp_proxy_json",
      );
    }

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error?: unknown }).error ?? "whatsapp_proxy_failed")
          : "Falha no backend do WhatsApp.";
      throw new TpecBackendError(message, response.status, "whatsapp_proxy_failed");
    }

    const parsed = WhatsAppChatResultSchema.safeParse(body);
    if (!parsed.success) {
      throw new TpecBackendError(
        "O backend do WhatsApp retornou formato inesperado.",
        502,
        "invalid_whatsapp_proxy_response",
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof TpecBackendError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new TpecBackendError(
        "O backend da TPEC-IA demorou para responder ao WhatsApp.",
        504,
        "whatsapp_proxy_timeout",
      );
    }
    throw new TpecBackendError(
      "Não foi possível acessar o backend da TPEC-IA pelo WhatsApp.",
      502,
      "whatsapp_proxy_unavailable",
    );
  } finally {
    clearTimeout(timer);
  }
}
