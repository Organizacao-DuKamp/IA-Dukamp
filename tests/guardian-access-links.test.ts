import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { emptyFarm, canEdit } from "../src/lib/guardian/schema.ts";
import {
  handleFarmPanel,
  handlePanelLinkRequest,
  hashToken,
} from "../src/lib/guardian/panel.server.ts";
import { handleAccessInvite } from "../src/lib/guardian/access-links.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { panelAccessRequest } from "../src/lib/guardian/panel-access.ts";
import { readAccessFragment, invitationWhatsApp } from "../src/lib/guardian/access-link.ts";
import { androidAppLinks } from "../src/lib/guardian/android-app-links.ts";

const owner = "5517999900001",
  employee = "5517999900002",
  other = "5517999900003";
const token = (phone: string, message: string, kind: string) =>
  createHash("sha256").update([phone, message, kind].join(":")).digest("hex");
const request = (method = "GET", body?: unknown, cookie?: string, installed = false) =>
  new Request("https://farm.test/api/public/farm-panel", {
    method,
    headers: {
      origin: "https://farm.test",
      "x-tpec-panel": "1",
      "content-type": "application/json",
      "x-tpec-panel-mode": installed ? "installed" : "browser",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
async function seed(f: Awaited<ReturnType<typeof farmIntegration>>, phone = owner) {
  const id = randomUUID();
  await f.guardian.commit({
    phone,
    messageId: "seed",
    accountVersion: 0,
    propertyId: id,
    propertyVersion: null,
    operation: "create",
    book: emptyFarm("Boa Vista", "Tanabi", "SP"),
    pending: null,
    reply: "ok",
  });
  return id;
}
async function login(
  f: Awaited<ReturnType<typeof farmIntegration>>,
  phone: string,
  property: string,
  message: string,
  installed = false,
) {
  const value = token(phone, message, "login");
  assert.equal(
    await f.store.links!.issue(phone, property, message, hashToken(value), "login"),
    true,
  );
  const result = await handleFarmPanel(
    request("POST", { kind: "link_exchange", token: value }, undefined, installed),
    { store: f.store, enabled: true },
  );
  assert.equal(result.status, 200);
  return result.headers.get("set-cookie")!.split(";")[0];
}

test("link requests, private fragments and Android domain association reject unrelated/unsafe input", () => {
  for (const text of [
    "gerar link do painel",
    "me manda um link do painel da fazenda Boa Vista",
    "Quero abrir o painel da fazenda Boa Vista",
  ])
    assert.ok(panelAccessRequest(text), text);
  for (const text of ["não quero link do painel", "meu vizinho quer um link do painel"])
    assert.equal(panelAccessRequest(text), null);
  assert.deepEqual(readAccessFragment("#login=" + "a".repeat(64)), {
    kind: "login",
    token: "a".repeat(64),
  });
  assert.equal(readAccessFragment("#login=short"), null);
  assert.equal(readAccessFragment("#invite=" + "a".repeat(64) + "&phone=" + owner), null);
  assert.match(invitationWhatsApp("a".repeat(64)), /aceitar%20convite/);
  assert.deepEqual(androidAppLinks("placeholder,https://evil.example"), []);
  const fingerprint = Array(32).fill("AB").join(":");
  assert.deepEqual(
    androidAppLinks(fingerprint + "," + fingerprint)[0].target.sha256_cert_fingerprints,
    [fingerprint],
  );
});

test("SQL + HTTP: one-use links, durable web/app sessions, CSRF, expiry, hashed storage and logout", async () => {
  const f = await farmIntegration();
  try {
    const property = await seed(f);
    const value = token(owner, "link", "login");
    const reply = await handlePanelLinkRequest(
      { phone: owner, messageId: "link", text: "gerar link do painel" },
      { load: f.guardian.load, links: f.store.links, token: () => value },
    );
    assert.match(reply!, new RegExp("#login=" + value));
    assert.equal(
      await f.store.links!.issue(owner, property, "link", hashToken(value), "login"),
      true,
    );
    assert.equal(
      (await f.db.query("select token_hash from guardian_access_links")).rows[0].token_hash,
      hashToken(value),
    );
    const csrf = request("POST", { kind: "link_exchange", token: value });
    csrf.headers.set("origin", "https://evil.test");
    assert.equal((await handleFarmPanel(csrf, { store: f.store, enabled: true })).status, 403);
    const result = await handleFarmPanel(request("POST", { kind: "link_exchange", token: value }), {
      store: f.store,
      enabled: true,
    });
    assert.equal(result.status, 200);
    assert.match(
      result.headers.get("set-cookie")!,
      /HttpOnly; SameSite=Strict; Max-Age=31536000; Secure/,
    );
    const cookie = result.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (
        await handleFarmPanel(request("POST", { kind: "link_exchange", token: value }, cookie), {
          store: f.store,
          enabled: true,
        })
      ).status,
      200,
    );
    await f.db.query(
      "update guardian_access_links set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where token_hash=$1",
      [hashToken(value)],
    );
    assert.equal(
      (
        await handleFarmPanel(request("POST", { kind: "link_exchange", token: value }, cookie), {
          store: f.store,
          enabled: true,
        })
      ).status,
      200,
    );

    assert.equal(
      (
        await handleFarmPanel(request("POST", { kind: "link_exchange", token: value }), {
          store: f.store,
          enabled: true,
        })
      ).status,
      401,
    );
    await f.db.exec(
      "UPDATE guardian_panel_sessions SET created_at=now()-interval '3 days',last_renewed_at=now()-interval '3 days',expires_at=now()+interval '1 day'",
    );
    const reopened = await handleFarmPanel(request("GET", undefined, cookie), {
      store: f.store,
      enabled: true,
    });
    assert.equal(reopened.status, 200);
    assert.match(reopened.headers.get("set-cookie")!, /Max-Age=31536000/);
    assert.equal(
      (
        await handleFarmPanel(request("GET", undefined, cookie, true), {
          store: f.store,
          enabled: true,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await handleFarmPanel(request("DELETE", undefined, cookie), {
          store: f.store,
          enabled: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await handleFarmPanel(request("GET", undefined, cookie), { store: f.store, enabled: true }))
        .status,
      401,
    );
    const expired = token(owner, "expired", "login");
    await f.store.links!.issue(owner, property, "expired", hashToken(expired), "login");
    await f.db.query(
      "update guardian_access_links set created_at=now()-interval '1 day',expires_at=now()-interval '1 minute' where token_hash=$1",
      [hashToken(expired)],
    );
    assert.equal(
      await f.store.links!.exchange(hashToken(expired), hashToken("session"), false),
      false,
    );
    await f.db.exec("SET ROLE anon");
    await assert.rejects(f.db.query("select * from guardian_access_links"), /permission denied/);
    await assert.rejects(
      f.db.query("select guardian_access_accept($1,$2,$3,$4)", [
        hashToken(expired),
        other,
        "attack",
        hashToken("new"),
      ]),
      /permission denied/,
    );
    await f.db.exec("RESET ROLE");
  } finally {
    await f.db.close();
  }
});

test("SQL + WhatsApp + HTTP: verified invite, complete management access, owner team control, revocation and rejoin cannot revive sessions", async () => {
  const f = await farmIntegration();
  try {
    const property = await seed(f);
    const ownerCookie = await login(f, owner, property, "owner-session");
    const ownerSession = hashToken(ownerCookie.split("=")[1]);
    const invite = token(owner, "invite", "invite");
    const deps = { load: f.guardian.load, links: f.store.links, token };
    const reply = await handleAccessInvite(
      { phone: owner, messageId: "invite", text: "gerar link de convite para funcionário" },
      deps,
    );
    assert.match(reply!, new RegExp("#invite=" + invite));
    assert.equal((await f.guardian.load(employee)).properties.length, 0);
    // A GET/link preview cannot grant membership. Only this verified WhatsApp sender accepts.
    const accept = () =>
      handleAccessInvite(
        { phone: employee, messageId: "accept", text: "aceitar convite " + invite },
        deps,
      );
    assert.match((await accept())!, /Convite aceito/);
    assert.match((await accept())!, /Convite aceito/);
    assert.match(
      (await handleAccessInvite(
        { phone: other, messageId: "steal", text: "aceitar convite " + invite },
        deps,
      ))!,
      /já foi usado/,
    );
    const snapshot = await f.guardian.load(employee);
    assert.equal(snapshot.active!.id, property);
    assert.equal(snapshot.active!.role, "manager");
    assert.equal(
      canEdit(snapshot.active!.role, {
        kind: "ledger",
        direction: "expense",
        amountCents: 100,
        date: "2026-11-11",
        description: "Ração",
      }),
      true,
    );
    assert.equal(snapshot.active!.book.employees![0].phone, employee);
    const access = token(employee, "accept", "login");
    const res = await handleFarmPanel(
      request("POST", { kind: "link_exchange", token: access }, undefined, true),
      { store: f.store, enabled: true },
    );
    assert.equal(res.status, 200);
    const employeeCookie = res.headers.get("set-cookie")!.split(";")[0],
      employeeSession = hashToken(employeeCookie.split("=")[1]);
    const action = {
      kind: "action",
      version: snapshot.active!.version,
      requestId: randomUUID(),
      action: {
        kind: "ledger",
        direction: "expense",
        amountCents: 15000,
        date: "2026-11-11",
        description: "Ração",
      },
    };
    assert.equal(
      (
        await handleFarmPanel(request("POST", action, employeeCookie, true), {
          store: f.store,
          enabled: true,
        })
      ).status,
      200,
    );
    assert.equal((await f.guardian.load(owner)).active!.book.ledger.length, 1);
    assert.equal(
      (
        await handleFarmPanel(request("GET", undefined, employeeCookie, true), {
          store: f.store,
          enabled: true,
        })
      ).status,
      200,
    );
    const employeeView = await (
      await handleFarmPanel(request("GET", undefined, employeeCookie, true), {
        store: f.store,
        enabled: true,
      })
    ).json();
    assert.equal(employeeView.team, undefined);
    await assert.rejects(f.store.links!.team(employeeSession), /guardian_access_denied/);
    assert.equal(await f.store.links!.revoke(employeeSession, owner), false);
    assert.equal(await f.store.links!.revoke(ownerSession, owner), false);
    const team = await f.store.links!.team(ownerSession);
    assert.equal(team.members.filter((m) => m.phone === employee && m.active).length, 1);
    const oldUnused = token(owner, "old-unused", "invite");
    await f.store.links!.issue(owner, property, "old-unused", hashToken(oldUnused), "invite");
    const remove = await handleFarmPanel(
      request("POST", { kind: "team_revoke", phone: employee }, ownerCookie),
      { store: f.store, enabled: true },
    );
    assert.equal(remove.status, 200);
    assert.equal(
      (
        await handleFarmPanel(request("GET", undefined, employeeCookie, true), {
          store: f.store,
          enabled: true,
        })
      ).status,
      401,
    );
    assert.equal((await f.guardian.load(employee)).properties.length, 0);
    assert.equal((await f.guardian.load(owner)).active!.book.employees![0].active, false);
    assert.match((await accept())!, /já foi usado/);
    assert.equal(
      await f.store.links!.accept(
        hashToken(oldUnused),
        employee,
        "bypass-revoke",
        hashToken("bypass"),
      ),
      null,
    );
    const second = token(owner, "invite-2", "invite");
    await f.store.links!.issue(owner, property, "invite-2", hashToken(second), "invite");
    await handleAccessInvite(
      { phone: employee, messageId: "accept-2", text: "aceitar convite " + second },
      deps,
    );
    assert.equal((await f.guardian.load(employee)).active!.id, property);
    assert.equal(
      (
        await handleFarmPanel(request("GET", undefined, employeeCookie, true), {
          store: f.store,
          enabled: true,
        })
      ).status,
      401,
    );
    const newCookie = await login(f, employee, property, "employee-new");
    // Existing WhatsApp revoke action uses the same invalidation trigger.
    const revoke = await handleGuardianMessage(
      { phone: owner, messageId: "remove", text: "revogar acesso " + employee },
      { store: f.guardian, now: new Date("2026-11-11T15:00:00Z") },
    );
    assert.match(revoke!.reply!, /confir/i);
    await handleGuardianMessage(
      { phone: owner, messageId: "confirm-remove", text: "confirmar" },
      { store: f.guardian, now: new Date("2026-11-11T15:01:00Z") },
    );
    assert.equal(
      (
        await handleFarmPanel(request("GET", undefined, newCookie), {
          store: f.store,
          enabled: true,
        })
      ).status,
      401,
    );
  } finally {
    await f.db.close();
  }
});

test("invitation scopes, cancellations and complete logout invalidate pending access", async () => {
  const f = await farmIntegration();
  try {
    const property = await seed(f);
    const otherProperty = await seed(f, other);
    const ownerCookie = await login(f, owner, property, "session");
    const deps = { load: f.guardian.load, links: f.store.links, token };
    for (const text of [
      "como convidar funcionário?",
      "não quero gerar link de convite para funcionário",
      "meu vizinho quer convidar funcionário",
    ])
      assert.equal(await handleAccessInvite({ phone: owner, messageId: text, text }, deps), null);
    assert.match(
      (await handleAccessInvite(
        {
          phone: owner,
          messageId: "unknown",
          text: "gerar link de convite para funcionário da fazenda Inexistente",
        },
        deps,
      ))!,
      /Selecione/,
    );
    await assert.rejects(
      f.store.links!.issue(employee, property, "denied", hashToken("denied"), "invite"),
      /guardian_access_denied/,
    );
    const invite = token(owner, "cancel", "invite");
    await f.store.links!.issue(owner, property, "cancel", hashToken(invite), "invite");
    const team = await f.store.links!.team(hashToken(ownerCookie.split("=")[1]));
    const otherCookie = await login(f, other, otherProperty, "session");
    assert.equal(
      await f.store.links!.cancel(hashToken(otherCookie.split("=")[1]), team.invitations[0].id),
      false,
    );
    assert.equal(
      await f.store.links!.cancel(hashToken(ownerCookie.split("=")[1]), team.invitations[0].id),
      true,
    );
    assert.equal(
      await f.store.links!.accept(hashToken(invite), employee, "cancelled", hashToken("login")),
      null,
    );
    const pending = token(owner, "unused", "login");
    await f.store.links!.issue(owner, property, "unused", hashToken(pending), "login");
    const logout = request("DELETE", undefined, ownerCookie);
    logout.headers.set("x-tpec-panel-all", "1");
    assert.equal((await handleFarmPanel(logout, { store: f.store, enabled: true })).status, 200);
    assert.equal(
      await f.store.links!.exchange(hashToken(pending), hashToken("unused-session"), false),
      false,
    );
  } finally {
    await f.db.close();
  }
});
