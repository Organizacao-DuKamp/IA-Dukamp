import { timingSafeEqual } from "node:crypto";
import { runAppPushMaintenance } from "../../src/lib/guardian/app-devices.server.ts";
export default async (request: Request) => {
  const expected = Buffer.from(process.env.WHATSAPP_APP_SECRET?.trim() ?? "");
  const provided = Buffer.from(request.headers.get("x-tpec-app-push-secret") ?? "");
  if (
    request.method !== "POST" ||
    !expected.length ||
    provided.length !== expected.length ||
    !timingSafeEqual(expected, provided)
  )
    return new Response("Unauthorized", { status: 401 });
  await runAppPushMaintenance();
  return new Response("Done");
};
export const config = { background: true };
