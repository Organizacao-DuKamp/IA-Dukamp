import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { emptyFarm, PreferencesSchema, FarmBookSchema } from "../src/lib/guardian/schema.ts";
import {
  taskOccurrences,
  taskDisplayDueAt,
  firstDailyDueAt,
} from "../src/lib/guardian/task-recurrence.ts";
import { appReminderSnapshot } from "../src/lib/guardian/app-reminders.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "000000000000086";
const source = {
  actor: phone,
  messageId: "qa-daily-create",
  at: "2026-11-04T10:00:00.000Z",
  confirmed: true as const,
};
const dueAt = "2026-11-04T11:00:00.000Z";
const created = () =>
  applyFarmAction(
    emptyFarm("Fazenda QA", "Tanabi", "SP"),
    { kind: "task_create", title: "Dar ração aos gados", dueAt, recurrence: "daily" },
    "owner",
    source,
    "daily-feed",
  );
const at = (value: string, id = "qa-update") => ({ ...source, at: value, messageId: id });

test("daily schedule stays bounded and completes only today's occurrence, preserving all future reminders", () => {
  const original = created();
  const done = applyFarmAction(
    original.book,
    { kind: "task_update", task: "daily-feed", status: "done" },
    "owner",
    at("2026-11-04T11:05:00.000Z"),
    "done",
  );
  assert.equal(done.book.tasks.length, 1);
  assert.equal(done.book.tasks[0].status, "open");
  assert.equal(done.book.tasks[0].completedThrough, dueAt);
  assert.equal(
    taskDisplayDueAt(done.book.tasks[0], new Date("2026-11-04T11:10:00Z")),
    "2026-11-05T11:00:00.000Z",
  );
  assert.match(done.result, /continua todos os dias/);
  assert.equal(done.events[0].notBefore, "2026-11-05T11:00:00.000Z");
  assert.throws(
    () =>
      applyFarmAction(
        done.book,
        { kind: "task_update", task: "daily-feed", status: "done" },
        "owner",
        at("2026-11-04T11:06:00Z"),
        "again",
      ),
    /já está concluída/,
  );
  const tomorrow = applyFarmAction(
    done.book,
    { kind: "task_update", task: "daily-feed", status: "done" },
    "owner",
    at("2026-11-05T11:01:00Z"),
    "tomorrow",
  );
  assert.equal(tomorrow.book.tasks.length, 1);
  assert.equal(tomorrow.book.tasks[0].completedThrough, "2026-11-05T11:00:00.000Z");
  assert.equal(original.book.tasks[0].completedThrough, undefined);
  assert.equal(FarmBookSchema.parse(tomorrow.book).tasks[0].recurrence, "daily");
  assert.throws(
    () =>
      applyFarmAction(
        original.book,
        {
          kind: "task_update",
          task: "daily-feed",
          status: "done",
          occurrenceAt: "2026-11-06T11:00:00Z",
        },
        "owner",
        at("2026-11-04T11:05:00Z"),
        "future",
      ),
    /Não é possível concluir/,
  );
});

test("first daily occurrence is today before 8am, tomorrow after 8am; month and year rollover retain the local time", () => {
  assert.equal(firstDailyDueAt(dueAt, new Date("2026-11-04T10:30:00Z")), dueAt);
  assert.equal(
    firstDailyDueAt(dueAt, new Date("2026-11-04T11:32:00Z")),
    "2026-11-05T11:00:00.000Z",
  );
  const task = created().book.tasks[0];
  assert.deepEqual(
    taskOccurrences(task, new Date("2026-12-31T10:59:00Z"), new Date("2027-01-02T11:00:00Z")),
    ["2026-12-31T11:00:00.000Z", "2027-01-01T11:00:00.000Z", "2027-01-02T11:00:00.000Z"],
  );
  assert.equal(
    taskOccurrences(task, new Date("2026-11-01T00:00:00Z"), new Date("2026-11-03T23:59:59Z"))
      .length,
    0,
  );
});

