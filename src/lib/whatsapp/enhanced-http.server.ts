import { createHmac, timingSafeEqual } from "node:crypto";

import { controlWhatsAppMessage, dispatchClaimedWhatsAppChat } from "./backend.server.ts";
import { splitWhatsAppOutboundText } from "./format.ts";
import {
  buildWhatsAppProgressPlan,
  emptyWhatsAppReply,
  friendlyWhatsAppError,
  resolveWithWhatsAppProgress,
} from "./presence.ts";
import {
  WhatsAppChatInputSchema,
  type WhatsAppChatInput,
  type WhatsAppChatResult,
  type WhatsAppControlRequest,
  type WhatsAppControlResult,
} from "./types.ts";

type EnvLike = Record<string, string | undefined>;

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const DELIVERY_CONFIRM_ATTEMPTS = 3;
const DELIVERY_CONFIRM_RETRY_MS = 120;

export interface EnhancedWhatsAppHttpDependencies {
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  dispatchChat?: (input: WhatsAppChatInput) => Promise<WhatsAppChatResult>;
  controlMessage?: (request: WhatsAppControlRequest) => Promise<WhatsAppControlResult>;
  sleepImpl?: (ms: number) => Promise<void>;
}

type IncomingWhatsAppMessage = WhatsAppChatInput & { phoneNumberId: string };

const MEDIA_DEFAULT_TEXT: Record<"audio" | "image" | "video" | "document", string> = {
  audio: "Analise e responda ao áudio que enviei.",
  image: "Analise e responda à imagem que enviei.",
  video: "Analise e responda ao vídeo que enviei.",
  document: "Analise e responda ao documento que enviei.",
};

