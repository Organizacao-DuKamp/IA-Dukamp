import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  guardianRpcArgs,
  mapSnapshot,
  type GuardianCommit,
  type GuardianStore,
} from "../src/lib/guardian/store.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { PreferencesSchema } from "../src/lib/guardian/schema.ts";

const phone = "5517999991111",
  other = "5517999992222";
const admin = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  user2 = "00000000-0000-4000-8000-000000000003";
async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('${admin}'),('${user}'),('${user2}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1='${admin}'::uuid AND $2='admin' $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    CREATE TABLE public.whatsapp_followup_profiles(phone_number text PRIMARY KEY,followups_enabled boolean DEFAULT true,last_inbound_at timestamptz);
    CREATE TABLE public.whatsapp_proactive_queue(status text,last_error text,updated_at timestamptz);
    CREATE TABLE public.knowledge_documents(id uuid PRIMARY KEY,version integer NOT NULL DEFAULT 1,content_hash text);
    CREATE TABLE public.knowledge_chunks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES public.knowledge_documents(id),chunk_index integer NOT NULL,content text NOT NULL,embedding text,metadata jsonb,category text NOT NULL,subcategory text,filename text NOT NULL,title text NOT NULL);
    GRANT SELECT ON public.whatsapp_followup_profiles TO service_role;
    INSERT INTO public.whatsapp_followup_profiles VALUES('${phone}',true,now());
    INSERT INTO public.whatsapp_proactive_queue VALUES('pending',NULL,now());`);
  for (const suffix of [
    "guardian_farm_foundation.sql",
    "guardian_durable_events.sql",
    "guardian_optional_reports.sql",
    "knowledge_atomic_replacement.sql",
  ]) {
    const file = (await readdir(new URL("../supabase/migrations/", import.meta.url))).find((f) =>
      f.endsWith(suffix),
    )!;
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
    );
  }
  const store: GuardianStore = {
    async load(p) {
      const { rows } = await db.query<{ data: unknown }>(
        "select public.guardian_snapshot($1) data",
        [p],
      );
      return mapSnapshot(rows[0].data);
    },
    async receipt(p, m) {
      const { rows } = await db.query<{ reply: string }>(
        "select reply from public.guardian_turn_receipts where phone_number=$1 and message_id=$2",
        [p, m],
      );
      return rows[0]?.reply ?? null;
    },
    async commit(c) {
      const a = guardianRpcArgs(c);
      const { rows } = await db.query<{ data: string }>(
        "select public.guardian_commit_turn($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) data",
        Object.values(a),
      );
      return rows[0].data;
    },
  };
  let seq = 0;
  const send = (text: string, p = phone) =>
    handleGuardianMessage(
      { phone: p, messageId: `msg${++seq}`, text },
      { store, now: new Date("2026-10-23T15:00:00Z") },
    );
  return { db, store, send };
}

test("real SQL: farm draft, confirmation, durable receipt, ledger and structured herd", async () => {
  const { db, store, send } = await setup();
  try {
    const draft = await send("cadastrar fazenda Boa Vista em Monte Aprazível/SP");
    assert.match(draft!.reply!, /confirmar/);
    assert.equal((await store.load(phone)).active, null);
    assert.match((await send("confirmar"))!.reply!, /criada e selecionada/);
    await send("despesa R$ 150,50 com ração");
    await send("confirmar");
    const snapshot = await store.load(phone);
    assert.equal(snapshot.active!.book.ledger[0].amountCents, 15050);
    await send("cadastrar animal 10 fêmea raça Nelore lote 2");
    await send("confirmar");
    await send("peso do animal 10 450 kg");
    await send("confirmar");
    await send("corrija o peso do animal 10 para 460 kg");
    await send("confirmar");
    const a = (await store.load(phone)).active!.book.animals[0];
    assert.equal(a.weights[0].weightKg, 460);
    assert.equal(a.weights[0].corrections[0].weightKg, 450);
    const replay = await handleGuardianMessage(
      { phone, messageId: "msg4", text: "confirmar" },
      { store },
    );
    assert.match(replay!.reply!, /150,50/);
    assert.equal((await store.load(phone)).active!.book.ledger.length, 1);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from guardian_audit where action='update'",
        )
      ).rows[0].n,
      4,
    );
  } finally {
    await db.close();
  }
});
test("real SQL: knowledge replacement rolls back every chunk on failure and rejects stale document versions", async () => {
  const { db } = await setup();
  try {
    const id = "00000000-0000-4000-8000-000000000099";
    await db.query(
      "insert into knowledge_documents(id,version,content_hash) values($1,1,'original')",
      [id],
    );
    const row = {
      document_id: id,
      chunk_index: 0,
      content: "Original confiável",
      embedding: "[1]",
      metadata: { embedding_provider: "test" },
      category: "technical",
      subcategory: null,
      filename: "documento.txt",
      title: "Documento",
    };
    await db.query("select replace_knowledge_document_chunks($1,1,'original',$2)", [id, [row]]);
    await assert.rejects(
      db.query("select replace_knowledge_document_chunks($1,1,'original',$2)", [
        id,
        [
          { ...row, content: "Primeiro novo" },
          { ...row, chunk_index: 1, content: null },
        ],
      ]),
      /null value/,
    );
    assert.equal(
      (await db.query<{ content: string }>("select content from knowledge_chunks")).rows[0].content,
      "Original confiável",
    );
    await db.query("update knowledge_documents set version=2 where id=$1", [id]);
    await assert.rejects(
      db.query("select replace_knowledge_document_chunks($1,1,'original',$2)", [id, [row]]),
      /knowledge_source_changed/,
    );
    await db.exec("SET ROLE authenticated");
    await assert.rejects(
      db.query("select replace_knowledge_document_chunks($1,2,'original',$2)", [id, [row]]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("real SQL: tenant isolation, anonymous denial, phone-bound invite, revocation and web RLS", async () => {
  const { db, store, send } = await setup();
  try {
    await send("cadastrar fazenda Boa Vista em Monte Aprazível/SP");
    await send("confirmar");
    const prop = (await store.load(phone)).active!;
    assert.equal((await store.load(other)).properties.length, 0);
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("select * from guardian_properties"), /permission denied/);
    await assert.rejects(
      db.query("select public.guardian_snapshot($1)", [phone]),
      /permission denied/,
    );
    await db.exec("RESET ROLE");
    await send(`convidar ${other} como funcionário`);
    const invitation = (await send("confirmar"))!.reply!;
    const token = invitation.match(/aceitar convite ([a-f0-9]{32})/)![1];
    await assert.rejects(
      store.commit({
        phone,
        messageId: "stolen",
        accountVersion: (await store.load(phone)).accountVersion,
        propertyId: null,
        propertyVersion: null,
        operation: "accept",
        pending: null,
        details: { token },
        reply: "ok",
      }),
      /invalid_guardian_invitation/,
    );
    await send(`aceitar convite ${token}`, other);
    assert.equal((await store.load(other)).active!.id, prop.id);
    await send("despesa R$ 20 com ração", other);
    assert.equal((await store.load(other)).pending, null);
    const s = await store.load(other);
    await assert.rejects(
      store.commit({
        phone: other,
        messageId: "forged",
        accountVersion: s.accountVersion,
        propertyId: prop.id,
        propertyVersion: prop.version,
        operation: "update",
        book: s.active!.book,
        pending: null,
        details: { kind: "ledger" },
        reply: "ok",
      }),
      /guardian_write_denied/,
    );
    await db.query("update guardian_members set user_id=$1 where phone_number=$2", [user, other]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("SET ROLE authenticated");
    assert.equal((await db.query("select * from guardian_properties")).rows.length, 1);
    await assert.rejects(db.query("update guardian_members set role='owner'"), /permission denied/);
    await db.exec("RESET ROLE");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user2]);
    await db.exec("SET ROLE authenticated");
    assert.equal((await db.query("select * from guardian_properties")).rows.length, 0);
    await db.exec("RESET ROLE");
    await send(`revogar acesso ${other}`);
    await send("confirmar");
    assert.equal((await store.load(other)).active, null);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("SET ROLE authenticated");
    assert.equal((await db.query("select * from guardian_properties")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("real SQL: compare-and-swap prevents lost updates and task completion cancels queued evidence", async () => {
  const { db, store, send } = await setup();
  try {
    await send("cadastrar fazenda Boa Vista em Monte Aprazível/SP");
    await send("confirmar");
    await send("me lembra de pesar o lote 2 na sexta às 8h");
    await send("confirmar");
    let s = await store.load(phone);
    const task = s.active!.book.tasks[0];
    assert.ok(task);
    const turn: GuardianCommit = {
      phone,
      messageId: "cas1",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "noop",
      pending: null,
      reply: "one",
    };
    assert.equal(await store.commit(turn), "committed");
    assert.equal(await store.commit({ ...turn, messageId: "cas2" }), "conflict");
    await send(`concluir tarefa ${task.id}`);
    await send("confirmar");
    const { rows } = await db.query<{ status: string }>("select status from guardian_events");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "cancelled");
    s = await store.load(phone);
    assert.equal(s.active!.book.tasks[0].status, "done");
  } finally {
    await db.close();
  }
});
test("real SQL: consent, quiet hours, claim fencing, accepted receipt and ambiguous crash recovery", async () => {
  const { db, store, send } = await setup();
  try {
    await send("cadastrar fazenda Boa Vista em Monte Aprazível/SP");
    await send("confirmar");
    const s = await store.load(phone),
      prop = s.active!.id;
    const now = (await db.query<{ at: string }>("select now()::text at")).rows[0].at;
    await db.query(
      "insert into guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at) values($1,$2,'weather_alert','weather','test','{}','Aviso verificável',4,now()-interval '1 minute',now()+interval '1 day')",
      [prop, phone],
    );
    assert.equal((await db.query("select * from guardian_claim_events(5)")).rows.length, 0);
    const preferences = PreferencesSchema.parse({
      enabled: true,
      consentAt: new Date(now).toISOString(),
      consentMessageId: "optin",
      startHour: 0,
      endHour: 24,
    });
    await store.commit({
      phone,
      messageId: "prefs",
      accountVersion: s.accountVersion,
      propertyId: prop,
      propertyVersion: 0,
      operation: "preferences",
      preferences,
      pending: null,
      reply: "ok",
    });
    const claim = (
      await db.query<{ id: string; lock_token: string }>("select * from guardian_claim_events(5)")
    ).rows[0];
    assert.ok(claim);
    assert.equal((await db.query("select * from guardian_claim_events(5)")).rows.length, 0);
    const begin = (
      await db.query<{ data: { mode: string } }>("select guardian_begin_delivery($1,$2) data", [
        claim.id,
        claim.lock_token,
      ])
    ).rows[0].data;
    assert.equal(begin.mode, "text");
    await assert.rejects(
      db.query("select guardian_finish_delivery($1,$2,'sent',null,null)", [
        claim.id,
        claim.lock_token,
      ]),
      /provider_receipt_required/,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select guardian_finish_delivery($1,$2,'sent','wamid.test',null) ok",
          [claim.id, claim.lock_token],
        )
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "select guardian_finish_delivery($1,$2,'retry',null,'bad') ok",
          [claim.id, claim.lock_token],
        )
      ).rows[0].ok,
      false,
    );
    await db.query(
      "insert into guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at,status,claimed_at) values($1,$2,'weather_alert','weather','crash','{}','Crash',4,now()-interval '1 hour',now()+interval '1 day','dispatching',now()-interval '10 minutes')",
      [prop, phone],
    );
    await db.query("select * from guardian_claim_events(1)");
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from guardian_events where dedupe_key='crash'",
        )
      ).rows[0].status,
      "uncertain",
    );
    assert.ok((await db.query("select * from guardian_event_history")).rows.length >= 5);
    assert.equal(
      (
        await db.query<{ followups_enabled: boolean }>(
          "select followups_enabled from whatsapp_followup_profiles",
        )
      ).rows[0].followups_enabled,
      false,
    );
  } finally {
    await db.close();
  }
});
