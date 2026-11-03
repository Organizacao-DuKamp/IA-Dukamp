import { appPushConfigured } from "../../src/lib/guardian/app-fcm.server.ts";
export default async (request: Request) => {
  if (!appPushConfigured()) return Response.json({ configured: false });
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret) return new Response("Not configured", { status: 503 });
  try {
    const queued = await fetch(
      new URL("/.netlify/functions/guardian-app-reminders-background", request.url),
      {
        method: "POST",
        headers: { "x-tpec-app-push-secret": secret },
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      },
    );
    return new Response(queued.status === 202 ? "Queued" : "Queue unavailable", {
      status: queued.status === 202 ? 202 : 503,
    });
  } catch {
    return new Response("Queue unavailable", { status: 503 });
  }
};
export const config = { schedule: "* * * * *" };
