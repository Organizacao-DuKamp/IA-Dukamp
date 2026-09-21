import { timingSafeEqual } from "node:crypto";
import { runWhatsAppFollowupMaintenance } from "../../src/lib/whatsapp/proactive.server.ts";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const expected = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-tpec-followup-secret")?.trim() ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const summary = await runWhatsAppFollowupMaintenance();
  console.info("[whatsapp-followup] maintenance completed", summary);
  return Response.json(summary);
};

export const config = { background: true };
