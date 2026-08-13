import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveTpecBackendMode } from "../chat/backend.server.ts";
import { dispatchWhatsAppChat } from "./backend.server.ts";
import {
  WhatsAppChatInputSchema,
  type WhatsAppChatInput,
  type WhatsAppChatResult,
} from "./types.ts";

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

function errorDetails(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";
  const candidate = error as Error & { code?: unknown; status?: unknown };
  const parts = [`name=${candidate.name}`, `message=${candidate.message}`];
  if (typeof candidate.code === "string") parts.push(`code=${candidate.code}`);
  if (typeof candidate.status === "number") parts.push(`status=${candidate.status}`);
  return parts.join(" ");
}

function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
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
      const phoneNumberId =
        typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : "";
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

  const chunks = splitOutboundText(body);
  console.info(`[whatsapp] outbound start chunks=${chunks.length} reply_chars=${Array.from(body).length}`);

  for (let index = 0; index < chunks.length; index += 1) {
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
          text: { preview_url: false, body: chunks[index] },
        }),
        redirect: "error",
      },
    );

    console.info(`[whatsapp] graph response chunk=${index + 1}/${chunks.length} status=${response.status} ok=${response.ok}`);

    if (!response.ok) {
      let graphError = "";
      try {
        const raw = await response.text();
        if (raw) {
          const parsed = JSON.parse(raw) as {
            error?: { message?: unknown; type?: unknown; code?: unknown; error_subcode?: unknown };
          };
          const err = parsed?.error;
          if (err) {
            graphError = [
              typeof err.code === "number" ? `code=${err.code}` : "",
              typeof err.error_subcode === "number" ? `subcode=${err.error_subcode}` : "",
              typeof err.type === "string" ? `type=${err.type}` : "",
              typeof err.message === "string" ? `message=${err.message}` : "",
            ]
              .filter(Boolean)
              .join(" ");
          }
        }
      } catch {
        graphError = "unreadable_graph_error";
      }
      console.error(`[whatsapp] graph send failed status=${response.status}${graphError ? ` ${graphError}` : ""}`);
      throw new Error(`whatsapp_send_failed:${response.status}`);
    }
  }

  console.info("[whatsapp] outbound completed");
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

    const verified = Boolean(
      mode === "subscribe" &&
        expected &&
        provided &&
        safeEqual(expected, provided) &&
        challenge,
    );
    console.info(`[whatsapp] webhook verification verified=${verified} verify_token_configured=${Boolean(expected)}`);

    if (verified) return text(challenge, 200);
    return text("Forbidden", 403);
  }

  if (request.method !== "POST") return text("Method Not Allowed", 405);

  console.info("[whatsapp] webhook POST received");

  let rawBody: string;
  try {
    rawBody = await readLimitedBody(request);
    console.info(`[whatsapp] webhook body received bytes=${new TextEncoder().encode(rawBody).byteLength}`);
  } catch (error) {
    console.error(`[whatsapp] webhook body rejected ${errorDetails(error)}`);
    return text("Payload Too Large", 413);
  }

  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  console.info(`[whatsapp] app_secret_configured=${Boolean(appSecret)} signature_header_present=${request.headers.has("x-hub-signature-256")}`);
  if (!appSecret) {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not configured");
    return text("Webhook not configured", 503);
  }

  const signatureValid = verifyWebhookSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
    appSecret,
  );
  console.info(`[whatsapp] signature_valid=${signatureValid}`);
  if (!signatureValid) {
    console.error("[whatsapp] webhook rejected: invalid Meta signature");
    return text("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error(`[whatsapp] invalid JSON ${errorDetails(error)}`);
    return text("Invalid JSON", 400);
  }

  const configuredPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const extracted = extractTextMessages(payload);
  const incoming = extracted.filter(
    (message) => !configuredPhoneNumberId || message.phoneNumberId === configuredPhoneNumberId,
  );
  console.info(
    `[whatsapp] parsed text_messages=${extracted.length} matched_messages=${incoming.length} phone_number_id_configured=${Boolean(configuredPhoneNumberId)}`,
  );

  if (extracted.length > 0 && incoming.length === 0) {
    console.error("[whatsapp] message ignored: webhook phone_number_id does not match WHATSAPP_PHONE_NUMBER_ID");
  }
  if (incoming.length === 0) {
    console.info("[whatsapp] no processable text message; acknowledging webhook");
    return json({ received: true });
  }

  let backendMode = "invalid";
  try {
    backendMode = resolveTpecBackendMode(env);
    console.info(`[whatsapp] backend_mode=${backendMode}`);
  } catch (error) {
    console.error(`[whatsapp] backend mode error ${errorDetails(error)}`);
    return json({ error: "whatsapp_processing_failed" }, 500);
  }

  console.info(
    `[whatsapp] env access_token_configured=${Boolean(env.WHATSAPP_ACCESS_TOKEN?.trim())} proxy_url_configured=${Boolean(env.LOVABLE_BACKEND_URL?.trim())} proxy_secret_configured=${Boolean(env.TPEC_PROXY_SECRET?.trim())}`,
  );

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const dispatch =
    dependencies.dispatchChat ??
    ((input: WhatsAppChatInput) =>
      dispatchWhatsAppChat(input, { env, fetchImpl: dependencies.fetchImpl }));

  try {
    for (let index = 0; index < incoming.length; index += 1) {
      const message = incoming[index];
      console.info(
        `[whatsapp] dispatch start message=${index + 1}/${incoming.length} text_chars=${Array.from(message.text).length}`,
      );
      const started = Date.now();
      const result = await dispatch({
        phone: message.phone,
        messageId: message.messageId,
        text: message.text,
      });
      console.info(
        `[whatsapp] dispatch completed duration_ms=${Date.now() - started} should_send=${result.shouldSend} has_reply=${Boolean(result.reply)} reply_chars=${result.reply ? Array.from(result.reply).length : 0}`,
      );
      if (result.shouldSend && result.reply) {
        console.info("[whatsapp] sending reply to Graph API");
        await sendWhatsAppText(message.phone, result.reply, env, fetchImpl);
      } else {
        console.info("[whatsapp] reply not sent because dispatch returned shouldSend=false or empty reply");
      }
    }
    console.info("[whatsapp] webhook processing completed successfully");
    return json({ received: true });
  } catch (error) {
    console.error(`[whatsapp] webhook processing failed ${errorDetails(error)}`);
    return json({ error: "whatsapp_processing_failed" }, 500);
  }
}

