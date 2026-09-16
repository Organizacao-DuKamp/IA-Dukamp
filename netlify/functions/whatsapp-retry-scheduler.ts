export default async (): Promise<Response> => {
  const baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const secret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!baseUrl || !secret) {
    console.error("[whatsapp-recovery] scheduler missing URL or secret");
    return new Response("Recovery not configured", { status: 503 });
  }

  try {
    const response = await fetch(`${baseUrl}/.netlify/functions/whatsapp-retry-background`, {
      method: "POST",
      headers: { "x-tpec-recovery-secret": secret },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok && response.status !== 202) {
      throw new Error(`recovery_enqueue_failed:${response.status}`);
    }
    console.info(`[whatsapp-recovery] worker queued status=${response.status}`);
    return new Response("Queued", { status: 202 });
  } catch (error) {
    console.error(
      `[whatsapp-recovery] scheduler failed ${error instanceof Error ? error.message : "unknown_error"}`,
    );
    return new Response("Queue failed", { status: 500 });
  }
};

export const config = {
  schedule: "* * * * *",
};
