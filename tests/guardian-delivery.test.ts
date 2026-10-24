import assert from "node:assert/strict";
import test from "node:test";
import { deliverGuardianMessage } from "../src/lib/guardian/delivery.ts";
import { processGuardianEvents, type EventStore } from "../src/lib/guardian/maintenance.server.ts";
import { officialWeatherEvents } from "../src/lib/guardian/weather.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import type { WeatherIntelligence } from "../src/lib/chat/weather-intelligence.server.ts";

const message = {
  id: "event",
  recipient: "5517999991111",
  message: "Pesar lote 2",
  mode: "text" as const,
};
const config = { token: "test-secret", phoneNumberId: "1234" };
test("successful delivery requires a provider receipt and uses the approved payload", async () => {
  const result = await deliverGuardianMessage(message, config, (async (url, options) => {
    assert.match(String(url), /graph.facebook.com/);
    const body = JSON.parse(String(options!.body));
    assert.equal(body.type, "text");
    assert.equal(body.to, message.recipient);
    return Response.json({ messages: [{ id: "wamid.123" }] });
  }) as typeof fetch);
  assert.deepEqual(result, { status: "sent", providerId: "wamid.123" });
});
test("outside the service window only an explicitly configured template can be used", async () => {
  let calls = 0;
  const f = (async () => {
    calls++;
    return new Response();
  }) as typeof fetch;
  assert.deepEqual(await deliverGuardianMessage({ ...message, mode: "template" }, config, f), {
    status: "failed",
    error: "approved_template_missing",
  });
  assert.equal(calls, 0);
  await deliverGuardianMessage(
    { ...message, mode: "template" },
    { ...config, templateName: "guardian_event" },
    (async (_url, options) => {
      const p = JSON.parse(String(options!.body));
      assert.equal(p.type, "template");
      assert.equal(p.template.name, "guardian_event");
      assert.equal(p.template.components[0].parameters[0].text, message.message);
      return Response.json({ messages: [{ id: "wamid.template" }] });
    }) as typeof fetch,
  );
});
for (const [status, expected] of [
  [429, "retry"],
  [400, "failed"],
  [401, "failed"],
  [500, "uncertain"],
  [503, "uncertain"],
  [408, "uncertain"],
] as const)
  test(`provider ${status} -> ${expected} without exposing response bodies`, async () => {
    const r = await deliverGuardianMessage(
      message,
      config,
      (async () =>
        new Response("Recipient 5517999991111, token test-secret", { status })) as typeof fetch,
    );
    assert.equal(r.status, expected);
    assert.doesNotMatch(JSON.stringify(r), /5517999991111|test-secret/);
  });
test("missing acceptance receipt and transport timeout stay uncertain", async () => {
  assert.equal(
    (
      await deliverGuardianMessage(message, config, (async () =>
        Response.json({ success: true })) as typeof fetch)
    ).status,
    "uncertain",
  );
  assert.equal(
    (
      await deliverGuardianMessage(message, config, (async () => {
        throw new Error("secret");
      }) as typeof fetch)
    ).status,
    "uncertain",
  );
});
test("an obsolete event is not sent and a receipt-save failure never triggers another send", async () => {
  let sends = 0,
    finishes = 0;
  const store: EventStore = {
    claim: async () => [
      { id: "old", lock_token: "l1" },
      { id: "new", lock_token: "l2" },
    ],
    begin: async (c) => (c.id === "old" ? null : message),
    finish: async () => {
      finishes++;
      throw new Error("database unavailable");
    },
  };
  const result = await processGuardianEvents({
    store,
    send: async () => {
      sends++;
      return { status: "sent", providerId: "wamid.accepted" };
    },
  });
  assert.equal(result.cancelled, 1);
  assert.equal(result.uncertain, 1);
  assert.equal(result.persistenceErrors, 1);
  assert.equal(sends, 1);
  assert.equal(finishes, 1);
});
test("weather events preserve locality, authority, time bounds and source; mismatches do not alert", () => {
  const now = new Date("2026-10-23T15:00:00Z"),
    book = emptyFarm("Boa Vista", "Monte Aprazível", "SP");
  const weather = {
    location: { city: "Monte Aprazível", uf: "SP" },
    updatedAt: now.toISOString(),
    alerts: [
      {
        event: "Tempestade",
        severity: "Severo",
        onset: "2026-10-23T14:00:00Z",
        expires: "2026-10-24T14:00:00Z",
        sourceUrl: "https://apiprevmet3.inmet.gov.br/avisos/ativos",
      },
    ],
  } as unknown as WeatherIntelligence;
  const events = officialWeatherEvents(book, weather, message.recipient, now);
  assert.equal(events.length, 1);
  assert.equal(events[0].priority, 5);
  assert.match(events[0].message, /não uma medição na fazenda/);
  assert.equal(events[0].evidence.city, "Monte Aprazível");
  assert.equal(
    officialWeatherEvents({ ...book, city: "Tanabi" }, weather, message.recipient, now).length,
    0,
  );
  assert.equal(
    officialWeatherEvents(
      book,
      { ...weather, updatedAt: "2026-10-22T10:00:00Z" },
      message.recipient,
      now,
    ).length,
    0,
  );
  assert.equal(
    officialWeatherEvents(
      book,
      {
        ...weather,
        alerts: [{ ...weather.alerts[0], sourceUrl: "https://inmet.gov.br.attacker.example/" }],
      },
      message.recipient,
      now,
    ).length,
    0,
  );
  assert.equal(
    officialWeatherEvents(
      book,
      { ...weather, alerts: [{ ...weather.alerts[0], expires: "2026-10-22T10:00:00Z" }] },
      message.recipient,
      now,
    ).length,
    0,
  );
});
