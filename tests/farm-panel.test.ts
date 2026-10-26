import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import {
  handleFarmPanel,
  handlePanelCodeRequest,
  hashToken,
  makePanelCode,
} from "../src/lib/guardian/panel.server.ts";
import { FarmBookSchema } from "../src/lib/guardian/schema.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { automaticFarmEvent } from "../src/lib/guardian/automatic.ts";

const phone = "5517999991111",
  other = "5517999992222",
  code = "ABCD2345EFGH6789",
  url = "https://tpecia.example/api/public/farm-panel";
const request = (
  method = "GET",
  body?: unknown,
  token?: string,
  origin = "https://tpecia.example",
) =>
  new Request(url, {
    method,
    headers: {
      origin,
      "x-tpec-panel": "1",
      "content-type": "application/json",
      ...(token ? { cookie: "tpec_farm_session=" + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

test("integrated PostgreSQL: spontaneous facts create a private unnamed farm, keep history, and survive a database restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "farm-persistence-"));
  let fixture = await farmIntegration(directory);
  try {
    await fixture.observe(
      phone,
      "first",
      "Minha fazenda fica em Tanabi e tenho 40 cabeças de gado.",
    );
    let snapshot = await fixture.guardian.load(phone);
    assert.equal(snapshot.properties.length, 1);
    assert.equal(snapshot.active!.book.name, null);
    assert.equal(snapshot.active!.book.uf, null);
    assert.equal(snapshot.active!.book.city, "Tanabi");
    FarmBookSchema.parse(snapshot.active!.book);
    await fixture.observe(phone, "later", "Agora tenho 52 cabeças.", "2026-10-26T15:00:00Z");
    await fixture.observe(
      phone,
      "first",
      "Minha fazenda fica em Tanabi e tenho 40 cabeças de gado.",
    );
    snapshot = await fixture.guardian.load(phone);
    assert.deepEqual(
      snapshot.active!.book.operations!.counts.map((c) => c.count),
      [40, 52],
    );
    assert.equal(snapshot.active!.book.operations!.movements.length, 0);
    assert.equal(stockAt(snapshot.active!.book.operations!, "2026-10-26").count, 52);
    await fixture.observe(phone, "category", "Tenho 12 vacas.", "2026-10-26T16:00:00Z");
    const categories = (await fixture.guardian.load(phone)).active!.book.operations!
      .categoryCounts!;
    assert.equal(categories[0].category, "cows");
    assert.equal(categories[0].count, 12);
    assert.equal(
      stockAt((await fixture.guardian.load(phone)).active!.book.operations!, "2026-10-26").count,
      52,
    );
    assert.equal(
      await fixture.observe(phone, "hypothesis", "Se eu tivesse 300 bois, quanto gastaria?"),
      null,
    );
    assert.equal(await fixture.observe(phone, "neighbor", "Meu vizinho tem 150 bois."), null);
    assert.equal((await fixture.guardian.load(other)).properties.length, 0);
    const id = snapshot.active!.id;
    await fixture.db.close();
    fixture = await farmIntegration(directory, true);
    assert.equal((await fixture.guardian.load(phone)).active!.id, id);
    assert.equal((await fixture.guardian.load(phone)).active!.book.operations!.counts.length, 2);
  } finally {
    await fixture.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("integrated PostgreSQL: WhatsApp code exchange, scoped browser edits, stale versions, replay, logout, role revocation and anonymous denial", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(phone, "first", "Minha fazenda fica em Tanabi e tenho 40 cabeças.");
    await f.observe(other, "other", "Minha fazenda fica em Votuporanga e tenho 70 cabeças.");
    const property = (await f.guardian.load(phone)).active!;
    const reply = await handlePanelCodeRequest(
      { phone, messageId: "code", text: "gerar código do painel" },
      { load: f.guardian.load, issue: f.issue, code: () => code },
    );
    assert.match(reply!, /ABCD-2345-EFGH-6789/);
    assert.equal(
      (
        await f.db.query("select * from guardian_panel_codes where token_hash=$1", [
          hashToken(code),
        ])
      ).rows.length,
      1,
    );
    const config = { store: f.store, enabled: true };
    assert.equal((await handleFarmPanel(request(), config)).status, 401);
    assert.equal(
      (
        await handleFarmPanel(
          request("POST", { kind: "exchange", code }, undefined, "https://attacker.example"),
          config,
        )
      ).status,
      403,
    );
    const login = await handleFarmPanel(request("POST", { kind: "exchange", code }), config);
    assert.equal(login.status, 200);
    assert.match(
      login.headers.get("set-cookie")!,
      /HttpOnly; SameSite=Strict; Max-Age=43200; Secure/,
    );
    assert.match(login.headers.get("cache-control")!, /no-store/);
    const token = login.headers.get("set-cookie")!.match(/tpec_farm_session=([a-f0-9]+)/)![1];
    assert.equal(
      (await handleFarmPanel(request("POST", { kind: "exchange", code }), config)).status,
      401,
    );
    const read = await handleFarmPanel(request("GET", undefined, token), config);
    const body = await read.json();
    assert.equal(body.propertyId, property.id);
    assert.equal(body.book.city, "Tanabi");
    assert.ok(!JSON.stringify(body).includes(phone));
    assert.ok(!JSON.stringify(body).includes(other));
    const action = {
      kind: "action",
      requestId: randomUUID(),
      version: body.version,
      action: {
        kind: "ledger",
        direction: "expense",
        amountCents: 15050,
        date: "2026-10-26",
        description: "Ração",
      },
    };
    assert.equal((await handleFarmPanel(request("POST", action, token), config)).status, 200);
    const updated = (await f.guardian.load(phone)).active!;
    assert.equal(updated.book.ledger[0].amountCents, 15050);
    assert.equal((await f.guardian.load(other)).active!.book.ledger.length, 0);
    assert.equal((await handleFarmPanel(request("POST", action, token), config)).status, 200);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
    assert.equal(
      (
        await handleFarmPanel(
          request("POST", { ...action, requestId: randomUUID() }, token),
          config,
        )
      ).status,
      409,
    );
    const scoped = {
      ...action,
      requestId: randomUUID(),
      propertyId: (await f.guardian.load(other)).active!.id,
    };
    assert.equal((await handleFarmPanel(request("POST", scoped, token), config)).status, 400);
    await f.db.query(
      "update guardian_members set role='worker' where property_id=$1 and phone_number=$2",
      [property.id, phone],
    );
    assert.equal(
      (
        await handleFarmPanel(
          request("POST", { ...action, version: updated.version, requestId: randomUUID() }, token),
          config,
        )
      ).status,
      403,
    );
    await f.db.query(
      "update guardian_members set active=false where property_id=$1 and phone_number=$2",
      [property.id, phone],
    );
    assert.equal((await handleFarmPanel(request("GET", undefined, token), config)).status, 401);
    await f.db.exec("SET ROLE anon");
    await assert.rejects(f.db.query("select * from guardian_panel_codes"), /permission denied/);
    await assert.rejects(
      f.db.query("select guardian_panel_authorize($1)", [hashToken(token)]),
      /permission denied/,
    );
    await f.db.exec("RESET ROLE");
    assert.equal((await handleFarmPanel(request("DELETE", undefined, token), config)).status, 200);
    assert.ok(
      (await f.db.query<{ revoked_at: string }>("select revoked_at from guardian_panel_sessions"))
        .rows[0].revoked_at,
    );
  } finally {
    await f.db.close();
  }
});

test("integrated PostgreSQL: expired codes, expired sessions, durable rate limits and multiple-farm selection", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(
      phone,
      "one",
      "Minha fazenda se chama Boa Vista. Minha fazenda fica em Tanabi/SP.",
    );
    await f.observe(phone, "two", "Tenho outra fazenda chamada Santa Rita em Votuporanga/SP.");
    const snapshot = await f.guardian.load(phone);
    assert.equal(snapshot.properties.length, 2);
    const deps = { load: f.guardian.load, issue: f.issue, code: () => code };
    const choice = await handlePanelCodeRequest(
      { phone, messageId: "multi", text: "gerar código do painel" },
      deps,
    );
    assert.match(choice!, /Escolha a fazenda/);
    assert.equal((await f.db.query("select * from guardian_panel_codes")).rows.length, 0);
    await handlePanelCodeRequest(
      { phone, messageId: "chosen", text: "gerar código do painel para 2" },
      deps,
    );
    await f.db.exec("UPDATE guardian_panel_codes SET expires_at=now()-interval '1 minute'");
    assert.equal(await f.store.exchange(hashToken(code), hashToken("expired")), false);
    for (let i = 0; i < 20; i++) assert.equal(await f.store.attempt(hashToken("ip")), true);
    assert.equal(await f.store.attempt(hashToken("ip")), false);
    await f.issue(phone, snapshot.properties[0].id, "fresh", hashToken("other-code"));
    assert.equal(await f.store.exchange(hashToken("other-code"), hashToken("session")), true);
    await f.db.exec("UPDATE guardian_panel_sessions SET expires_at=now()-interval '1 second'");
    assert.equal(await f.store.authorize(hashToken("session")), null);
    assert.equal(makePanelCode().length, 16);
  } finally {
    await f.db.close();
  }
});

test("integrated PostgreSQL: the additive migration backfills existing private facts without inventing a name or dropping history", async () => {
  const f = await farmIntegration(undefined, false, async (db) => {
    await db.query("select guardian_observe_property($1,$2,$3,$4,null,false,$5)", [
      phone,
      "before-upgrade",
      "2026-10-25T15:00:00Z",
      "Minha fazenda fica em Tanabi e tenho 40 cabeças.",
      [
        {
          field: "city",
          value: "Tanabi",
          quote: "Minha fazenda fica em Tanabi e tenho 40 cabeças.",
          effectiveDate: "2026-10-25",
        },
        {
          field: "herdTotal",
          value: 40,
          quote: "Minha fazenda fica em Tanabi e tenho 40 cabeças.",
          effectiveDate: "2026-10-25",
        },
      ],
    ]);
  });
  try {
    const snapshot = await f.guardian.load(phone);
    assert.equal(snapshot.properties.length, 1);
    assert.equal(snapshot.active!.book.name, null);
    assert.equal(snapshot.active!.book.city, "Tanabi");
    assert.equal(snapshot.active!.book.operations!.counts[0].count, 40);
    assert.equal((await f.db.query("select * from guardian_observed_facts")).rows.length, 2);
  } finally {
    await f.db.close();
  }
});

test("integrated PostgreSQL: an existing explicitly registered owner farm is reused by spontaneous facts", async () => {
  const f = await farmIntegration();
  try {
    await handleGuardianMessage(
      { phone, messageId: "create", text: "cadastrar fazenda Boa Vista em Tanabi/SP" },
      { store: f.guardian },
    );
    await handleGuardianMessage(
      { phone, messageId: "confirm", text: "confirmar" },
      { store: f.guardian },
    );
    const id = (await f.guardian.load(phone)).active!.id;
    await f.observe(phone, "natural", "Minha fazenda se chama Boa Vista. Tenho 40 cabeças.");
    const snapshot = await f.guardian.load(phone);
    assert.equal(snapshot.properties.length, 1);
    assert.equal(snapshot.active!.id, id);
    assert.equal(snapshot.active!.book.operations!.counts[0].count, 40);
    assert.equal(snapshot.active!.book.name, "Boa Vista");
  } finally {
    await f.db.close();
  }
});

test("integrated PostgreSQL: resetting conversation context keeps the operational farm identity and never revives an old source", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(
      phone,
      "before-reset",
      "Minha fazenda fica em Tanabi e tenho 40 cabeças.",
      "2026-10-25T15:00:00Z",
    );
    const original = (await f.guardian.load(phone)).active!;
    assert.equal(
      (await f.guardian.load(phone)).properties[0].name,
      "Propriedade sem nome — Tanabi",
    );
    await f.db.query(
      "insert into whatsapp_followup_profiles(phone_number,context_reset_at) values($1,'2026-10-26T00:00:00Z')",
      [phone],
    );
    await f.observe(phone, "after-reset", "Agora tenho 52 cabeças.", "2026-10-26T15:00:00Z");
    const updated = await f.guardian.load(phone);
    assert.equal(updated.properties.length, 1);
    assert.equal(updated.active!.id, original.id);
    assert.equal(updated.active!.book.city, "Tanabi");
    assert.deepEqual(
      updated.active!.book.operations!.counts.map((c) => c.count),
      [40, 52],
    );
    assert.equal(
      (await f.observe(phone, "late-old-source", "Tenho 40 cabeças.", "2026-10-25T16:00:00Z"))!
        .status,
      "reset",
    );
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.counts.length, 2);
    await f.observe(
      phone,
      "second-property",
      "Tenho outra fazenda chamada Santa Rita em Votuporanga/SP. Tenho 20 cabeças.",
      "2026-10-26T15:30:00Z",
    );
    await f.db.query(
      "update whatsapp_followup_profiles set context_reset_at='2026-10-26T16:00:00Z' where phone_number=$1",
      [phone],
    );
    const ambiguous = await f.observe(
      phone,
      "ambiguous-after-reset",
      "Agora tenho 60 cabeças.",
      "2026-10-26T16:30:00Z",
    );
    assert.equal(ambiguous!.status, "ambiguous_property");
    const multiple = await f.guardian.load(phone);
    assert.equal(multiple.properties.length, 2);
    assert.equal(multiple.active!.id, original.id);
    assert.equal(multiple.active!.book.operations!.counts.length, 2);
    assert.deepEqual(
      automaticFarmEvent(
        { text: "Agora tenho 60 cabeças.", at: new Date("2026-10-26T16:30:00Z") },
        multiple,
      ),
      { status: "pending", reason: "ambiguous_property" },
    );
  } finally {
    await f.db.close();
  }
});