function envOf(deps: EnhancedWhatsAppHttpDependencies): EnvLike {
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

function extractIncomingMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const root = asRecord(payload);
  if (!root || root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];

  const messages: IncomingWhatsAppMessage[] = [];
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
        if (!message || typeof message.from !== "string" || typeof message.id !== "string")
          continue;

        const messageType = message.type;
        let textValue = "";
        let media: WhatsAppChatInput["media"];
        if (messageType === "text") {
          const textObject = asRecord(message.text);
          if (typeof textObject?.body !== "string") continue;
          textValue = textObject.body;
        } else if (
          messageType === "audio" ||
          messageType === "image" ||
          messageType === "video" ||
          messageType === "document"
        ) {
          const mediaObject = asRecord(message[messageType]);
          if (!mediaObject || typeof mediaObject.id !== "string") continue;
          const caption =
            typeof mediaObject.caption === "string" ? mediaObject.caption.trim() : undefined;
          textValue = caption || MEDIA_DEFAULT_TEXT[messageType];
          media = {
            id: mediaObject.id,
            type: messageType,
            mimeType:
              typeof mediaObject.mime_type === "string"
                ? mediaObject.mime_type
                : "application/octet-stream",
            ...(typeof mediaObject.sha256 === "string" ? { sha256: mediaObject.sha256 } : {}),
            ...(typeof mediaObject.filename === "string" ? { filename: mediaObject.filename } : {}),
            ...(caption ? { caption } : {}),
          };
        } else {
          continue;
        }

        const parsed = WhatsAppChatInputSchema.safeParse({
          phone: message.from,
          messageId: message.id,
          text: textValue,
          ...(media ? { media } : {}),
        });
        if (parsed.success) messages.push({ phoneNumberId, ...parsed.data });
      }
    }
  }
  return messages;
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

  for (const chunk of splitWhatsAppOutboundText(body)) {
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

async function sendWhatsAppTypingIndicator(
  messageId: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<void> {
  const accessToken = requireEnv(env, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv(env, "WHATSAPP_PHONE_NUMBER_ID");
  const version = (env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0").replace(/^\/+|\/+$/g, "");
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("invalid_whatsapp_graph_api_version");

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
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (!response.ok) throw new Error(`whatsapp_typing_indicator_failed:${response.status}`);
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

async function trySendWhatsAppTypingIndicator(
  messageId: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    await sendWhatsAppTypingIndicator(messageId, env, fetchImpl);
    console.info("[whatsapp] typing.indicator sent");
    return true;
  } catch (error) {
    // Presença é opcional: nunca atrase nem substitua a resposta final por ela.
    console.error(`[whatsapp] typing.indicator send failed ${errorDetails(error)}`);
    return false;
  }
}

async function confirmWhatsAppDelivery(
  messageId: string,
  reply: string,
  control: (request: WhatsAppControlRequest) => Promise<WhatsAppControlResult>,
  sleepImpl: (ms: number) => Promise<void>,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DELIVERY_CONFIRM_ATTEMPTS; attempt += 1) {
    try {
      await control({ action: "delivered", messageId, reply });
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `[whatsapp] delivered_at confirmation failed attempt=${attempt}/${DELIVERY_CONFIRM_ATTEMPTS} ${errorDetails(error)}`,
      );
      if (attempt < DELIVERY_CONFIRM_ATTEMPTS) await sleepImpl(DELIVERY_CONFIRM_RETRY_MS);
    }
  }

  // A Graph API já aceitou a mensagem. Não libere o lease aqui: fazer isso
  // tornaria uma resposta possivelmente entregue imediatamente elegível para
  // reenvio por outro webhook, criando duplicatas para o usuário.
  throw lastError instanceof Error ? lastError : new Error("whatsapp_delivery_confirmation_failed");
}

async function deliverPendingReply(
  message: IncomingWhatsAppMessage,
  fallbackReply: string | undefined,
  control: (request: WhatsAppControlRequest) => Promise<WhatsAppControlResult>,
  env: EnvLike,
  fetchImpl: typeof fetch,
  sleepImpl: (ms: number) => Promise<void>,
): Promise<void> {
  let delivery = await control({ action: "claim_delivery", messageId: message.messageId });

  if (delivery.kind === "missing" && fallbackReply?.trim()) {
    await control({
      action: "complete",
      messageId: message.messageId,
      reply: fallbackReply.trim(),
    });
    delivery = await control({ action: "claim_delivery", messageId: message.messageId });
  }

  if (delivery.kind === "processing" || delivery.kind === "delivered") return;
  if (delivery.kind !== "claimed" || !delivery.reply) {
    throw new Error("whatsapp_delivery_not_ready");
  }

  // Falha ANTES da Graph API aceitar a mensagem: é seguro liberar o lease e
  // permitir nova tentativa da mesma resposta pronta.
  try {
    await sendWhatsAppText(message.phone, delivery.reply, env, fetchImpl);
  } catch (error) {
    try {
      await control({
        action: "release_delivery",
        messageId: message.messageId,
        reply: delivery.reply,
      });
    } catch (releaseError) {
      console.error(`[whatsapp] failed to release delivery lease ${errorDetails(releaseError)}`);
    }
    throw error;
  }

  // Depois de a Graph API aceitar a mensagem, nunca volte o registro para
  // "completed" só porque a confirmação no banco falhou. Isso evita reenvio.
  await confirmWhatsAppDelivery(message.messageId, delivery.reply, control, sleepImpl);
}

export async function handleEnhancedWhatsAppWebhookRequest(
  request: Request,
  dependencies: EnhancedWhatsAppHttpDependencies = {},
): Promise<Response> {
  const env = envOf(dependencies);
  const sleepImpl =
    dependencies.sleepImpl ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") ?? "";
    const provided = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    const expected = env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
    if (
      mode === "subscribe" &&
      expected &&
      provided &&
      safeEqual(expected, provided) &&
      challenge
    ) {
      return text(challenge, 200);
    }
    return text("Forbidden", 403);
  }

  if (request.method !== "POST") return text("Method Not Allowed", 405);

  let rawBody: string;
  try {
    rawBody = await readLimitedBody(request);
  } catch (error) {
    console.error(`[whatsapp] body rejected ${errorDetails(error)}`);
    return text("Payload Too Large", 413);
  }

  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!appSecret) return json({ error: "whatsapp_not_configured" }, 503);
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
  const incoming = extractIncomingMessages(payload).filter(
    (message) => !configuredPhoneNumberId || message.phoneNumberId === configuredPhoneNumberId,
  );
  if (incoming.length === 0) return json({ received: true });

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const control =
    dependencies.controlMessage ??
    ((controlRequest: WhatsAppControlRequest) =>
      controlWhatsAppMessage(controlRequest, { env, fetchImpl: dependencies.fetchImpl }));
  const dispatch =
    dependencies.dispatchChat ??
    ((input: WhatsAppChatInput) =>
      dispatchClaimedWhatsAppChat(input, { env, fetchImpl: dependencies.fetchImpl }));

  for (const message of incoming) {
    let claim: WhatsAppControlResult;
    try {
      claim = await control({
        action: "claim",
        phone: message.phone,
        messageId: message.messageId,
      });
    } catch (error) {
      console.error(`[whatsapp] durable claim failed ${errorDetails(error)}`);
      await trySendWhatsAppText(
        message.phone,
        friendlyWhatsAppError(error),
        env,
        fetchImpl,
        "claim.failure.notice",
      );
      continue;
    }

    if (claim.kind === "processing" || claim.kind === "delivered") {
      console.info(
        `[whatsapp] duplicate ignored message_id=${message.messageId} state=${claim.kind}`,
      );
      continue;
    }
    if (claim.kind === "completed") {
      try {
        await deliverPendingReply(message, claim.reply, control, env, fetchImpl, sleepImpl);
      } catch (error) {
        console.error(`[whatsapp] pending delivery failed ${errorDetails(error)}`);
      }
      continue;
    }
    if (claim.kind !== "claimed") continue;

    const started = Date.now();
    let result: WhatsAppChatResult;
    try {
      const task = dispatch({
        phone: message.phone,
        messageId: message.messageId,
        text: message.text,
        ...(message.media ? { media: message.media } : {}),
      });
      const progressText = message.media ? `${message.media.type}: ${message.text}` : message.text;
      result = await resolveWithWhatsAppProgress(
        task,
        buildWhatsAppProgressPlan(progressText, message.messageId),
        async () => {
          // Reserva uma única presença por messageId. Isso elimina avisos
          // repetidos mesmo quando a Meta repete o webhook em outra instância.
          try {
            const current = await control({
              action: "claim_presence",
              messageId: message.messageId,
            });
            if (current.kind !== "claimed") {
              console.info(
                `[whatsapp] duplicate/stale presence suppressed message_id=${message.messageId} state=${current.kind}`,
              );
              return;
            }
          } catch (error) {
            // Falhar ao conferir presença não pode derrubar a resposta principal.
            console.error(`[whatsapp] progress state check failed ${errorDetails(error)}`);
            return;
          }
          // O indicador nativo desaparece quando a resposta chega e não deixa
          // mensagens de "estou processando" acumuladas no histórico do chat.
          await trySendWhatsAppTypingIndicator(message.messageId, env, fetchImpl);
        },
        sleepImpl,
      );
      console.info(
        `[whatsapp] claimed processing completed duration_ms=${Date.now() - started} has_reply=${Boolean(result.reply)}`,
      );
    } catch (error) {
      console.error(
        `[whatsapp] claimed processing failed duration_ms=${Date.now() - started} ${errorDetails(error)}`,
      );
      const failure = friendlyWhatsAppError(error);
      try {
        await control({ action: "complete", messageId: message.messageId, reply: failure });
        await deliverPendingReply(message, failure, control, env, fetchImpl, sleepImpl);
      } catch (deliveryError) {
        console.error(`[whatsapp] failure delivery failed ${errorDetails(deliveryError)}`);
      }
      continue;
    }

    if (!result.shouldSend) {
      console.info(`[whatsapp] final delivery suppressed message_id=${message.messageId}`);
      continue;
    }

    const finalReply = result.reply?.trim() || emptyWhatsAppReply();
    if (!result.reply?.trim()) {
      try {
        await control({ action: "complete", messageId: message.messageId, reply: finalReply });
      } catch (error) {
        console.error(`[whatsapp] empty reply persistence failed ${errorDetails(error)}`);
        continue;
      }
    }

    // Entrega é uma fase separada. Falha na própria Graph API libera o lease;
    // falha apenas ao confirmar delivered_at NÃO libera uma mensagem já aceita.
    try {
      await deliverPendingReply(message, finalReply, control, env, fetchImpl, sleepImpl);
    } catch (error) {
      console.error(`[whatsapp] final delivery failed ${errorDetails(error)}`);
    }
  }

  return json({ received: true });
}
