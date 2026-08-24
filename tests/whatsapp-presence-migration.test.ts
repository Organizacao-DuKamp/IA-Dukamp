import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migração cria a reserva durável de presença do WhatsApp", async () => {
  const sql = await readFile(
    "supabase/migrations/20260824180000_whatsapp_presence_once.sql",
    "utf8",
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS presence_claimed_at TIMESTAMPTZ/i);
  assert.match(sql, /único indicador de digitação/i);
  assert.doesNotMatch(sql, /GRANT\s+.*(?:anon|authenticated)/i);
});
