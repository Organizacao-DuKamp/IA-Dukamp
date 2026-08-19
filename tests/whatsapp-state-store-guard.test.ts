import assert from "node:assert/strict";
import test from "node:test";

import { enforceDurableWhatsAppStateStore } from "../src/lib/whatsapp/state-store-guard.server.ts";

test("production forces Supabase when a service role is available", () => {
  const env: Record<string, string | undefined> = {
    NODE_ENV: "production",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-present",
    WHATSAPP_STATE_STORE: "memory",
  };

  assert.equal(enforceDurableWhatsAppStateStore(env), "supabase");
  assert.equal(env.WHATSAPP_STATE_STORE, "supabase");
});

test("development may keep the in-memory store", () => {
  const env: Record<string, string | undefined> = {
    NODE_ENV: "development",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-present",
    WHATSAPP_STATE_STORE: "memory",
  };

  assert.equal(enforceDurableWhatsAppStateStore(env), "memory");
  assert.equal(env.WHATSAPP_STATE_STORE, "memory");
});

test("production without a service role does not pretend durable state exists", () => {
  const env: Record<string, string | undefined> = {
    NODE_ENV: "production",
    WHATSAPP_STATE_STORE: "memory",
  };

  assert.equal(enforceDurableWhatsAppStateStore(env), "memory");
  assert.equal(env.WHATSAPP_STATE_STORE, "memory");
});
