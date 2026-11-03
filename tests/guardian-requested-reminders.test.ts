import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { emptyFarm, PreferencesSchema } from "../src/lib/guardian/schema.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { processGuardianEvents, type EventStore } from "../src/lib/guardian/maintenance.server.ts";
import type { DeliveryMessage } from "../src/lib/guardian/delivery.ts";

const phone = "5517999991111";
const at = "2026-10-31T01:39:45.000Z"; // 22:39:45 in Brasília, matching the reported failure.
const migration = new URL(
  "../supabase/migrations/20261103032737_guardian_requested_reminder_times.sql",
  import.meta.url,
);

async function fixture(clock = at, due: string | null = clock) {
  const f = await farmIntegration();
  // Freeze PostgreSQL's clock only in this isolated test database, not the application functions.
  await f.db.exec(`CREATE OR REPLACE FUNCTION pg_catalog.now() RETURNS timestamptz
    LANGUAGE sql STABLE AS $$ SELECT current_setting('test.guardian_now')::timestamptz $$;`);
  const setClock = (value: string) =>
    f.db.query("select set_config('test.guardian_now',$1,false)", [value]);
  await setClock(clock);
  const original = emptyFarm("Eduardo", "Monte Aprazível", "SP");
  const applied = due
    ? applyFarmAction(
        original,
        { kind: "task_create", title: "Dar ração para os gados", dueAt: due },
        "owner",
        { actor: phone, messageId: "schedule", at: "2026-10-30T12:00:00Z", confirmed: true },
        "feed",
      )
    : { book: original, events: [] };
  const snapshot = await f.guardian.load(phone);
  const propertyId = randomUUID();
  await f.guardian.commit({
    phone,
    messageId: "farm",
    accountVersion: snapshot.accountVersion,
    propertyId,
    propertyVersion: null,
    operation: "create",
    book: applied.book,
    events: applied.events,
    pending: null,
    reply: "ok",
  });
  await f.db.query("update guardian_accounts set preferences=$1 where phone_number=$2", [
    PreferencesSchema.parse({
      enabled: true,
      consentAt: "2026-10-30T12:00:00Z",
      consentMessageId: "consent",
    }),
    phone,
  ]);
  await f.db.query(
    "insert into whatsapp_followup_profiles(phone_number,last_inbound_at) values($1,now())",
    [phone],
  );
  const events: EventStore = {
    claim: async (limit) =>
      (
        await f.db.query<{ id: string; lock_token: string }>(
          "select id,lock_token from guardian_claim_events($1)",
          [limit],
        )
      ).rows,
    begin: (c) =>
      f.rpc<DeliveryMessage | null>("select guardian_begin_delivery($1,$2) data", [
        c.id,
        c.lock_token,
      ]),
    finish: (c, result) =>
      f.rpc<boolean>("select guardian_finish_delivery($1,$2,$3,$4,$5) data", [
        c.id,
        c.lock_token,
        result.status,
        result.providerId ?? null,
        result.error ?? null,
      ]),
  };
  return { ...f, propertyId, events, setClock };
}

async function proactive(f: Awaited<ReturnType<typeof fixture>>, sent = false, key = "weather") {
  await f.db.query(
    `insert into guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at,status,sent_at)
     values($1,$2,'weather_alert','weather',$3,$4,'Aviso meteorológico',4,now()-interval '1 minute',now()+interval '1 day',$5,$6)`,
    [
      f.propertyId,
      phone,
      key,
      { requestedBy: phone }, // A label alone must never bypass quiet hours for unsolicited alerts.
      sent ? "sent" : "pending",
      sent ? at : null,
    ],
  );
}

for (const clock of [
  at,
  "2026-10-31T05:05:00.000Z",
  "2026-10-31T03:00:00.000Z",
  "2026-10-31T10:59:00.000Z",
]) {
  test(`self-requested reminder is delivered at ${clock} despite quiet hours, daily cap and recent notices`, async () => {
    const f = await fixture(clock);
    try {
      for (const key of ["earlier-one", "earlier-two"]) await proactive(f, true, key);
      await f.db.query(
        "update guardian_events set sent_at=now()-interval '1 minute' where status='sent'",
      );
      const messages: DeliveryMessage[] = [];
      const send = async (m: DeliveryMessage) => {
        messages.push(m);
        return { status: "sent" as const, providerId: "wamid.synthetic" };
      };
      await f.db.exec("SET ROLE service_role");
      const result = await processGuardianEvents({ store: f.events, send });
      assert.equal(result.sent, 1);
      assert.equal(messages[0].mode, "text");
      assert.match(messages[0].message, /Dar ração/);
      assert.equal((await processGuardianEvents({ store: f.events, send })).sent, 0);
      assert.equal(messages.length, 1, "a receipt prevents a second delivery");
      await f.db.exec("RESET ROLE");
      const s = await f.guardian.load(phone);
      assert.equal(s.active!.book.tasks[0].status, "open", "a reminder does not finish the task");
      assert.equal(s.preferences.startHour, 8);
      assert.equal(s.preferences.endHour, 20, "the general quiet window remains unchanged");
    } finally {
      await f.db.close();
    }
  });
}

