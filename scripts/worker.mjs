import { setTimeout as delay } from "node:timers/promises";
import { assertConfiguration } from "../src/lib/runtime/config.server.ts";
import { JOB_KINDS, jobQueue } from "../src/lib/runtime/queue.server.ts";

assertConfiguration();
const base = new URL(process.env.TPEC_INTERNAL_ORIGIN || "http://127.0.0.1:3000");
// Dedicated private origin; never derive worker URLs from webhook/Host headers.
if (base.username || base.password || !["http:", "https:"].includes(base.protocol))
  throw Error("invalid_internal_origin");
const queue = jobQueue();
const stopping = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    console.info(JSON.stringify({ event: "worker_draining", signal }));
    stopping.abort();
  });
let healthy = false;
async function checkServer() {
  try {
    const r = await fetch(new URL("/api/internal/jobs", base), {
      headers: { authorization: `Bearer ${process.env.TPEC_WORKER_TOKEN}` },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    healthy = r.ok;
    if (healthy) queue.heartbeat();
  } catch {
    healthy = false;
  }
}
async function lane(kind) {
  while (!stopping.signal.aborted) {
    if (healthy) {
      const job = queue.claim(kind);
      if (job) {
        const renew = setInterval(() => {
          queue.renew(job);
        }, 30_000);
        try {
          const response = await fetch(new URL("/api/internal/jobs", base), {
            method: "POST",
            redirect: "error",
            headers: {
              authorization: `Bearer ${process.env.TPEC_WORKER_TOKEN}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ id: job.id, token: job.token }),
            signal: AbortSignal.timeout(25 * 60_000),
          });
          if (!response.ok)
            console.error(
              JSON.stringify({
                event: "worker_dispatch_rejected",
                kind,
                id: job.id,
                status: response.status,
              }),
            );
        } catch {
          // Unknown execution state: keep lease, do not enqueue a concurrent retry.
          console.error(JSON.stringify({ event: "worker_dispatch_uncertain", kind, id: job.id }));
        } finally {
          clearInterval(renew);
        }
        continue;
      }
    }
    await delay(1000, undefined, { signal: stopping.signal }).catch(() => {});
  }
}
async function scheduler() {
  while (!stopping.signal.aborted) {
    await checkServer();
    queue.schedule();
    queue.prune();
    await delay(5000, undefined, { signal: stopping.signal }).catch(() => {});
  }
}
console.info(JSON.stringify({ event: "worker_started", lanes: JOB_KINDS }));
try {
  await Promise.all([scheduler(), ...JOB_KINDS.map(lane)]);
} finally {
  queue.close();
}
