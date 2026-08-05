import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260805143000_fix_knowledge_admin_rls.sql";

test("knowledge migration grants authenticated admins CRUD under RLS", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /alter table public\.knowledge_documents enable row level security/i);
  assert.match(sql, /alter table public\.knowledge_chunks enable row level security/i);
  assert.match(sql, /for all\s+to authenticated/i);
  assert.match(sql, /public\.has_role\(auth\.uid\(\), 'admin'\)/i);
  assert.match(sql, /with check \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/i);
});

test("ingestion reuses the authenticated privileged client", async () => {
  const source = await readFile("src/lib/rag/ingest.server.ts", "utf8");
  const privileged = await readFile("src/lib/privileged.server.ts", "utf8");

  assert.match(source, /getRequestPrivilegedClient/);
  assert.match(source, /const requestScoped = getRequestPrivilegedClient\(\)/);
  assert.match(privileged, /AsyncLocalStorage<PrivilegedClient>/);
  assert.match(privileged, /requestClient\.enterWith\(client\)/);
});
