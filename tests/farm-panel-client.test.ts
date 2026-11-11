import assert from "node:assert/strict";
import test from "node:test";
import { createPanelClient } from "../src/lib/guardian/panel-client.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a delayed cookie refresh finishes before logout and fresh-link entry, so the new session wins", async () => {
  const refresh = deferred<Response>(),
    started = deferred<void>();
  const calls: string[] = [];
  let cookie = "old",
    refreshed = false;
  const api = createPanelClient(async (_url, init) => {
    const method = init?.method ?? "GET";
    calls.push(method);
    if (method === "GET" && !refreshed) {
      refreshed = true;
      started.resolve();
      const result = await refresh.promise;
      cookie = "old"; // Simulate the delayed Set-Cookie from an old session.
      return result;
    }
    if (method === "DELETE") cookie = "";
    if (method === "POST") cookie = "fresh";
    return json({ cookie });
  });
  const pending = api();
  await started.promise;
  const logout = api("DELETE"),
    login = api("POST", { kind: "link_exchange", token: "new-link" }),
    read = api();
  assert.deepEqual(calls, ["GET"]);
  refresh.resolve(json({ cookie: "old" }));
  await Promise.all([pending, logout, login]);
  assert.deepEqual(await read, { cookie: "fresh" });
  assert.deepEqual(calls, ["GET", "DELETE", "POST", "GET"]);
});

test("duplicate pending links exchange once, but a consumed link after logout never reuses a cached success", async () => {
  const response = deferred<Response>(),
    started = deferred<void>();
  let count = 0;
  const api = createPanelClient(async (_url, init) => {
    if (init?.method === "DELETE") return json({ ok: true });
    count++;
    if (count === 1) {
      started.resolve();
      return response.promise;
    }
    return json({ error: "Link já utilizado." }, 401);
  });
  const body = { kind: "link_exchange", token: "one-use-link" };
  const first = api("POST", body);
  await started.promise;
  const second = api("POST", body);
  response.resolve(json({ ok: true }));
  await Promise.all([first, second]);
  assert.equal(count, 1);
  await api("DELETE");
  await assert.rejects(api("POST", body), { message: "Link já utilizado.", status: 401 });
  assert.equal(count, 2);
});

test("an expired link does not block the next fresh link, and startup cannot mix app and browser cookies", async () => {
  const modes: string[] = [];
  let installed = true,
    calls = 0;
  const api = createPanelClient(
    async (_url, init) => {
      modes.push(new Headers(init?.headers).get("x-tpec-panel-mode")!);
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.cache, "no-store");
      calls++;
      return calls === 1 ? json({ error: "Link expirado." }, 401) : json({ ok: true });
    },
    () => installed,
  );
  await assert.rejects(api("POST", { kind: "link_exchange", token: "expired" }), { status: 401 });
  installed = false;
  await api("POST", { kind: "link_exchange", token: "fresh" });
  await api();
  await api("DELETE", { kind: "logout_all" });
  assert.deepEqual(modes, ["installed", "installed", "installed", "installed"]);
});
