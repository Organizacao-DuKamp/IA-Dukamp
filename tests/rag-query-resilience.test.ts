import assert from "node:assert/strict";
import test from "node:test";

import { embedQuery } from "../src/lib/rag/embeddings.server.ts";

const previousKey = process.env.OPENAI_API_KEY;

function restoreKey() {
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
}

test("semantic query retries one transient failure and then succeeds", async () => {
  process.env.OPENAI_API_KEY = "openai-query-test-key";
  const previousFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return new Response("temporarily unavailable", { status: 503 });
    return new Response(
      JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    assert.deepEqual(await embedQuery("manejo de pastagem"), [0.1, 0.2, 0.3]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
    restoreKey();
  }
});

test("semantic query does not retry authentication errors", async () => {
  process.env.OPENAI_API_KEY = "openai-query-test-key";
  const previousFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("unauthorized", { status: 401 });
  }) as typeof fetch;

  try {
    await assert.rejects(() => embedQuery("sanidade bovina"), /Falha ao gerar embeddings/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    restoreKey();
  }
});
