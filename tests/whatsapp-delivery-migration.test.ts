import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("WhatsApp delivery migration separates ready replies from delivered replies", async () => {
  const sql = await readFile(
    "supabase/migrations/20260818164000_whatsapp_delivery_state.sql",
    "utf8",
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ/i);
  assert.match(sql, /WHERE status = 'completed'[\s\S]*delivered_at IS NULL/i);
  assert.match(sql, /pending_delivery_idx/i);
  assert.match(sql, /resposta final foi entregue/i);
});
