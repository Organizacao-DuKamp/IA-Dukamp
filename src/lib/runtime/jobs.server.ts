import { timingSafeEqual } from "node:crypto";
import { jobQueue, type Job } from "./queue.server.ts";

function maintenanceSummary(kind: string, value: unknown) {
  // Summaries contain counters/booleans, never contact details or provider bodies.
  const counters = (v: unknown): unknown => {
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (v && typeof v === "object" && !Array.isArray(v))
      return Object.fromEntries(
        Object.entries(v)
          .map(([k, child]) => [k, counters(child)])
          .filter(([, child]) => child !== undefined),
      );
    return undefined;
  };
  console.info(JSON.stringify({ event: "maintenance_summary", kind, counters: counters(value) }));
}

export function workerAuthorized(request: Request, expected = process.env.TPEC_WORKER_TOKEN ?? "") {
  const provided = request.headers.get("authorization") ?? "";
  const wanted = `Bearer ${expected}`;
  return (
    expected.length >= 32 &&
    Buffer.byteLength(provided) === Buffer.byteLength(wanted) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(wanted))
  );
}

export async function executeJob(job: Job) {
  switch (job.kind) {
    case "whatsapp": {
      const { body, signature } = JSON.parse(job.payload) as { body: string; signature: string };
      const { handleEnhancedWhatsAppWebhookRequest } =
        await import("../whatsapp/enhanced-http.server.ts");
      const response = await handleEnhancedWhatsAppWebhookRequest(
        new Request(`${process.env.PUBLIC_ORIGIN}/api/public/whatsapp`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-hub-signature-256": signature },
          body,
        }),
        { durableQueue: true },
      );
      if (!response.ok) throw new Error("webhook_processing_failed");
      return;
    }
    case "recovery": {
      // Import failures must not prevent message recovery, and must be retried.
      const results = await Promise.allSettled([
        (async () => {
          if (process.env.TPEC_GUARDIAN_ENABLED === "true")
            maintenanceSummary(
              "imports",
              await (await import("../guardian/import-worker.server.ts")).runAnimalImports(),
            );
        })(),
        (async () =>
          (await import("../whatsapp/recovery.server.ts")).recoverStaleWhatsAppMessages())(),
      ]);
      if (results.some((r) => r.status === "rejected")) throw new Error("recovery_failed");
      for (const result of results)
        if (result.status === "fulfilled") maintenanceSummary("recovery", result.value);
      return;
    }
    case "followup":
      maintenanceSummary(
        "followup",
        await (await import("../whatsapp/proactive.server.ts")).runWhatsAppFollowupMaintenance(),
      );
      return;
    case "push": {
      const { appPushConfigured } = await import("../guardian/app-fcm.server.ts");
      if (appPushConfigured())
        maintenanceSummary(
          "push",
          await (await import("../guardian/app-devices.server.ts")).runAppPushMaintenance(),
        );
      return;
    }
  }
}

// A duplicate local HTTP request must join the execution, never start it twice.
const active = new Map<string, Promise<Response>>();
export async function handleWorkerRequest(request: Request): Promise<Response> {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "cache-control": "no-store" } });
  if (!workerAuthorized(request)) return reply({ error: "not_found" }, 404);
  if (request.method === "GET") return reply(jobQueue().stats());
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  // IDs/lease only; bodies and arbitrary actions can never be supplied over HTTP.
  const reader = request.body?.getReader();
  let raw = "";
  let size = 0;
  if (!reader) return reply({ error: "invalid_job" }, 400);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) {
      await reader.cancel();
      return reply({ error: "too_large" }, 413);
    }
    raw += new TextDecoder().decode(value);
  }
  let input: { id?: string; token?: string };
  try {
    input = JSON.parse(raw);
  } catch {
    return reply({ error: "invalid_job" }, 400);
  }
  if (typeof input?.id !== "string" || typeof input?.token !== "string")
    return reply({ error: "invalid_job" }, 400);
  const queue = jobQueue();
  const job = queue.owned(input.id, input.token);
  if (!job) return reply({ error: "lease_lost" }, 409);
  const key = `${job.id}:${job.token}`;
  const existing = active.get(key);
  if (existing) return (await existing).clone();
  const execution = (async () => {
    const started = Date.now();
    try {
      await executeJob(job);
      if (!queue.finish(job)) return reply({ error: "lease_lost" }, 409);
      console.info(
        JSON.stringify({
          event: "job_done",
          kind: job.kind,
          id: job.id,
          duration_ms: Date.now() - started,
        }),
      );
      return reply({ ok: true });
    } catch {
      queue.fail(job);
      console.error(
        JSON.stringify({ event: "job_failed", kind: job.kind, id: job.id, attempt: job.attempts }),
      );
      return reply({ error: "job_failed" }, 503);
    } finally {
      active.delete(key);
    }
  })();
  active.set(key, execution);
  return (await execution).clone();
}