export async function handleInternalWhatsAppChatRequest(
  request: Request,
  dependencies: WhatsAppHttpDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const env = envOf(dependencies);

  console.info("[whatsapp-internal] request received");

  let mode;
  try {
    mode = resolveTpecBackendMode(env);
    console.info(`[whatsapp-internal] backend_mode=${mode}`);
  } catch (error) {
    console.error(`[whatsapp-internal] invalid backend mode ${errorDetails(error)}`);
    return json({ error: "invalid_backend_mode" }, 500);
  }
  if (mode !== "local") {
    console.error("[whatsapp-internal] rejected because backend is not local");
    return json({ error: "not_found" }, 404);
  }

  const expected = env.TPEC_PROXY_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-tpec-proxy-secret")?.trim() ?? "";
  const hop = request.headers.get("x-tpec-proxy-hop") ?? "";
  const proxyAuthorized = expected.length >= 32 && Boolean(provided) && safeEqual(expected, provided);
  console.info(
    `[whatsapp-internal] proxy_secret_configured=${expected.length >= 32} proxy_authorized=${proxyAuthorized} proxy_hop=${hop || "missing"}`,
  );
  if (!proxyAuthorized) return json({ error: "unauthorized" }, 401);
  if (hop !== "1") return json({ error: "invalid_proxy_hop" }, 400);

  let value: unknown;
  try {
    value = JSON.parse(await readLimitedBody(request));
  } catch (error) {
    console.error(`[whatsapp-internal] invalid request body ${errorDetails(error)}`);
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = WhatsAppChatInputSchema.safeParse(value);
  if (!parsed.success) {
    console.error("[whatsapp-internal] invalid WhatsApp chat input");
    return json({ error: "invalid_request" }, 400);
  }

  try {
    console.info(`[whatsapp-internal] processing text_chars=${Array.from(parsed.data.text).length}`);
    const started = Date.now();
    const processLocal =
      dependencies.processLocal ?? (await import("./conversation.server.ts")).processWhatsAppChat;
    const result = await processLocal(parsed.data);
    console.info(
      `[whatsapp-internal] completed duration_ms=${Date.now() - started} should_send=${result.shouldSend} has_reply=${Boolean(result.reply)}`,
    );
    return json(result, 200);
  } catch (error) {
    console.error(`[whatsapp-internal] chat processing failed ${errorDetails(error)}`);
    return json({ error: "whatsapp_chat_failed" }, 500);
  }
}
