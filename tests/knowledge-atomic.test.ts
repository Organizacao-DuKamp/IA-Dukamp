import assert from "node:assert/strict";
import test from "node:test";
import { ingestDocument } from "../src/lib/rag/ingest.server.ts";

const doc = {
  id: "00000000-0000-4000-8000-000000000099",
  title: "Técnico",
  filename: "tecnico.txt",
  category: "Técnico",
  subcategory: null,
};
function database(rpcError: { code: string } | null = null) {
  const calls: Array<{ name: string; args?: unknown }> = [];
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { version: 2, content_hash: "hash" }, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: rpcError ? null : 1, error: rpcError };
    },
  };
  return { db: db as never, calls };
}
test("embedding failure preserves the previous indexed generation", async () => {
  const { db, calls } = database();
  await assert.rejects(
    ingestDocument(doc, "Conteúdo técnico válido", db, {
      embed: async () => {
        throw new Error("provider unavailable");
      },
    }),
    /provider unavailable/,
  );
  assert.equal(calls.length, 0);
});
test("bad vector shape cannot replace a trusted knowledge generation", async () => {
  const { db, calls } = database();
  await assert.rejects(
    ingestDocument(doc, "Conteúdo técnico válido", db, { embed: async () => [[1, 2, 3]] }),
    /Embeddings inválidos/,
  );
  assert.equal(calls.length, 0);
});
test("atomic indexing has version/hash fencing and source provenance", async () => {
  const { db, calls } = database();
  const v = Array.from({ length: 3072 }, (_, i) => (i === 0 ? 1 : 0));
  assert.equal(
    await ingestDocument(doc, "Conteúdo técnico válido", db, { embed: async () => [v] }),
    1,
  );
  const call = calls[0];
  assert.equal(call.name, "replace_knowledge_document_chunks");
  const a = call.args as {
    p_expected_version: number;
    p_expected_hash: string;
    p_chunks: Array<{ metadata: { provenance: { text_sha256: string } } }>;
  };
  assert.equal(a.p_expected_version, 2);
  assert.equal(a.p_expected_hash, "hash");
  assert.match(a.p_chunks[0].metadata.provenance.text_sha256, /^[a-f0-9]{64}$/);
});
test("an unmigrated deployment refuses reindexing without deleting the existing generation", async () => {
  const { db, calls } = database({ code: "PGRST202" });
  const v = Array.from({ length: 3072 }, (_, i) => (i === 0 ? 1 : 0));
  await assert.rejects(
    ingestDocument(doc, "Conteúdo técnico válido", db, { embed: async () => [v] }),
    /migração de indexação transacional ainda não está disponível/,
  );
  assert.deepEqual(
    calls.map((c) => c.name),
    ["replace_knowledge_document_chunks"],
  );
});