test("Android expands independent daily alarm keys for 30 days and removes cancelled/completed occurrences", () => {
  const identity = {
    phone,
    propertyId: randomUUID(),
    role: "owner" as const,
    version: 1,
    book: created().book,
    expiresAt: "2027-01-01T00:00:00Z",
  };
  const snap = appReminderSnapshot(identity, new Date("2026-11-04T10:00:00Z"));
  assert.equal(snap.reminders.length, 30);
  assert.equal(new Set(snap.reminders.map((r) => r.key)).size, 30);
  assert.equal(snap.reminders[1].dueAt, "2026-11-05T11:00:00.000Z");
  identity.book = applyFarmAction(
    identity.book,
    { kind: "task_update", task: "daily-feed", status: "done" },
    "owner",
    at("2026-11-04T11:01:00Z"),
    "done",
  ).book;
  const after = appReminderSnapshot(identity, new Date("2026-11-04T11:01:00Z"));
  assert.equal(after.reminders[0].dueAt, "2026-11-05T11:00:00.000Z");
  assert.ok(!after.activeKeys.includes(snap.reminders[0].key));
  identity.book = applyFarmAction(
    identity.book,
    { kind: "task_update", task: "daily-feed", status: "cancelled" },
    "owner",
    at("2026-11-04T11:02:00Z"),
    "cancel",
  ).book;
  assert.equal(appReminderSnapshot(identity, new Date(dueAt)).reminders.length, 0);
});

async function fixture() {
  const f = await farmIntegration();
  for (const name of [
    "20261103165643_guardian_android_reminders.sql",
    "20261104114141_guardian_daily_task_reminders.sql",
  ])
    await f.db.exec(
      await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"),
    );
  await f.db.exec(
    `CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT current_setting('test.guardian_now')::timestamptz $$;`,
  );
  const setClock = (value: string) =>
    f.db.query("select set_config('test.guardian_now',$1,false)", [value]);
  await setClock("2026-11-04T10:00:00Z");
  const propertyId = randomUUID(),
    current = await f.guardian.load(phone),
    initial = created();
  await f.guardian.commit({
    phone,
    messageId: "qa-farm",
    accountVersion: current.accountVersion,
    propertyId,
    propertyVersion: null,
    operation: "create",
    book: initial.book,
    events: initial.events,
    pending: null,
    reply: "QA",
  });
  await f.db.query("update guardian_accounts set preferences=$1 where phone_number=$2", [
    PreferencesSchema.parse({
      enabled: true,
      consentAt: source.at,
      consentMessageId: "qa-consent",
    }),
    phone,
  ]);
  await f.db.query(
    "insert into whatsapp_followup_profiles(phone_number,last_inbound_at) values($1,now())",
    [phone],
  );
  return { ...f, propertyId, setClock };
}

