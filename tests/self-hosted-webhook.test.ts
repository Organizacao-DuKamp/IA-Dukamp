import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleEnhancedWhatsAppWebhookRequest } from "../src/lib/whatsapp/enhanced-http.server.ts";

const secret = "fixture-meta";
const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "phone-id" },
            messages: [
              { from: "5517999999999", id: "wamid-fixture", type: "text", text: { body: "Oi" } },
            ],
          },
        },
      ],
    },
  ],
});
function request() {
  return new Request("https://www.tpecia.com.br/api/public/whatsapp", {
    method: "POST",
    headers: {
      "x-hub-signature-256": "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  });
}

test("durable worker returns retryable failure on claim outage without sending an untracked reply", async () => {
  let sends = 0;
  const result = await handleEnhancedWhatsAppWebhookRequest(request(), {
    env: { WHATSAPP_APP_SECRET: secret },
    durableQueue: true,
    controlMessage: async () => {
      throw Error("database-unavailable");
    },
    fetchImpl: async () => {
      sends++;
      return Response.json({});
    },
  });
  assert.equal(result.status, 503);
  assert.equal(sends, 0);
});

test("message claim includes complete normalized input before expensive processing", async () => {
  let captured;
  const result = await handleEnhancedWhatsAppWebhookRequest(request(), {
    env: { WHATSAPP_APP_SECRET: secret },
    durableQueue: true,
    controlMessage: async (input) => {
      captured = input;
      return { kind: "delivered" };
    },
  });
  assert.equal(result.status, 200);
  assert.equal(captured.action, "claim");
  assert.equal(captured.input.messageId, "wamid-fixture");
  assert.equal(captured.input.phone, "5517999999999");
  assert.equal(captured.input.text, "Oi");
});
