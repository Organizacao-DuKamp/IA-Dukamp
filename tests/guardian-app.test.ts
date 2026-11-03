import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { emptyFarm, type GuardianTask } from "../src/lib/guardian/schema.ts";
import { appReminderSnapshot, reminderRevision } from "../src/lib/guardian/app-reminders.server.ts";
import {
  handleAppDevices,
  runAppPushMaintenance,
  type AppDeviceStore,
  type AppDevice,
  type AppPushJob,
} from "../src/lib/guardian/app-devices.server.ts";
import { appPushConfigured, sendAppPush } from "../src/lib/guardian/app-fcm.server.ts";
import { hashToken, type PanelIdentity } from "../src/lib/guardian/panel.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "000000000000096",
  other = "000000000000097",
  at = "2026-11-04T01:00:00.000Z";
const source = {
  actor: phone,
  messageId: "synthetic-app-test",
  at: "2026-11-03T12:00:00Z",
  confirmed: true as const,
};
function task(id = "feed", changes: Partial<GuardianTask> = {}): GuardianTask {
  return {
    id,
    title: "Dar ração",
    dueAt: at,
    status: "open",
    responsiblePhone: phone,
    source,
    updatedAt: source.at,
    ...changes,
  };
}
function identity(): PanelIdentity {
  return {
    phone,
    propertyId: randomUUID(),
    role: "owner",
    version: 1,
    book: { ...emptyFarm("Fazenda sintética", "Tanabi", "SP"), tasks: [task()] },
    expiresAt: "2027-11-03T12:00:00Z",
  };
}
test("app snapshot includes only personal active reminders, with revisioned keys and no phone or provenance", () => {
  const who = identity();
  who.book.tasks.push(
    task("other", { responsiblePhone: other }),
    task("done", { status: "done" }),
    task("old", { dueAt: "2026-11-03T23:00:00Z" }),
    task("far", { dueAt: "2027-01-01T12:00:00Z" }),
  );
  const snapshot = appReminderSnapshot(who, new Date(at));
  assert.deepEqual(
    snapshot.reminders.map((r) => r.id),
    ["feed"],
  );
  assert.equal(snapshot.activeKeys.length, 3);
  assert.equal(snapshot.sessionExpiresAt, who.expiresAt);
  assert.ok(!JSON.stringify(snapshot).includes(phone));
  assert.ok(!JSON.stringify(snapshot).includes("synthetic-app-test"));
  assert.notEqual(
    reminderRevision(task()),
    reminderRevision(task("feed", { title: "Dar ração no lote 2" })),
  );
  const before = snapshot.reminders[0].key;
  who.book.tasks[0].dueAt = "2026-11-04T01:01:00Z";
  assert.notEqual(appReminderSnapshot(who, new Date(at)).reminders[0].key, before);
});
test("app snapshot bounds local schedules without hiding active keys needed for snooze cancellation", () => {
  const who = identity();
  who.book.tasks = Array.from({ length: 140 }, (_, n) => task(String(n)));
  const snapshot = appReminderSnapshot(who, new Date(at));
  assert.equal(snapshot.reminders.length, 128);
  assert.equal(snapshot.activeKeys.length, 140);
  assert.equal(snapshot.hasMore, true);
});

