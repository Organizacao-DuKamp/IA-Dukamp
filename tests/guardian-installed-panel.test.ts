import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { handleFarmPanel, hashToken, browserSessionAge } from "../src/lib/guardian/panel.server.ts";
const phone = "000000000000095",
  code = "ABCD2345EFGH6789",
  url = "https://tpecia.example/api/public/farm-panel";
function req(method: string, installed: boolean, cookie?: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      origin: "https://tpecia.example",
      "content-type": "application/json",
      "x-tpec-panel": "1",
      "x-tpec-panel-mode": installed ? "installed" : "browser",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
test("daily browser duration is the next midnight in Brazil", () => {
  assert.equal(browserSessionAge(new Date("2026-10-28T12:00:00Z")), 15 * 3600);
  assert.equal(browserSessionAge(new Date("2026-10-29T02:59:30Z")), 30);
});
test("installed sessions renew across days, remain separate from browser sessions, and respect logout and membership", async () => {
  const f = await farmIntegration();
  try {
    const id = randomUUID();
    await f.guardian.commit({
      phone,
      messageId: "create",
      accountVersion: 0,
      propertyId: id,
      propertyVersion: null,
      operation: "create",
      book: emptyFarm("Fazenda QA instalada", "Tanabi", "SP"),
      pending: null,
      reply: "ok",
    });
    const deps = { store: f.store, enabled: true };
    await f.issue(phone, id, "app-code", hashToken(code));
    const login = await handleFarmPanel(
      req("POST", true, undefined, { kind: "exchange", code }),
      deps,
    );
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.match(cookie, /^tpec_farm_app_session=/);
    assert.match(
      login.headers.get("set-cookie")!,
      /HttpOnly; SameSite=Strict; Max-Age=31536000; Secure/,
    );
    assert.equal(
      (await handleFarmPanel(req("POST", true, undefined, { kind: "exchange", code }), deps))
        .status,
      401,
    );
    assert.equal((await handleFarmPanel(req("GET", false, cookie), deps)).status, 401);
    assert.equal(
      (
        await handleFarmPanel(
          req("GET", false, cookie.replace("tpec_farm_app_session", "tpec_farm_session")),
          deps,
        )
      ).status,
      401,
    );
    await f.db.exec(
      "UPDATE guardian_panel_sessions SET created_at=now()-interval '2 days',last_renewed_at=now()-interval '2 days',expires_at=now()+interval '1 day' WHERE installed",
    );
    const reopen = await handleFarmPanel(req("GET", true, cookie), deps);
    assert.equal(reopen.status, 200);
    assert.match(reopen.headers.get("set-cookie")!, /Max-Age=31536000/);
    assert.ok(Date.parse((await reopen.json()).expiresAt) > Date.now() + 364 * 86400000);
    const token = cookie.split("=")[1];
    const stored = await f.rpc<{ token: string }>(
      "select jsonb_build_object('token',token_hash) data from guardian_panel_sessions where installed",
    );
    assert.equal(stored.token, hashToken(token));
    assert.equal((await handleFarmPanel(req("DELETE", true, cookie), deps)).status, 200);
    assert.equal((await handleFarmPanel(req("GET", true, cookie), deps)).status, 401);
    await f.db.query("delete from guardian_panel_codes where phone_number=$1", [phone]);
    await f.issue(phone, id, "browser-code", hashToken(code));
    const browser = await handleFarmPanel(
      req("POST", false, undefined, { kind: "exchange", code }),
      deps,
    );
    const webCookie = browser.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await handleFarmPanel(req("GET", true, webCookie), deps)).status, 401);
    const expiry = await f.rpc<boolean>(
      "select bool_and((expires_at at time zone 'America/Sao_Paulo')::time='00:00:00') data from guardian_panel_sessions where not installed",
    );
    assert.equal(expiry, true);
    await f.db.query("delete from guardian_panel_codes where phone_number=$1", [phone]);
    await f.issue(phone, id, "app-new", hashToken(code));
    const again = await handleFarmPanel(
      req("POST", true, undefined, { kind: "exchange", code }),
      deps,
    );
    await f.db.query("update guardian_members set active=false where property_id=$1", [id]);
    assert.equal(
      (
        await handleFarmPanel(
          req("GET", true, again.headers.get("set-cookie")!.split(";")[0]),
          deps,
        )
      ).status,
      401,
    );
    await f.db.query("update guardian_members set active=true where property_id=$1", [id]);
    const allRequest = req("DELETE", true, again.headers.get("set-cookie")!.split(";")[0]);
    allRequest.headers.set("x-tpec-panel-all", "1");
    assert.equal((await handleFarmPanel(allRequest, deps)).status, 200);
    assert.equal((await handleFarmPanel(req("GET", false, webCookie), deps)).status, 401);
  } finally {
    await f.db.close();
  }
});