test("a natural request schedules a night reminder and neither claims early nor requires a wider window", async () => {
  const created = "2026-10-30T23:39:45.000Z";
  const due = "2026-10-31T01:39:00.000Z";
  const f = await fixture(created, null);
  try {
    const response = await handleGuardianMessage(
      {
        phone,
        messageId: "natural-night",
        text: "me lembra de dar ração para os gados hoje às 22h39",
      },
      {
        store: f.guardian,
        now: new Date(created),
        extract: async () => {
          throw Error("an explicit reminder needs no model");
        },
      },
    );
    assert.equal(response?.persisted, true, response?.reply ?? "");
    if (!(await f.guardian.load(phone)).active!.book.tasks.length) {
      assert.match(response!.reply!, /confirmar/);
      await handleGuardianMessage(
        { phone, messageId: "confirm-night", text: "confirmar" },
        { store: f.guardian, now: new Date(created) },
      );
    }
    const s = await f.guardian.load(phone);
    assert.equal(Date.parse(s.active!.book.tasks[0].dueAt), Date.parse(due));
    assert.equal((await f.events.claim(5)).length, 0, "a requested reminder cannot send early");
    const context = await handleGuardianMessage(
      { phone, messageId: "policy-question", text: "Como funcionam os avisos da fazenda?" },
      { store: f.guardian, now: new Date(created), extract: async () => null },
    );
    assert.match(context?.context ?? "", /inclusive à noite ou de madrugada/);
    await f.setClock(due);
    const claim = (await f.events.claim(5))[0];
    assert.ok(claim);
    assert.ok(await f.events.begin(claim));
  } finally {
    await f.db.close();
  }
});

test("unsolicited alerts keep quiet hours at both claim and dispatch and retain daytime rate limits", async () => {
  const f = await fixture(at, null);
  try {
    await proactive(f);
    assert.equal((await f.events.claim(5)).length, 0);
    assert.equal(
      Date.parse(
        await f.rpc<string>(
          "select available_at::text data from guardian_events where dedupe_key='weather'",
        ),
      ),
      Date.parse("2026-10-31T11:00:00Z"),
    );
    await f.setClock("2026-10-31T22:59:59Z"); // 19:59:59 in Brasília.
    const claim = (await f.events.claim(5))[0];
    assert.ok(claim);
    await f.setClock("2026-10-31T23:00:00Z");
    assert.equal(await f.events.begin(claim), null);
    assert.equal(
      await f.rpc("select last_error data from guardian_events where id=$1", [claim.id]),
      "quiet_hours",
    );
    await f.setClock("2026-11-01T15:00:00Z");
    await f.db.query("update guardian_events set expires_at=now()+interval '1 day'");
    await proactive(f, true, "recent");
    await f.db.query(
      "update guardian_events set sent_at=now()-interval '1 minute' where status='sent'",
    );
    assert.equal(
      (await f.events.claim(5)).length,
      0,
      "unsolicited alerts still respect the minimum interval",
    );
    await proactive(f, true, "second");
    await f.db.query(
      "update guardian_events set sent_at=now()-interval '3 hours' where status='sent'",
    );
    assert.equal(
      (await f.events.claim(5)).length,
      0,
      "unsolicited alerts still respect the daily cap",
    );
  } finally {
    await f.db.close();
  }
});

test("pause, missing consent, disabled topic, revoked membership and task edits are rechecked before sending", async () => {
  const f = await fixture();
  try {
    await f.db.exec("BEGIN");
    for (const mutation of [
      "update guardian_accounts set preferences=jsonb_set(preferences,'{enabled}','false')",
      "update guardian_accounts set preferences=jsonb_set(preferences,'{topics}','[\"weather\"]')",
      "update guardian_members set active=false",
      "update guardian_properties set book=jsonb_set(book,'{tasks,0,status}','\"done\"')",
      "update guardian_properties set book=jsonb_set(book,'{tasks,0,status}','\"cancelled\"')",
      "update guardian_properties set book=jsonb_set(book,'{tasks,0,updatedAt}','\"2026-10-31T01:39:46Z\"')",
    ]) {
      await f.db.exec("SAVEPOINT before_claim");
      const claim = (await f.events.claim(5))[0];
      assert.ok(claim);
      await f.db.exec(mutation);
      assert.equal(await f.events.begin(claim), null, mutation);
      await f.db.exec("ROLLBACK TO SAVEPOINT before_claim");
    }
    await f.db.exec("ROLLBACK");
    await assert.rejects(
      f.db.exec(
        "update guardian_accounts set preferences=jsonb_set(preferences,'{consentAt}','null')",
      ),
      /guardian_accounts_preferences_check/,
      "the database rejects enabling reminders without consent",
    );
    await f.db.query("update guardian_events set expires_at=now()+interval '1 second'");
    await f.setClock("2026-10-31T01:39:47Z");
    assert.equal((await f.events.claim(5)).length, 0, "expired reminders remain expired");
  } finally {
    await f.db.close();
  }
});