test("device API binds registration to the installed cookie and reauthorizes scoped credentials on every sync", async () => {
  let who: PanelIdentity | null = identity(),
    device: AppDevice | null = null;
  const token = "a".repeat(64),
    session = "b".repeat(64),
    fcmToken = "synthetic-fcm-token-123456789";
  const store: AppDeviceStore = {
    authorize: async (hash) => (hash === hashToken(session) ? who : null),
    find: async (hash) => (device?.token_hash === hash ? device : null),
    register: async (input) => {
      device = { ...input, id: randomUUID() };
    },
    remove: async () => {
      device = null;
    },
    updateToken: async (_, fcm) => {
      device!.fcm_token = fcm;
    },
  };
  function request(method: string, body?: unknown, registered = false) {
    return new Request("https://tpecia.example/api/public/farm-panel/app", {
      method,
      headers: {
        origin: "https://tpecia.example",
        "content-type": "application/json",
        "x-tpec-panel": "1",
        "x-tpec-panel-mode": "installed",
        ...(registered
          ? { authorization: `Bearer ${token}` }
          : { cookie: `tpec_farm_app_session=${session}` }),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const deps = { store, enabled: true, now: new Date(at), pushConfigured: true };
  const input = { token, fcmToken, mode: "alarm" };
  const cross = request("POST", input);
  cross.headers.set("origin", "https://evil.example");
  assert.equal((await handleAppDevices(cross, deps)).status, 403);
  const browser = request("POST", input);
  browser.headers.set("cookie", `tpec_farm_session=${session}`);
  assert.equal((await handleAppDevices(browser, deps)).status, 401);
  assert.equal(
    (await handleAppDevices(request("POST", { ...input, propertyId: randomUUID() }), deps)).status,
    400,
  );
  assert.equal((await handleAppDevices(request("POST", input), deps)).status, 200);
  assert.equal(device!.token_hash, hashToken(token));
  assert.equal(device!.phone_number, phone);
  assert.equal(device!.property_id, who!.propertyId);
  const snapshot = await handleAppDevices(request("GET", undefined, true), deps);
  assert.equal(snapshot.status, 200);
  assert.match(snapshot.headers.get("cache-control")!, /no-store/);
  assert.equal((await snapshot.json()).pushConfigured, true);
  assert.equal(
    (await handleAppDevices(request("PUT", { fcmToken: fcmToken + "-rotated" }, true), deps))
      .status,
    200,
  );
  assert.equal(device!.fcm_token, fcmToken + "-rotated");
  who = null;
  assert.equal((await handleAppDevices(request("GET", undefined, true), deps)).status, 401);
  assert.equal(device, null);
});

async function fixture() {
  const f = await farmIntegration();
  await f.db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261103165643_guardian_android_reminders.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await f.db.exec(
    `CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT current_setting('test.app_now')::timestamptz $$;`,
  );
  const setClock = (time: string) =>
    f.db.query("select set_config('test.app_now',$1,false)", [time]);
  await setClock(at);
  const who = identity();
  who.book.tasks.push(
    task("not-mine", { responsiblePhone: other }),
    task("finished", { status: "done" }),
  );
  await f.guardian.commit({
    phone,
    messageId: "create",
    accountVersion: 0,
    propertyId: who.propertyId,
    propertyVersion: null,
    operation: "create",
    book: who.book,
    pending: null,
    reply: "ok",
  });
  const session = hashToken("app-session"),
    token = hashToken("app-device"),
    code = hashToken("app-code");
  await f.issue(phone, who.propertyId, "issue-code", code);
  assert.equal(await f.store.exchange(code, session, true), true);
  const register = () =>
    f.rpc<boolean>("select guardian_app_register($1,$2,$3,'alarm') data", [
      token,
      session,
      "synthetic-fcm-token-123456789",
    ]);
  assert.equal(await register(), true);
  const claim = async () =>
    (await f.db.query<AppPushJob>("select * from guardian_app_claim_pushes(12)")).rows;
  const begin = (job: AppPushJob) =>
    f.rpc<boolean>("select guardian_app_begin_push($1,$2) data", [job.id, job.lock_token]);
  const finish = (job: AppPushJob, result: string) =>
    f.rpc<boolean>("select guardian_app_finish_push($1,$2,$3) data", [
      job.id,
      job.lock_token,
      result,
    ]);
  const change = async (edit: (tasks: GuardianTask[]) => void) => {
    const book = structuredClone(who.book);
    edit(book.tasks);
    await f.db.query("update guardian_properties set book=$1,version=version+1 where id=$2", [
      book,
      who.propertyId,
    ]);
  };
  return { ...f, who, session, register, claim, begin, finish, change, setClock };
}
test("SQL personal reminders work at night independently of WhatsApp opt-in, with leases, receipts and server-only access", async () => {
  const f = await fixture();
  try {
    const jobs = await f.claim();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].kind, "reminder");
    assert.deepEqual(await f.claim(), []);
    assert.equal(await f.begin({ ...jobs[0], lock_token: randomUUID() }), false);
    assert.equal(await f.begin(jobs[0]), true);
    assert.equal(await f.finish(jobs[0], "sent"), true);
    assert.equal(await f.finish(jobs[0], "sent"), false);
    assert.deepEqual(await f.claim(), []);
    await f.db.exec("SET ROLE anon");
    await assert.rejects(f.db.query("select * from guardian_app_devices"), /permission denied/);
    await assert.rejects(
      f.db.query("select * from guardian_app_claim_pushes(12)"),
      /permission denied/,
    );
    await f.db.exec("RESET ROLE");
    const rows = await f.db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('guardian_app_devices','guardian_app_push_jobs')",
    );
    assert.ok(rows.rows.every((r) => r.relrowsecurity));
  } finally {
    await f.db.close();
  }
});
test("SQL completion cancels a leased reminder and membership revocation cancels sync and new registrations", async () => {
  const f = await fixture();
  try {
    const [job] = await f.claim();
    await f.change((tasks) => {
      tasks[0].status = "done";
    });
    assert.equal(await f.begin(job), false);
    const syncs = await f.claim();
    assert.equal(syncs.length, 1);
    assert.equal(syncs[0].kind, "sync");
    await f.db.query("update guardian_members set active=false where property_id=$1", [
      f.who.propertyId,
    ]);
    assert.equal(await f.begin(syncs[0]), false);
    await assert.rejects(f.register(), /guardian_app_access_denied/);
  } finally {
    await f.db.close();
  }
});
test("SQL rescheduling invalidates old revisions, retry uses backoff, and logout invalidates a fresh lease", async () => {
  const f = await fixture();
  try {
    const [old] = await f.claim();
    await f.change((tasks) => {
      tasks[0].title = "Dar ração no lote 2";
      tasks[0].updatedAt = at;
    });
    assert.equal(await f.begin(old), false);
    const jobs = await f.claim(),
      due = jobs.find((j) => j.kind === "reminder")!;
    assert.ok(due);
    assert.equal(await f.finish(due, "retry"), true);
    for (const j of jobs.filter((j) => j.kind === "sync")) await f.finish(j, "sent");
    assert.deepEqual(await f.claim(), []);
    await f.setClock("2026-11-04T01:02:00Z");
    const [retry] = await f.claim();
    assert.ok(retry);
    assert.notEqual(retry.lock_token, due.lock_token);
    assert.equal(await f.begin(due), false);
    await f.store.revoke(f.session);
    assert.equal(await f.begin(retry), false);
    assert.deepEqual(await f.claim(), []);
  } finally {
    await f.db.close();
  }
});
test("FCM sends only a sync signal using server OAuth and classifies invalid tokens separately from retries", async () => {
  const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    TPEC_FCM_PROJECT_ID: "tpec-synthetic-project",
    TPEC_FCM_CLIENT_EMAIL: "synthetic@tpec-synthetic-project.iam.gserviceaccount.com",
    TPEC_FCM_PRIVATE_KEY: key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
  assert.equal(appPushConfigured({}), false);
  assert.equal(appPushConfigured(env), true);
  const calls: { url: string; init?: RequestInit }[] = [];
  let fail: "none" | "unregistered" | "retry" = "none";
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("oauth2"))
      return Response.json({ access_token: "synthetic-access-token", expires_in: 3600 });
    if (fail === "unregistered")
      return Response.json(
        { error: { details: [{ errorCode: "UNREGISTERED" }] } },
        { status: 404 },
      );
    if (fail === "retry") return Response.json({ error: {} }, { status: 503 });
    return Response.json({ name: "projects/synthetic/messages/test" });
  }) as typeof fetch;
  const input = { token: "synthetic-device-token", kind: "reminder" as const };
  assert.equal(await sendAppPush(input, { env, fetchImpl, now: Date.parse(at) }), "sent");
  assert.equal(calls.length, 2);
  assert.match(String(calls[0].init?.body), /assertion=/);
  const payload = JSON.parse(String(calls[1].init?.body));
  assert.deepEqual(payload.message.data, { kind: "reminder", app: "tpec-farm" });
  assert.equal(payload.message.android.priority, "HIGH");
  assert.ok(!JSON.stringify(payload).includes(phone));
  assert.ok(!JSON.stringify(payload).includes("Dar ração"));
  assert.ok(!payload.message.notification);
  fail = "unregistered";
  assert.equal(await sendAppPush(input, { env, fetchImpl, now: Date.parse(at) }), "unregistered");
  fail = "retry";
  assert.equal(await sendAppPush(input, { env, fetchImpl, now: Date.parse(at) }), "retry");
});
test("push maintenance is inert without Firebase and rechecks authorization before sending", async () => {
  let claims = 0,
    sends = 0,
    receipts = 0;
  const job: AppPushJob = {
    id: randomUUID(),
    lock_token: randomUUID(),
    fcm_token: "synthetic-device-token",
    kind: "sync",
  };
  const claim = async () => {
      claims++;
      return [job];
    },
    send = async () => {
      sends++;
      return "sent" as const;
    },
    finish = async () => {
      receipts++;
    };
  assert.deepEqual(await runAppPushMaintenance({ configured: false, claim, send, finish }), {
    configured: false,
    sent: 0,
  });
  assert.equal(claims, 0);
  assert.equal(
    (
      await runAppPushMaintenance({
        configured: true,
        claim,
        begin: async () => false,
        send,
        finish,
      })
    ).sent,
    0,
  );
  assert.equal(sends, 0);
  assert.equal(
    (
      await runAppPushMaintenance({
        configured: true,
        claim,
        begin: async () => true,
        send,
        finish,
      })
    ).sent,
    1,
  );
  assert.equal(sends, 1);
  assert.equal(receipts, 1);
});
