import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveTpecBackendMode } from "../chat/backend.server.ts";
import { dispatchWhatsAppChat } from "./backend.server.ts";
import { processWhatsAppChat } from "./conversation.server.ts";
import { WhatsAppChatInputSchema, type WhatsAppChatInput, type WhatsAppChatResult } from "./types.ts";

type EnvLike = Record<string, string | undefined>;

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const MAX_OUTBOUND_CHARS = 3500;

export interface WhatsAppHttpDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  dispatchChat?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
  processLocal?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
}

interface IncomingTextMessage {
  phoneNumberId: string;
  phone: string;
  messageId: string;
  text: string;
}

function envOf(deps: WhatsAppHttpDependencies): EnvLike {
  return deps.env ?? process.env;
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

function requireEnv(env: EnvLike, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`missing_${key.toLowerCase()}`);
  return value;
}

function verifyWebhookSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(signature, expected);
}

async function readLimitedBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BODY_BYTES) throw new Error("webhook_body_too_large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    throw new Error("webhook_body_too_large");
  }
  return raw;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractTextMessages(payload: unknown): IncomingTextMessage[] {
  const root = asRecord(payload);
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];

  const messages: IncomingTextMessage[] = [];
  for (const rawEntry of root.entry) {
    const entry = asRecord(rawEntry);
    if (!entry || !Array.isArray(entry.changes)) continue;

    for (const rawChange of entry.changes) {
      const change = asRecord(rawChange);
      if (!change || change.field !== "messages") continue;
      const value = asRecord(change.value);
      const metadata = asRecord(value?.metadata);
      const phoneNumberId = typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : "";
      if (!value || !phoneNumberId || !Array.isArray(value.messages)) continue;

      for (const rawMessage of value.messages) {
        const message = asRecord(rawMessage);
        const textObject = asRecord(message?.text);
        if (
          !message ||
          message.type !== "text" ||
          typeof message.from !== "string" ||
          typeof message.id !== "string" ||
          typeof textObject?.body !== "string"
        ) {
          continue;
        }

        const parsed = WhatsAppChatInputSchema.safeParse({
          phone: message.from,
          messageId: message.id,
          text: textObject.body,
        });
        if (!parsed.success) continue;
        messages.push({ phoneNumberId, ...parsed.data });
      }
    }
  }
  return messages;
}

function splitOutboundText(value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return [];
  const chars = Array.from(normalized);
  const chunks: string[] = [];
  for (let index = 0; index < chars.length; index += MAX_OUTBOUND_CHARS) {
    chunks.push(chars.slice(index, index + MAX_OUTBOUND_CHARS).join(""));
  }
  return chunks;
}

async function sendWhatsAppText(
  to: string,
  body: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<void> {
  const accessToken = requireEnv(env, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv(env, "WHATSAPP_PHONE_NUMBER_ID");
  const version = (env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0").replace(/^\/+|\/+$/g, "");
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("invalid_whatsapp_graph_api_version");

  for (const chunk of splitOutboundText(body)) {
    const response = await fetchImpl(
      `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: chunk },
        }),
        redirect: "error",
      },
    );

    if (!response.ok) {
      throw new Error(`whatsapp_send_failed:${response.status}`);
    }
  }
}

export async function handleWhatsAppWebhookRequest(
  request: Request,
  dependencies: WhatsAppHttpDependencies = {},
): Promise<Response> {
  const env = envOf(dependencies);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const provided = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const expected = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";

    if (mode === "subscribe" && expected && provided && safeEqual(expected, provided) && challenge) {
      return text(challenge, 200);
    }
    return text("Forbidden", 403);
  }

  if (request.method !== "POST") return text("Method Not Allowed", 405);

  let rawBody: string;
  try {
    rawBody = await readLimitedBody(request);
  } catch {
    return text("Payload Too Large", 413);
  }

  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not configured");
    return text("Webhook not configured", 503);
  }
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return text("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return text("Invalid JSON", 400);
  }

  const configuredPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const incoming = extractTextMessages(payload).filter(
    (message) => !configuredPhoneNumberId || message.phoneNumberId === configuredPhoneNumberId,
  );
  if (incoming.length === 0) return json({ received: true });

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const dispatch =
    dependencies.dispatchChat ??
    ((input: WhatsAppChatInput) =>
      dispatchWhatsAppChat(input, { env, fetchImpl: dependencies.fetchImpl }));

  try {
    for (const message of incoming) {
      const result = await dispatch({
        phone: message.phone,
        messageId: message.messageId,
        text: message.text,
      });
      if (result.shouldSend && result.reply) {
        await sendWhatsAppText(message.phone, result.reply, env, fetchImpl);
      }
    }
    return json({ received: true });
  } catch {
    console.error("[whatsapp] webhook processing failed");
    return json({ error: "whatsapp_processing_failed" }, 500);
  }
}

export async function handleInternalWhatsAppChatRequest(
  request: Request,
  dependencies: WhatsAppHttpDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const env = envOf(dependencies);

  let mode;
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

  let value: unknown;
  try {
    value = JSON.parse(await readLimitedBody(request));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = WhatsAppChatInputSchema.safeParse(value);
  if (!parsed.success) return json({ error: "invalid_request" }, 400);

  try {
    const result = await (dependencies.processLocal ?? processWhatsAppChat)(parsed.data);
    return json(result, 200);
  } catch {
    console.error("[whatsapp] internal chat processing failed");
    return json({ error: "whatsapp_chat_failed" }, 500);
  }
}
