import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveTpecBackendMode } from "../chat/backend.server.ts";
import { dispatchWhatsAppChat } from "./backend.server.ts";
import { handleWhatsAppWebhookRequest } from "./http.server.ts";
import {
  buildWhatsAppProgressPlan,
  friendlyWhatsAppError,
  humanizeWhatsAppReply,
} from "./presence.ts";
import { WhatsAppChatInputSchema, type WhatsAppChatInput, type WhatsAppChatResult } from "./types.ts";

type EnvLike = Record<string, string | undefined>;

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const MAX_OUTBOUND_CHARS = 3500;

export interface EnhancedWhatsAppHttpDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  dispatchChat?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
}

interface IncomingTextMessage {
  phoneNumberId: string;
  phone: string;
  messageId: string;
  text: string;
}

function envOf(deps: EnhancedWhatsAppHttpDependencies): EnvLike {
  return deps.env ?? process.env;
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
        if (parsed.success) messages.push({ phoneNumberId, ...parsed.data });
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
    if (!response.ok) throw new Error(`whatsapp_send_failed:${response.status}`);
  }
}

async function trySendWhatsAppText(
  to: string,
  body: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
  label: string,
): Promise<boolean> {
  try {
    await sendWhatsAppText(to, body, env, fetchImpl);
    console.info(`[whatsapp] ${label} sent`);
    return true;
  } catch (error) {
    console.error(`[whatsapp] ${label} send failed ${errorDetails(error)}`);
    return false;
  }
}

export async function handleEnhancedWhatsAppWebhookRequest(
  request: Request,
  dependencies: EnhancedWhatsAppHttpDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return handleWhatsAppWebhookRequest(request, {
      env: dependencies.env,
      fetchImpl: dependencies.fetchImpl,
      dispatchChat: dependencies.dispatchChat,
    });
  }

  const env = envOf(dependencies);
  let rawBody: string;
  try {
    rawBody = await readLimitedBody(request);
  } catch (error) {
    console.error(`[whatsapp] enhanced body rejected ${errorDetails(error)}`);
    return new Response("Payload Too Large", { status: 413 });
  }

  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) return json({ error: "whatsapp_not_configured" }, 503);
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const configuredPhoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const extracted = extractTextMessages(payload);
  const incoming = extracted.filter(
    (message) => !configuredPhoneNumberId || message.phoneNumberId === configuredPhoneNumberId,
  );
  if (incoming.length === 0) return json({ received: true });

  try {
    resolveTpecBackendMode(env);
  } catch (error) {
    console.error(`[whatsapp] enhanced backend mode error ${errorDetails(error)}`);
    return json({ error: "whatsapp_processing_failed" }, 500);
  }

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const dispatch =
    dependencies.dispatchChat ??
    ((input: WhatsAppChatInput) =>
      dispatchWhatsAppChat(input, { env, fetchImpl: dependencies.fetchImpl }));
  const setTimer = dependencies.setTimeoutImpl ?? setTimeout;
  const clearTimer = dependencies.clearTimeoutImpl ?? clearTimeout;

  for (const message of incoming) {
    const progressPlan = buildWhatsAppProgressPlan(message.text);
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    if (progressPlan[0]?.delayMs === 0) {
      await trySendWhatsAppText(
        message.phone,
        progressPlan[0].text,
        env,
        fetchImpl,
        "progress.immediate",
      );
    }

    for (const progress of progressPlan.slice(1)) {
      const timer = setTimer(() => {
        void trySendWhatsAppText(
          message.phone,
          progress.text,
          env,
          fetchImpl,
          `progress.${progress.delayMs}`,
        );
      }, progress.delayMs);
      timers.push(timer);
    }

    try {
      const started = Date.now();
      const result = await dispatch({
        phone: message.phone,
        messageId: message.messageId,
        text: message.text,
      });
      console.info(
        `[whatsapp] enhanced dispatch completed duration_ms=${Date.now() - started} should_send=${result.shouldSend} duplicate=${result.duplicate}`,
      );

      if (result.shouldSend && result.reply) {
        const reply = humanizeWhatsAppReply(message.text, result.reply);
        await sendWhatsAppText(message.phone, reply, env, fetchImpl);
      }
    } catch (error) {
      console.error(`[whatsapp] enhanced dispatch failed ${errorDetails(error)}`);
      const failureSent = await trySendWhatsAppText(
        message.phone,
        friendlyWhatsAppError(error),
        env,
        fetchImpl,
        "failure.notice",
      );
      if (!failureSent) return json({ error: "whatsapp_processing_failed" }, 500);
    } finally {
      for (const timer of timers) clearTimer(timer);
    }
  }

  return json({ received: true });
}
