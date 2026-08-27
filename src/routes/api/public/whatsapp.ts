import { createHmac, timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

import { enforceDurableWhatsAppStateStore } from "@/lib/whatsapp/state-store-guard.server";

const MAX_BACKGROUND_WEBHOOK_BYTES = 240 * 1024;
const BACKGROUND_FUNCTION_PATH = "/.netlify/functions/whatsapp-process";

type EnvLike = Record<string, string | undefined>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function validMetaSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(signature, expected);
}

export function shouldUseWhatsAppBackground(env: EnvLike = process.env): boolean {
  const explicit = env.TPEC_WHATSAPP_BACKGROUND?.trim().toLowerCase();
  if (explicit === "false" || explicit === "0") return false;
  if (explicit === "true" || explicit === "1") return true;

  // Netlify injeta NETLIFY/CONTEXT no ambiente de deploy. Em desenvolvimento
  // local mantemos o handler síncrono para não exigir uma Function separada.
  return env.NETLIFY === "true" || Boolean(env.CONTEXT?.trim());
}

async function handleDirect(request: Request): Promise<Response> {
  enforceDurableWhatsAppStateStore();
  const { handleEnhancedWhatsAppWebhookRequest } =
    await import("@/lib/whatsapp/enhanced-http.server");
  return handleEnhancedWhatsAppWebhookRequest(request);
}

async function enqueueBackground(request: Request): Promise<Response> {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) return json({ error: "whatsapp_not_configured" }, 503);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BACKGROUND_WEBHOOK_BYTES) {
    return json({ error: "whatsapp_webhook_too_large" }, 413);
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!validMetaSignature(rawBody, signature, appSecret)) {
    return json({ error: "invalid_whatsapp_signature" }, 401);
  }

  const backgroundUrl = new URL(BACKGROUND_FUNCTION_PATH, request.url);
  let queued: Response;
  try {
    queued = await fetch(backgroundUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        "x-hub-signature-256": signature ?? "",
      },
      body: rawBody,
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.error(
      `[whatsapp] background enqueue failed ${error instanceof Error ? error.message : String(error)}`,
    );
    // Não confirme recebimento à Meta se nem sequer conseguimos enfileirar.
    // Ela poderá reenviar o mesmo webhook em vez de a mensagem ser perdida.
    return json({ error: "whatsapp_background_unavailable" }, 503);
  }

  if (queued.status !== 202) {
    console.error(`[whatsapp] background enqueue rejected status=${queued.status}`);
    return json({ error: "whatsapp_background_rejected" }, 503);
  }

  console.info("[whatsapp] webhook acknowledged; background processing queued");
  return json({ received: true, queued: true });
}

async function handle(request: Request): Promise<Response> {
  // O GET de verificação da Meta é instantâneo e continua no handler normal.
  if (request.method === "GET" || !shouldUseWhatsAppBackground()) {
    return handleDirect(request);
  }

  if (request.method === "POST") return enqueueBackground(request);
  return handleDirect(request);
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
