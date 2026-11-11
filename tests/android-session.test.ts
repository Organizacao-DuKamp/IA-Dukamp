import assert from "node:assert/strict";
import test from "node:test";
import { persistAndroidSession } from "../src/lib/guardian/android-session.ts";
import { createPanelClient } from "../src/lib/guardian/panel-client.ts";

test("a native disk acknowledgement finishes entry without exposing credentials or navigating", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  const messages: unknown[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      location: { replace: () => assert.fail("native acknowledgement must not navigate") },
      TpecAndroid: {
        postMessage(raw: string) {
          const message = JSON.parse(raw);
          messages.push(message);
          target.dispatchEvent(
            new CustomEvent("tpec:session-persisted", { detail: { requestId: message.requestId } }),
          );
        },
      },
    },
  });
  try {
    await persistAndroidSession();
    assert.equal(messages.length, 1);
    assert.deepEqual(Object.keys(messages[0] as object).sort(), ["loggedOut", "requestId", "type"]);
    assert.equal((messages[0] as { loggedOut: boolean }).loggedOut, false);
    assert.equal((messages[0] as { type: string }).type, "persist_session");
    messages.length = 0;
    await persistAndroidSession(true);
    assert.deepEqual(
      messages.map((message) => (message as { type: string }).type),
      ["disconnect", "persist_session"],
    );
    assert.equal((messages[1] as { loggedOut: boolean }).loggedOut, true);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("entry and logout wait for persistence; ordinary restores do not navigate or rewrite a login link", async () => {
  const calls: string[] = [];
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let written = 0;
  const api = createPanelClient(
    async (_url, init) => {
      calls.push(init?.method ?? "GET");
      return Response.json({ ok: true });
    },
    () => true,
    async () => {
      written++;
      if (written === 1) await pending;
    },
  );
  const entering = api("POST", { kind: "link_exchange", token: "private-link" });
  const restored = api();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["POST"]);
  resume();
  await Promise.all([entering, restored]);
  await api("DELETE");
  assert.equal(written, 2);
  assert.deepEqual(calls, ["POST", "GET", "DELETE"]);
});

test("only an unauthorized session read clears the native backup; transient failures and invalid links preserve it", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const messages: unknown[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { TpecAndroid: { postMessage: (raw: string) => messages.push(JSON.parse(raw)) } },
  });
  try {
    const api = createPanelClient(
      async (_url, init) => {
        if (init?.method === "POST")
          return Response.json({ error: "Invalid link" }, { status: 401 });
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      },
      () => true,
      async () => {},
    );
    await assert.rejects(api("POST", { kind: "link_exchange", token: "invalid" }));
    assert.deepEqual(messages, []);
    await assert.rejects(api());
    assert.deepEqual(messages, [{ type: "forget_session" }]);
    messages.length = 0;
    const unavailable = createPanelClient(async () =>
      Response.json({ error: "Unavailable" }, { status: 503 }),
    );
    await assert.rejects(unavailable());
    const offline = createPanelClient(async () => {
      throw new TypeError("Offline");
    });
    await assert.rejects(offline());
    assert.deepEqual(messages, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
