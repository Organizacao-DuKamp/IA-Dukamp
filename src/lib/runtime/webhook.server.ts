import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { jobQueue, type JobQueue } from "./queue.server.ts";

export async function enqueueWhatsAppWebhook(
  request: Request,
  deps: { secret?: string; queue?: Pick<JobQueue, "enqueue"> } = {},
) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "cache-control": "no-store" } });
  const secret = deps.secret ?? process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return json({ error: "whatsapp_not_configured" }, 503);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "invalid_body" }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 240 * 1024) {
        await reader.cancel();
        return json({ error: "payload_too_large" }, 413);
      }
      chunks.push(value);
    }
  } catch {
    return json({ error: "invalid_body" }, 400);
  }
  const bytes = Buffer.concat(chunks);
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(bytes).digest("hex")}`;
  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return json({ error: "invalid_whatsapp_signature" }, 401);
  const body = bytes.toString("utf8");
  try {
    JSON.parse(body);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  try {
    // HMAC was checked BEFORE persistence. Store only the signed envelope, never the secret.
    (deps.queue ?? jobQueue()).enqueue(
      "whatsapp",
      `wa:${createHash("sha256").update(bytes).digest("hex")}`,
      JSON.stringify({ body, signature }),
    );
    return json({ received: true, queued: true });
  } catch {
    console.error(JSON.stringify({ event: "queue_enqueue_failed" }));
    // No durable commit means no acknowledgement: Meta must retry.
    return json({ error: "whatsapp_queue_unavailable" }, 503);
  }
}
