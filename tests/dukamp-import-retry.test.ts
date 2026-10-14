import test from "node:test";
import assert from "node:assert/strict";
import { retryDuKampImportStep } from "../src/lib/rag/dukamp-import-retry.ts";
import { readFile } from "node:fs/promises";
test("transient upload failure is replayed with bounded attempts", async () => {
  let calls = 0;
  const attempts: number[] = [];
  const result = await retryDuKampImportStep(
    async () => {
      if (++calls < 3) throw new Error("operation aborted due to timeout");
      return "preserved";
    },
    (n) => attempts.push(n),
    async () => {},
  );
  assert.equal(result, "preserved");
  assert.deepEqual(attempts, [2, 3]);
});
test("authorization refusal and source integrity failures are never retried", async () => {
  for (const message of [
    "Acesso restrito a administradores autenticados",
    "O original não confere com o hash",
  ]) {
    let calls = 0;
    await assert.rejects(() =>
      retryDuKampImportStep(
        async () => {
          calls++;
          throw new Error(message);
        },
        () => {},
        async () => {},
      ),
    );
    assert.equal(calls, 1);
  }
});
test("a persistent timeout remains a visible failure after three attempts", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retryDuKampImportStep(
        async () => {
          calls++;
          throw new Error("timeout");
        },
        () => {},
        async () => {},
      ),
    /timeout/,
  );
  assert.equal(calls, 3);
});
test("the longer ingestion deadline does not change the conversational deadline", async () => {
  assert.match(
    await readFile("src/lib/rag/dukamp-ingestion-client.server.ts", "utf8"),
    /timeout\(20_000\)/,
  );
  assert.match(
    await readFile("src/integrations/supabase/client.server.ts", "utf8"),
    /timeout\(8_000\)/,
  );
  const api = await readFile("src/lib/dukamp-knowledge.functions.ts", "utf8");
  assert.match(api, /await admin\(context\)/);
  assert.match(api, /result.data !== true/);
});