test("a task assigned by someone else cannot override the recipient's quiet hours; their own reschedule can", async () => {
  const f = await fixture();
  try {
    const other = "5517999992222";
    await f.db.query(
      "update guardian_events set evidence=jsonb_set(evidence,'{requestedBy}',to_jsonb($1::text))",
      [other],
    );
    await f.db.query(
      "update guardian_properties set book=jsonb_set(book,'{tasks,0,source,actor}',to_jsonb($1::text))",
      [other],
    );
    assert.equal((await f.events.claim(5)).length, 0);
    const snapshot = await f.guardian.load(phone);
    const due = "2026-10-31T02:00:00Z";
    const applied = applyFarmAction(
      snapshot.active!.book,
      { kind: "task_update", task: "feed", dueAt: due },
      "owner",
      { actor: phone, messageId: "self-reschedule", at, confirmed: true },
      "unused",
    );
    assert.equal(applied.events[0].evidence.requestedBy, phone);
    await f.guardian.commit({
      phone,
      messageId: "self-reschedule",
      accountVersion: snapshot.accountVersion,
      propertyId: f.propertyId,
      propertyVersion: snapshot.active!.version,
      operation: "update",
      book: applied.book,
      events: applied.events,
      pending: null,
      reply: "ok",
    });
    await f.setClock(due);
    const claim = (await f.events.claim(5))[0];
    assert.ok(claim);
    assert.ok(await f.events.begin(claim));
  } finally {
    await f.db.close();
  }
});

test("legacy reminders are recovered without resurrecting old notices or removing provider backoff", async () => {
  const f = await fixture();
  try {
    await f.db.query(
      "update guardian_events set evidence=evidence-'requestedBy',available_at=now()+interval '9 hours'",
    );
    const variants = [
      ["quiet", "retry", "quiet_hours"],
      ["rate", "retry", "provider_rate_limited"],
      ["sent", "sent", null],
      ["uncertain", "uncertain", "provider_transport_ambiguous"],
      ["cancelled", "cancelled", "source_obsolete"],
      ["expired", "expired", "event_expired"],
    ];
    for (const [key, status, error] of variants)
      await f.db.query(
        `insert into guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at,available_at,status,last_error,attempts)
         select property_id,recipient,type,topic,$1,evidence,message,priority,not_before,expires_at,available_at,$2,$3,1 from guardian_events where dedupe_key like 'task:%'`,
        [key, status, error],
      );
    await f.db.exec(await readFile(migration, "utf8"));
    const rows = await f.db.query<{ dedupe_key: string; status: string; ready: boolean }>(
      "select dedupe_key,status,available_at<=now() ready from guardian_events order by dedupe_key",
    );
    for (const row of rows.rows) {
      assert.equal(
        row.ready,
        row.dedupe_key.startsWith("task:") || row.dedupe_key === "quiet",
        row.dedupe_key,
      );
      if (!row.dedupe_key.startsWith("task:"))
        assert.equal(row.status, variants.find(([key]) => key === row.dedupe_key)![1]);
    }
    assert.equal(
      (await f.events.claim(5)).length,
      1,
      "verified legacy provenance grants the same exception",
    );
  } finally {
    await f.db.close();
  }
});

test("a self-requested reminder still requires a WhatsApp template after 24 hours and never resends an uncertain delivery", async () => {
  const f = await fixture();
  try {
    await f.db.query(
      "update whatsapp_followup_profiles set last_inbound_at=now()-interval '25 hours'",
    );
    let calls = 0;
    const send = async (message: DeliveryMessage) => {
      calls++;
      assert.equal(message.mode, "template");
      return { status: "uncertain" as const, error: "provider_transport_ambiguous" };
    };
    assert.equal((await processGuardianEvents({ store: f.events, send })).uncertain, 1);
    assert.equal((await processGuardianEvents({ store: f.events, send })).claimed, 0);
    assert.equal(calls, 1);
    for (const role of ["anon", "authenticated"]) {
      await f.db.exec(`SET ROLE ${role}`);
      await assert.rejects(f.events.claim(5), /permission denied/);
      await assert.rejects(
        f.db.query("select guardian_is_requested_reminder(null::guardian_events,'{}'::jsonb)"),
        /permission denied/,
      );
      await f.db.exec("RESET ROLE");
    }
  } finally {
    await f.db.close();
  }
});
