import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("migração de memória proativa protege dados e usa claims concorrentes", async () => {
  const sql = await readFile(
    "supabase/migrations/20260921120000_whatsapp_proactive_memory.sql",
    "utf8",
  );

  for (const table of [
    "whatsapp_followup_profiles",
    "whatsapp_memory_inbox",
    "whatsapp_user_memory_facts",
    "whatsapp_proactive_queue",
  ]) {
    assert.match(
      sql,
      new RegExp("ALTER TABLE public\\." + table + " ENABLE ROW LEVEL SECURITY", "i"),
    );
    assert.match(
      sql,
      new RegExp(
        "REVOKE ALL ON TABLE public\\." + table + " FROM PUBLIC, anon, authenticated",
        "i",
      ),
    );
  }

  assert.match(sql, /FOR UPDATE SKIP LOCKED/i);
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /TO service_role/i);
  assert.match(sql, /bootstrap:/i);
});
