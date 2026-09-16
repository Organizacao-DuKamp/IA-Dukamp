import { timingSafeEqual } from "node:crypto";

import { recoverStaleWhatsAppMessages } from "../../src/lib/whatsapp/recovery.server.ts";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const expected = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-tpec-recovery-secret")?.trim() ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const summary = await recoverStaleWhatsAppMessages();
  console.info(
    `[whatsapp-recovery] finished claimed=${summary.claimed} recovered=${summary.recovered} deferred=${summary.deferred} invalid=${summary.invalid} failed=${summary.failed}`,
  );
  return Response.json(summary);
};

export const config = { background: true };