test("SQL sends one occurrence every day without requiring completion; seeding/retries deduplicate and cancellation invalidates a lease", async () => {
  const f = await fixture();
  try {
    await f.db.query("select guardian_seed_daily_tasks()");
    await f.db.query("select guardian_seed_daily_tasks()");
    const count = () =>
      f.rpc<number>("select count(*)::int data from guardian_events where type='task_due'");
    assert.equal(await count(), 2); // Today's existing event and tomorrow, not a duplicate today.
    assert.equal((await f.db.query("select * from guardian_claim_events(5)")).rows.length, 0);
    for (const [day, clock] of [
      ["04", "2026-11-04T11:00:00Z"],
      ["05", "2026-11-05T11:00:00Z"],
      ["06", "2026-11-06T11:00:00Z"],
    ]) {
      await f.setClock(clock);
      const claims = (
        await f.db.query<{ id: string; lock_token: string }>(
          "select id,lock_token from guardian_claim_events(5)",
        )
      ).rows;
      assert.equal(claims.length, 1, day);
      const c = claims[0];
      const delivery = await f.rpc<{ message: string }>(
        "select guardian_begin_delivery($1,$2) data",
        [c.id, c.lock_token],
      );
      assert.ok(delivery?.message.includes("ração"));
      await f.db.query("select guardian_finish_delivery($1,$2,'sent',$3,null)", [
        c.id,
        c.lock_token,
        "qa-" + day,
      ]);
      assert.equal((await f.db.query("select * from guardian_claim_events(5)")).rows.length, 0);
    }
    await f.setClock("2026-11-07T11:00:00Z");
    const c = (
      await f.db.query<{ id: string; lock_token: string }>(
        "select id,lock_token from guardian_claim_events(5)",
      )
    ).rows[0];
    const s = await f.guardian.load(phone);
    const cancel = applyFarmAction(
      s.active!.book,
      { kind: "task_update", task: "daily-feed", status: "cancelled" },
      "owner",
      at("2026-11-07T11:00:00Z"),
      "cancel",
    );
    await f.guardian.commit({
      phone,
      messageId: "qa-cancel",
      accountVersion: s.accountVersion,
      propertyId: f.propertyId,
      propertyVersion: s.active!.version,
      operation: "update",
      book: cancel.book,
      events: cancel.events,
      pending: null,
      reply: "cancelled",
      details: { kind: "task_update" },
    });
    assert.equal(
      await f.rpc("select guardian_begin_delivery($1,$2) data", [c.id, c.lock_token]),
      null,
    );
    await f.setClock("2026-11-08T11:00:00Z");
    assert.equal((await f.db.query("select * from guardian_claim_events(5)")).rows.length, 0);
    const privileges = await f.db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon','public.guardian_seed_daily_tasks()','EXECUTE') allowed",
    );
    assert.equal(privileges.rows[0].allowed, false);
  } finally {
    await f.db.close();
  }
});

test("natural spoken daily request creates a persisted daily task for tomorrow instead of asking for a date", async () => {
  const f = await fixture();
  try {
    await f.db.query("update guardian_properties set book=jsonb_set(book,'{tasks}','[]')");
    const r = await handleGuardianMessage(
      {
        phone,
        messageId: "qa-audio",
        text: "Me lembre todos os dias às oito da manhã para dar ração aos gados.",
        mediaType: "audio",
      },
      { store: f.guardian, now: new Date("2026-11-04T11:32:00Z") },
    );
    assert.ok(r?.persisted, r?.reply);
    const s = await f.guardian.load(phone);
    assert.equal(s.active!.book.tasks.length, 1);
    assert.equal(s.active!.book.tasks[0].recurrence, "daily");
    assert.equal(s.active!.book.tasks[0].dueAt, "2026-11-05T11:00:00.000Z");
  } finally {
    await f.db.close();
  }
});

