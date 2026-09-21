export default async (request: Request): Promise<Response> => {
  if (process.env.WHATSAPP_PROACTIVE_ENABLED?.trim().toLowerCase() !== "true") {
    return new Response("Disabled", { status: 200 });
  }

  const secret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  if (!secret) {
    console.error("[whatsapp-followup] scheduler missing secret");
    return new Response("Follow-up not configured", { status: 503 });
  }

  const backgroundUrl = new URL(
    "/.netlify/functions/whatsapp-followup-background",
    request.url,
  );

  try {
    const response = await fetch(backgroundUrl, {
      method: "POST",
      headers: { "x-tpec-followup-secret": secret },
      signal: AbortSignal.timeout(5_000),
    });
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
  schedule: "* * * * *",
};
