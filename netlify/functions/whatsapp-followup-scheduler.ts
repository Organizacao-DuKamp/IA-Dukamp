export default async (): Promise<Response> => {
  if (process.env.WHATSAPP_PROACTIVE_ENABLED?.trim().toLowerCase() !== "true") {
    return new Response("Disabled", { status: 200 });
  }

  const baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");
  const secret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!baseUrl || !secret) {
    console.error("[whatsapp-followup] scheduler missing URL or secret");
    return new Response("Follow-up not configured", { status: 503 });
  }

  try {
    const response = await fetch(
      baseUrl + "/.netlify/functions/whatsapp-followup-background",
      {
        method: "POST",
        headers: { "x-tpec-followup-secret": secret },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok && response.status !== 202) {
      throw new Error("followup_enqueue_failed:" + response.status);
    }
    return new Response("Queued", { status: 202 });
  } catch (error) {
    console.error(
      "[whatsapp-followup] scheduler failed " +
        (error instanceof Error ? error.message : "unknown_error"),
    );
    return new Response("Queue failed", { status: 500 });
  }
};

export const config = {
  schedule: "*/5 * * * *",
};
