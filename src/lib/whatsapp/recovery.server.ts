import { askOpenAI } from "../chat/openai.server.ts";
import { dispatchClaimedWhatsAppChat } from "./backend.server.ts";
import {
  claimStaleWhatsAppMessages,
  claimWhatsAppDelivery,
  completeWhatsAppMessage,
  markWhatsAppMessageDelivered,
  markWhatsAppRetryError,
  releaseWhatsAppDelivery,
  type StaleWhatsAppMessage,
} from "./store.server.ts";
import { WhatsAppChatInputSchema, type WhatsAppChatInput } from "./types.ts";

const MAX_RECOVERY_BATCH = 5;
const MAX_AUTOMATIC_RETRIES = 3;
const STALE_AFTER_SECONDS = 105;
const EMERGENCY_TIMEOUT_MS = 12_000;
const MAX_OUTBOUND_CHARS = 3500;
const OUTBOUND_CHUNK_BODY_CHARS = 3450;

type EnvLike = Record<string, string | undefined>;

function envValue(env: EnvLike, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`missing_${key.toLowerCase()}`);
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}:${error.message}` : "unknown_error";
}

function splitOutboundText(value: string): string[] {
  const normalized = value.trim();
  if (!normalized) return [];
  const chars = Array.from(normalized);
  if (chars.length <= MAX_OUTBOUND_CHARS) return [normalized];
  const rawChunks: string[] = [];
  for (let index = 0; index < chars.length; index += OUTBOUND_CHUNK_BODY_CHARS) {
    rawChunks.push(chars.slice(index, index + OUTBOUND_CHUNK_BODY_CHARS).join(""));
  }
  return rawChunks.map((chunk, index) => `(${index + 1}/${rawChunks.length}) ${chunk}`);
}

async function sendWhatsAppText(
  to: string,
  body: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<void> {
  const accessToken = envValue(env, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = envValue(env, "WHATSAPP_PHONE_NUMBER_ID");
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
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`whatsapp_recovery_send_failed:${response.status}`);
  }
}

async function deliverRecoveredReply(
  input: WhatsAppChatInput,
  fallbackReply: string,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<void> {
  let delivery = await claimWhatsAppDelivery(input.messageId);
  if (delivery.kind === "missing") {
    await completeWhatsAppMessage(input.messageId, fallbackReply);
    delivery = await claimWhatsAppDelivery(input.messageId);
  }
  if (delivery.kind === "delivered" || delivery.kind === "processing") return;
  if (delivery.kind !== "claimed") throw new Error("whatsapp_recovery_delivery_not_ready");

  try {
    await sendWhatsAppText(input.phone, delivery.reply, env, fetchImpl);
  } catch (error) {
    await releaseWhatsAppDelivery(input.messageId, delivery.reply).catch(() => undefined);
    throw error;
  }
  await markWhatsAppMessageDelivered(input.messageId, delivery.reply);
}

async function emergencyAnswer(input: WhatsAppChatInput): Promise<string> {
  try {
    return await askOpenAI(
      [{ role: "user", content: input.text }],
      {
        model: "luna",
        channel: "whatsapp",
        timeoutMs: EMERGENCY_TIMEOUT_MS,
        researchDepth: "none",
        maxToolCalls: 0,
        stage: "whatsapp_durable_rescue",
        directive:
          "MODO DE EMERGÊNCIA DO WHATSAPP: responda diretamente à pergunta do usuário em português, de forma útil e curta. Não use internet, não mencione falhas técnicas nem modelos. Se a pergunta depender de informação atual que você não consegue verificar, diga claramente essa limitação, mas ainda responda a parte estável que puder.",
      },
    );
  } catch {
    return "Tive uma instabilidade para processar sua pergunta completa. Sua mensagem não foi ignorada. Por favor, envie a mesma pergunta novamente e eu vou tentar por uma rota alternativa.";
  }
}

async function recoverOne(
  row: StaleWhatsAppMessage,
  env: EnvLike,
  fetchImpl: typeof fetch,
): Promise<"recovered" | "deferred" | "invalid"> {
  const parsed = WhatsAppChatInputSchema.safeParse(row.requestPayload);
  if (
    !parsed.success ||
    parsed.data.messageId !== row.messageId ||
    parsed.data.phone !== row.phoneNumber
  ) {
    await markWhatsAppRetryError(row.messageId, "invalid_or_mismatched_request_payload").catch(
      () => undefined,
    );
    return "invalid";
  }

  const input = parsed.data;
  try {
    const result = await dispatchClaimedWhatsAppChat(input, { env, fetchImpl });
    const reply = result.reply?.trim();
    if (!result.shouldSend || !reply) throw new Error("whatsapp_recovery_empty_reply");
    await deliverRecoveredReply(input, reply, env, fetchImpl);
    return "recovered";
  } catch (error) {
    const details = errorMessage(error);
    await markWhatsAppRetryError(row.messageId, details).catch(() => undefined);
    console.error(
      `[whatsapp-recovery] attempt failed message_id=${row.messageId} retry=${row.retryCount}/${MAX_AUTOMATIC_RETRIES} ${details}`,
    );

    if (row.retryCount < MAX_AUTOMATIC_RETRIES) return "deferred";

    // Última barreira contra silêncio: pula RAG, roteamento e demais etapas e
    // tenta uma resposta curta diretamente no modelo econômico da OpenAI.
    const fallbackReply = await emergencyAnswer(input);
    try {
      await completeWhatsAppMessage(input.messageId, fallbackReply);
      await deliverRecoveredReply(input, fallbackReply, env, fetchImpl);
      return "recovered";
    } catch (fallbackError) {
      await markWhatsAppRetryError(
        row.messageId,
        `final_delivery_failed:${errorMessage(fallbackError)}`,
      ).catch(() => undefined);
      throw fallbackError;
    }
  }
}

export interface WhatsAppRecoverySummary {
  claimed: number;
  recovered: number;
  deferred: number;
  invalid: number;
  failed: number;
}

export async function recoverStaleWhatsAppMessages(
  dependencies: { env?: EnvLike; fetchImpl?: typeof fetch } = {},
): Promise<WhatsAppRecoverySummary> {
  const env = dependencies.env ?? process.env;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const rows = await claimStaleWhatsAppMessages(
    MAX_RECOVERY_BATCH,
    STALE_AFTER_SECONDS,
    MAX_AUTOMATIC_RETRIES,
  );
  const summary: WhatsAppRecoverySummary = {
    claimed: rows.length,
    recovered: 0,
    deferred: 0,
    invalid: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const result = await recoverOne(row, env, fetchImpl);
      summary[result] += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `[whatsapp-recovery] unrecoverable message_id=${row.messageId} ${errorMessage(error)}`,
      );
    }
  }

  return summary;
}
