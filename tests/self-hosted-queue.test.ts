import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { JobQueue, LEASE_MS } from "../src/lib/runtime/queue.server.ts";
import { configurationErrors } from "../src/lib/runtime/config.server.ts";
import { workerAuthorized } from "../src/lib/runtime/jobs.server.ts";
import { enqueueWhatsAppWebhook } from "../src/lib/runtime/webhook.server.ts";
import { createHmac } from "node:crypto";

function fixture(t: { after: (f: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), "tpec-queue-"));
  const queue = new JobQueue(directory);
  t.after(() => {
    queue.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, queue };
}

test("SQLite commits survive abrupt process death, deduplicate and use private permissions", (t) => {
  const { directory, queue } = fixture(t);
  const child = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    import { JobQueue } from ${JSON.stringify(new URL("../src/lib/runtime/queue.server.ts", import.meta.url).href)};
    const q = new JobQueue(process.argv[1]);
    q.enqueue('whatsapp','crash','{"body":"private fixture"}',1000);
    process.exit(0);
  `,
    directory,
  ]);
  assert.equal(child.status, 0, child.stderr?.toString());
  assert.equal(queue.enqueue("whatsapp", "crash", "different"), false);
  assert.match(queue.claim("whatsapp", 1000)!.payload, /private fixture/);
  if (process.platform !== "win32") {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(join(directory, "jobs.sqlite")).mode & 0o777, 0o600);
  }
});

test("concurrent connections serialize a lane; lease fencing prevents stale acknowledgements", (t) => {
  const { directory, queue: a } = fixture(t);
  const b = new JobQueue(directory);
  t.after(() => b.close());
  a.enqueue("whatsapp", "one", "sensitive", 1000);
  a.enqueue("whatsapp", "two", "second", 1001);
  const original = a.claim("whatsapp", 1001)!;
  assert.equal(b.claim("whatsapp", 1002), undefined);
  assert.equal(b.claim("whatsapp", 1001 + LEASE_MS - 1), undefined);
  const reclaimed = b.claim("whatsapp", 1001 + LEASE_MS)!;
  assert.equal(reclaimed.id, original.id);
  assert.notEqual(reclaimed.token, original.token);
  assert.equal(a.finish(original, 1001 + LEASE_MS), false);
  assert.equal(b.finish(reclaimed, 1002 + LEASE_MS), true);
  assert.equal(a.claim("whatsapp", 1003 + LEASE_MS)!.id, "two");
  assert.equal(a.stats().jobs.find((r) => r.status === "done")!.total, 1);
});

test("backoff, dead-letter, manual replay, retention and schedule coalescing are durable", (t) => {
  const { queue: q } = fixture(t);
  let now = 1000;
  q.enqueue("whatsapp", "bad", "private", now);
  for (let i = 0; i < 10; i++) {
    const job = q.claim("whatsapp", now)!;
    assert.ok(job);
    q.fail(job, "provider_failure", now);
    assert.equal(q.claim("whatsapp", now + 1), undefined);
    now += 300_001;
  }
  assert.equal(q.stats().jobs.find((r) => r.status === "dead")!.total, 1);
  assert.equal(q.replay("bad"), true);
  const restored = q.claim("whatsapp", Date.now())!;
  assert.equal(restored.attempts, 1);
  q.finish(restored);
  q.schedule(now);
  q.schedule(now + 60_000);
  for (const kind of ["recovery", "followup", "push"] as const) {
    const job = q.claim(kind, now + 60_000)!;
    assert.ok(job);
    assert.equal(q.claim(kind, now + 60_001), undefined);
    q.finish(job, now + 60_002);
  }
  q.schedule(now + 120_000);
  assert.ok(q.claim("push", now + 120_000));
  q.heartbeat(now);
  assert.equal(q.stats(now + 89_000).workerHealthy, true);
  assert.equal(q.stats(now + 90_000).workerHealthy, false);
  q.prune(Date.now() + 8 * 86400_000);
  assert.equal(
    q.stats().jobs.some((r) => r.status === "done"),
    false,
  );
});

test("only valid signed webhooks are persisted; failed commit returns 503 and duplicate ACK is safe", async (t) => {
  const { queue } = fixture(t);
  const secret = "test-secret",
    body = '{"object":"whatsapp_business_account","entry":[]}';
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const request = (data = body, sig = signature) =>
    new Request("https://attacker.invalid/api/public/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": sig },
      body: data,
    });
  assert.equal(
    (await enqueueWhatsAppWebhook(request(body, "wrong"), { secret, queue })).status,
    401,
  );
  assert.equal(queue.stats().jobs.length, 0);
  assert.equal((await enqueueWhatsAppWebhook(request(), { secret, queue })).status, 200);
  assert.equal((await enqueueWhatsAppWebhook(request(), { secret, queue })).status, 200);
  assert.equal(queue.stats().jobs[0].total, 1);
  assert.equal(
    (
      await enqueueWhatsAppWebhook(request(), {
        secret,
        queue: {
          enqueue() {
            throw Error("disk-full");
          },
        },
      })
    ).status,
    503,
  );
  assert.equal(
    (await enqueueWhatsAppWebhook(request("x".repeat(240 * 1024 + 1)), { secret, queue })).status,
    413,
  );
});

test("runtime configuration fails closed and worker route requires a dedicated constant-time token", () => {
  assert.ok(configurationErrors({}).includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(
    configurationErrors({ PUBLIC_ORIGIN: "http://www.tpecia.com.br" }).includes(
      "PUBLIC_ORIGIN:https_origin_required",
    ),
  );
  assert.ok(
    configurationErrors({ TPEC_FCM_PROJECT_ID: "project" }).includes("TPEC_FCM_PRIVATE_KEY"),
  );
  assert.ok(
    configurationErrors({ WHATSAPP_STATE_STORE: "memory" }).includes(
      "WHATSAPP_STATE_STORE:durable_required",
    ),
  );
  assert.ok(
    configurationErrors(
      {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test",
        VITE_SUPABASE_PROJECT_ID: "example",
      },
      true,
    ).includes("VITE_SUPABASE_PUBLISHABLE_KEY:public_key_required"),
  );
  const token = "a".repeat(64);
  assert.equal(workerAuthorized(new Request("http://localhost"), token), false);
  assert.equal(
    workerAuthorized(
      new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } }),
      token,
    ),
    true,
  );
  assert.equal(
    workerAuthorized(
      new Request("http://localhost", { headers: { authorization: `Bearer ${token}` } }),
      "b".repeat(64),
    ),
    false,
  );
});

test("Unicode/invalid signatures cannot crash constant-time comparison", async (t) => {
  const { queue } = fixture(t);
  const response = await enqueueWhatsAppWebhook(
    new Request("https://www.tpecia.com.br/api/public/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "é".repeat(71) },
      body: "{}",
    }),
    { secret: "fixture", queue },
  );
  assert.equal(response.status, 401);
});

test("repeated hard crashes eventually move a job to dead instead of looping forever", (t) => {
  const { queue } = fixture(t);
  let now = 1000;
  queue.enqueue("whatsapp", "crashing", "private", now);
  for (let i = 0; i < 10; i++) {
    assert.ok(queue.claim("whatsapp", now));
    now += LEASE_MS;
  }
  assert.equal(queue.claim("whatsapp", now), undefined);
  assert.equal(queue.stats().jobs.find((r) => r.status === "dead")!.total, 1);
});