test("SQL daily FCM jobs get distinct keys tomorrow and revalidate completion/replanning/revocation before dispatch", async () => {
  const f = await fixture();
  try {
    const { hashToken } = await import("../src/lib/guardian/panel.server.ts");
    const session = hashToken("qa-daily-session"),
      token = hashToken("qa-daily-device"),
      code = hashToken("qa-daily-code");
    await f.issue(phone, f.propertyId, "qa-code", code);
    assert.equal(await f.store.exchange(code, session, true), true);
    assert.equal(
      await f.rpc("select guardian_app_register($1,$2,$3,'alarm') data", [
        token,
        session,
        "qa-fcm-token-00000000000000",
      ]),
      true,
    );
    const claim = async () =>
      (
        await f.db.query<{ id: string; lock_token: string; kind: string }>(
          "select * from guardian_app_claim_pushes(12)",
        )
      ).rows;
    await f.setClock(dueAt);
    const jobs = await claim();
    assert.equal(jobs.length, 1);
    const first = jobs[0];
    assert.equal(
      await f.rpc("select guardian_app_begin_push($1,$2) data", [first.id, first.lock_token]),
      true,
    );
    assert.equal(
      await f.rpc("select guardian_app_finish_push($1,$2,'sent') data", [
        first.id,
        first.lock_token,
      ]),
      true,
    );
    assert.equal((await claim()).length, 0);
    await f.setClock("2026-11-05T11:00:00Z");
    const tomorrow = (await claim())[0];
    assert.notEqual(tomorrow.id, first.id);
    const s = await f.guardian.load(phone);
    const updated = applyFarmAction(
      s.active!.book,
      { kind: "task_update", task: "daily-feed", dueAt: "2026-11-06T12:00:00Z" },
      "owner",
      at("2026-11-05T11:00:01Z"),
      "reschedule",
    );
    assert.equal(updated.book.tasks[0].recurrence, "daily");
    await f.guardian.commit({
      phone,
      messageId: "qa-replan",
      accountVersion: s.accountVersion,
      propertyId: f.propertyId,
      propertyVersion: s.active!.version,
      operation: "update",
      book: updated.book,
      events: updated.events,
      pending: null,
      reply: "ok",
      details: { kind: "task_update" },
    });
    assert.equal(
      await f.rpc("select guardian_app_begin_push($1,$2) data", [tomorrow.id, tomorrow.lock_token]),
      false,
    );
    await f.setClock("2026-11-06T12:00:00Z");
    const rescheduled = (await claim()).find((j) => j.kind === "reminder")!;
    assert.ok(rescheduled);
    await f.db.query("update guardian_members set active=false where phone_number=$1", [phone]);
    assert.equal(
      await f.rpc("select guardian_app_begin_push($1,$2) data", [
        rescheduled.id,
        rescheduled.lock_token,
      ]),
      false,
    );
  } finally {
    await f.db.close();
  }
});

test("editing a daily reminder title retains Android's delivered key and cannot resend the same WhatsApp occurrence", async () => {
  const f = await fixture();
  try {
    await f.setClock(dueAt);
    const c = (
      await f.db.query<{ id: string; lock_token: string }>(
        "select id,lock_token from guardian_claim_events(1)",
      )
    ).rows[0];
    assert.ok(await f.rpc("select guardian_begin_delivery($1,$2) data", [c.id, c.lock_token]));
    await f.db.query("select guardian_finish_delivery($1,$2,'sent','qa-first',null)", [
      c.id,
      c.lock_token,
    ]);
    const s = await f.guardian.load(phone);
    const identity = {
      phone,
      propertyId: f.propertyId,
      role: "owner" as const,
      version: 1,
      expiresAt: "2027-01-01T00:00:00Z",
      book: s.active!.book,
    };
    const before = appReminderSnapshot(identity, new Date(dueAt));
    const updated = applyFarmAction(
      s.active!.book,
      { kind: "task_update", task: "daily-feed", title: "Dar ração no cocho para os gados" },
      "owner",
      at("2026-11-04T11:01:00Z"),
      "rename",
    );
    const after = appReminderSnapshot({ ...identity, book: updated.book }, new Date(dueAt));
    assert.equal(after.reminders[0].key, before.reminders[0].key);
    assert.notEqual(after.reminders[0].revision, before.reminders[0].revision);
    await f.guardian.commit({
      phone,
      messageId: "qa-rename",
      accountVersion: s.accountVersion,
      propertyId: f.propertyId,
      propertyVersion: s.active!.version,
      operation: "update",
      book: updated.book,
      events: updated.events,
      pending: null,
      reply: "ok",
      details: { kind: "task_update" },
    });
    const repeat = (
      await f.db.query<{ id: string; lock_token: string }>(
        "select id,lock_token from guardian_claim_events(1)",
      )
    ).rows[0];
    assert.ok(repeat);
    assert.equal(
      await f.rpc("select guardian_begin_delivery($1,$2) data", [repeat.id, repeat.lock_token]),
      null,
    );
    assert.equal(
      await f.rpc("select last_error data from guardian_events where id=$1", [repeat.id]),
      "occurrence_already_delivered",
    );
  } finally {
    await f.db.close();
  }
});
