// Exercises the compiled Node server and a real separate worker/SQLite volume.
// Fixture credentials never authorize external traffic or production data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { JobQueue } from "../src/lib/runtime/queue.server.ts";

const directory = await mkdtemp(join(tmpdir(), "tpec-node-smoke-"));
const origin = "http://127.0.0.1:3197";
const env = {
  ...process.env,
  NODE_ENV: "production",
  TPEC_RUNTIME: "node",
  HOST: "127.0.0.1",
  PORT: "3197",
  PUBLIC_ORIGIN: "https://www.tpecia.com.br",
  TPEC_DATA_DIR: directory,
  TPEC_INTERNAL_ORIGIN: origin,
  TPEC_WORKER_TOKEN: "hosting-fixture-worker-token-".repeat(3),
  SUPABASE_URL: "https://fixture.invalid",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture",
  OPENAI_API_KEY: "fixture-only",
  WHATSAPP_APP_SECRET: "fixture-meta-secret",
  WHATSAPP_VERIFY_TOKEN: "fixture-verify",
  WHATSAPP_ACCESS_TOKEN: "fixture-only",
  WHATSAPP_PHONE_NUMBER_ID: "fixture-phone",
  TPEC_MULTIMODEL_ENABLED: "false",
  TPEC_GUARDIAN_ENABLED: "false",
  WHATSAPP_PROACTIVE_ENABLED: "false",
  TPEC_FCM_PROJECT_ID: "",
  TPEC_FCM_CLIENT_EMAIL: "",
  TPEC_FCM_PRIVATE_KEY: "",
  WHATSAPP_STATE_STORE: "supabase",
  SERVER_SHUTDOWN_TIMEOUT: "5",
};
const queue = new JobQueue(directory);
// Existing SQL recovery/business modules are covered by their own isolated tests.
// Coalesce the first recovery tick here to ensure this smoke never calls a service.
queue.schedule();
const recovery = queue.claim("recovery");
queue.finish(recovery);
let web, worker;
let log = "";
const launch = (script) => {
  const child = spawn(process.execPath, [script], { env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (v) => {
    log += v;
  });
  child.stderr.on("data", (v) => {
    log += v;
  });
  return child;
};
const stop = async (child) => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    delay(7000).then(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }),
  ]);
};
const eventually = async (fn) => {
  let error;
  for (let i = 0; i < 100; i++) {
    try {
      await fn();
      return;
    } catch (e) {
      error = e;
      await delay(150);
    }
  }
  throw error;
};
try {
  web = launch("scripts/start.mjs");
  await eventually(async () => assert.equal((await fetch(origin + "/healthz")).status, 200));
  assert.equal((await fetch(origin + "/readyz")).status, 503);
  for (const path of ["/", "/painelfazenda", "/painelfazenda?app=1", "/politica-de-privacidade"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /<!DOCTYPE html/i);
  }
  assert.equal((await fetch(origin + "/api/internal/jobs")).status, 404);
  assert.equal(
    (await fetch(origin + "/api/internal/jobs", { method: "POST", body: "{}" })).status,
    404,
  );
  const assets = await fetch(origin + "/.well-known/assetlinks.json");
  assert.equal(assets.headers.get("content-type"), "application/json");
  assert.ok(Array.isArray(await assets.json()));
  assert.equal(
    (
      await fetch(
        origin +
          "/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=fixture-verify&hub.challenge=123",
      )
    ).status,
    200,
  );
  assert.equal(
    (await fetch(origin + "/api/public/whatsapp", { method: "POST", body: "{}" })).status,
    401,
  );
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  const sig = "sha256=" + createHmac("sha256", env.WHATSAPP_APP_SECRET).update(body).digest("hex");
  const r = await fetch(origin + "/api/public/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": sig },
    body,
  });
  assert.equal(r.status, 200);
  assert.equal(queue.stats().jobs.find((r) => r.status === "pending").total >= 1, true);
  // Kill/restart before consuming the acknowledged webhook: the real worker
  // must discover and finish it from the same disk without a new Meta request.
  await stop(web);
  web = launch("scripts/start.mjs");
  await eventually(async () => assert.equal((await fetch(origin + "/healthz")).status, 200));
  worker = launch("scripts/worker.mjs");
  await eventually(async () => assert.equal((await fetch(origin + "/readyz")).status, 200));
  await eventually(async () =>
    assert.ok(queue.stats().jobs.find((r) => r.status === "done" && Number(r.total) >= 4)),
  );
  const before = queue.stats().jobs.find((r) => r.status === "done").total;
  await fetch(origin + "/api/public/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": sig },
    body,
  });
  assert.equal(queue.stats().jobs.find((r) => r.status === "done").total, before);
  console.log(
    "[hosting-smoke] ok SSR, panel refresh, API, signature, private route, durable ACK, worker, restart, dedupe, schedules",
  );
} catch (error) {
  console.error(log);
  throw error;
} finally {
  await stop(worker);
  await stop(web);
  queue.close();
  await rm(directory, { recursive: true, force: true });
}
