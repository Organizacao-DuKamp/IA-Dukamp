import { timingSafeEqual } from "node:crypto";

import { resolveTpecBackendMode } from "../chat/backend.server.ts";
import {
  WhatsAppChatInputSchema,
  WhatsAppControlRequestSchema,
  type WhatsAppControlResult,
} from "./types.ts";

type EnvLike = Record<string, string | undefined>;
const MAX_INTERNAL_BODY_BYTES = 256 * 1024;

export interface WhatsAppInternalHttpDependencies {
  env?: EnvLike;
}

function envOf(dependencies: WhatsAppInternalHttpDependencies): EnvLike {
  return dependencies.env ?? process.env;
}

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

function authorize(request: Request, env: EnvLike): Response | null {
  let mode: "local" | "proxy";
  try {
    mode = resolveTpecBackendMode(env);
  } catch {
    return json({ error: "invalid_backend_mode" }, 500);
  }
  if (mode !== "local") return json({ error: "not_found" }, 404);

  const expected = env.TPEC_PROXY_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-tpec-proxy-secret")?.trim() ?? "";
  const hop = request.headers.get("x-tpec-proxy-hop") ?? "";
  if (expected.length < 32 || !provided || !safeEqual(expected, provided)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (hop !== "1") return json({ error: "invalid_proxy_hop" }, 400);
  return null;
}

async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_INTERNAL_BODY_BYTES) throw new Error("body_too_large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_INTERNAL_BODY_BYTES) {
    throw new Error("body_too_large");
  }
  return JSON.parse(raw);
}

export async function handleInternalWhatsAppChatRequest(
  request: Request,
  dependencies: WhatsAppInternalHttpDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const env = envOf(dependencies);
  const rejected = authorize(request, env);
  if (rejected) return rejected;

  let raw: unknown;
  try {
    raw = await readJson(request);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = WhatsAppChatInputSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  try {
    const conversation = await import("./conversation.server.ts");
    const alreadyClaimed = request.headers.get("x-tpec-whatsapp-claimed") === "1";
    const result = alreadyClaimed
      ? await conversation.processClaimedWhatsAppChat(parsed.data)
      : await conversation.processWhatsAppChat(parsed.data);
    return json(result, 200);
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    const message = error instanceof Error ? error.message : "whatsapp_chat_failed";
    return json(
      { error: message },
      typeof status === "number" && status >= 400 && status <= 599 ? status : 500,
    );
  }
}

export async function handleInternalWhatsAppControlRequest(
  request: Request,
  dependencies: WhatsAppInternalHttpDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const env = envOf(dependencies);
  const rejected = authorize(request, env);
  if (rejected) return rejected;

  let raw: unknown;
  try {
    raw = await readJson(request);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = WhatsAppControlRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  try {
    const conversation = await import("./conversation.server.ts");
    let result: WhatsAppControlResult;
    switch (parsed.data.action) {
      case "claim":
        result = await conversation.claimWhatsAppInboundMessage(
          parsed.data.messageId,
          parsed.data.phone,
        );
        break;
      case "complete":
        await conversation.completeWhatsAppInboundMessage(
          parsed.data.messageId,
          parsed.data.reply,
        );
        result = { kind: "ok" };
        break;
      case "release":
        await conversation.releaseWhatsAppInboundMessage(parsed.data.messageId);
        result = { kind: "ok" };
        break;
      case "claim_delivery":
        result = await conversation.claimPendingWhatsAppDelivery(parsed.data.messageId);
        break;
      case "delivered":
        await conversation.markPendingWhatsAppDeliveryDone(
          parsed.data.messageId,
          parsed.data.reply,
        );
        result = { kind: "ok" };
        break;
      case "release_delivery":
        await conversation.releasePendingWhatsAppDelivery(
          parsed.data.messageId,
          parsed.data.reply,
        );
        result = { kind: "ok" };
        break;
    }
    return json(result, 200);
  } catch (error) {
    console.error(
      `[whatsapp-internal] control failed ${error instanceof Error ? error.message : String(error)}`,
    );
    return json({ error: "whatsapp_control_failed" }, 500);
  }
}
