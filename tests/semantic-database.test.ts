import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
const phone = "5517999991111",
  other = "5517999992222",
  provider = "openai:test:3072",
  epoch = "reset-2026-10-14-duk-a91f";
const embedding = `[${Array.from({ length: 3072 }, (_, i) => (i === 0 ? 1 : 0)).join(",")}]`;
type Claim = { turn_id: string; phone_number: string; source_hash: string; lock_token: string };
async function setup() {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(`CREATE EXTENSION vector; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.ai_chat_turns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phone_number text,channel text NOT NULL DEFAULT 'whatsapp',status text NOT NULL DEFAULT 'completed',user_text text NOT NULL,assistant_text text,created_at timestamptz NOT NULL DEFAULT now()-interval '1 hour');
    CREATE TABLE public.whatsapp_followup_profiles(phone_number text PRIMARY KEY,context_reset_at timestamptz);
    CREATE FUNCTION public.whatsapp_context_boundary(p_phone text) RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT greatest('2026-10-14T00:00:00Z'::timestamptz,(SELECT context_reset_at FROM public.whatsapp_followup_profiles WHERE phone_number=p_phone)) $$;
    REVOKE ALL ON FUNCTION public.whatsapp_context_boundary(text) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.whatsapp_context_boundary(text) TO service_role;
    GRANT SELECT ON public.ai_chat_turns TO service_role;`);
  const migration = (await readdir(new URL("../supabase/migrations/", import.meta.url))).find(
    (file) => file.endsWith("_private_semantic_memory.sql"),
  );
  assert.ok(migration, "Private semantic memory migration must exist");
  await db.exec(
    await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"),
  );
  const add = async (owner: string, text: string, age = "1 hour") =>
    (
      await db.query<{ id: string }>(
        "insert into ai_chat_turns(phone_number,user_text,created_at) values($1,$2,now()-$3::interval) returning id",
        [owner, text, age],
      )
    ).rows[0].id;
  const claim = async (limit = 8, budget = 200) =>
    (
      await db.query<Claim>("select * from claim_whatsapp_semantic_memory($1,$2,$3,$4)", [
        provider,
        epoch,
        limit,
        budget,
      ])
    ).rows;
  const finish = async (c: Claim, v: string | null = embedding) =>
    (
      await db.query<{ ok: boolean }>("select finish_whatsapp_semantic_memory($1,$2,$3,$4) ok", [
        c.turn_id,
        c.lock_token,
        provider,
        v,
      ])
    ).rows[0].ok;
  const search = async (owner = phone, p = provider) =>
    (
      await db.query<{ data: { turns: Array<{ id: string; user_text: string; score: number }> } }>(
        "select recall_whatsapp_semantic($1,$2,$3,$4,now()) data",
        [owner, p, embedding, epoch],
      )
    ).rows[0].data;
  return { db, add, claim, finish, search };
}
test("real pgvector: private semantic search retains originals and neighbors while isolating phone and provider", async () => {
  const { db, add, claim, finish, search } = await setup();
  try {
    const original = await add(phone, "A novilha Estrela parou de comer", "3 hours");
    const corrected = await add(phone, "Atualização: Estrela voltou a comer", "2 hours");
    const forbidden = await add(other, "Dado privado de outra fazenda");
    for (const c of await claim()) assert.equal(await finish(c), true);
    const found = await search();
    assert.deepEqual(new Set(found.turns.map((t) => t.id)), new Set([original, corrected]));
    assert.ok(found.turns.every((t) => t.score > 0.99));
    assert.equal(
      found.turns.some((t) => t.id === forbidden),
      false,
    );
    assert.equal((await search(phone, "other-model")).turns.length, 0);
    assert.equal((await claim()).length, 0);
    await db.exec("SET ROLE authenticated");
    await assert.rejects(db.query("select * from whatsapp_context_vectors"), /permission denied/);
    await assert.rejects(
      db.query("select recall_whatsapp_semantic($1,$2,$3,$4,now())", [
        other,
        provider,
        embedding,
        epoch,
      ]),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE anon");
    await assert.rejects(
      db.query("select * from claim_whatsapp_semantic_memory($1,$2,1,200)", [provider, epoch]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("real pgvector: reset deletes derived memory and rejects an in-flight worker restoring it", async () => {
  const { db, add, claim, finish, search } = await setup();
  try {
    await db.query("insert into whatsapp_followup_profiles(phone_number) values($1)", [phone]);
    await add(phone, "Registro anterior ao reset");
    const [c] = await claim();
    await db.query(
      "update whatsapp_followup_profiles set context_reset_at=now() where phone_number=$1",
      [phone],
    );
    assert.equal(await finish(c), false);
    assert.equal((await search()).turns.length, 0);
    assert.equal((await claim()).length, 0);
    assert.equal((await db.query("select * from whatsapp_context_vectors")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("real pgvector: source changes, deletion and lease fencing cannot serve a stale embedding", async () => {
  const { db, add, claim, finish, search } = await setup();
  try {
    const id = await add(phone, "Peso anterior 350 kg");
    const [first] = await claim();
    assert.equal(await finish(first), true);
    await db.query("update ai_chat_turns set user_text='Peso corrigido 450 kg' where id=$1", [id]);
    assert.equal((await search()).turns.length, 0);
    const [second] = await claim();
    assert.notEqual(first.lock_token, second.lock_token);
    assert.equal(await finish(first), false);
    await db.exec("update whatsapp_context_vectors set claimed_at=now()-interval '11 minutes'");
    const [third] = await claim();
    assert.notEqual(third.lock_token, second.lock_token);
    assert.equal(await finish(second), false);
    assert.equal(await finish(third), true);
    assert.match((await search()).turns[0].user_text, /450 kg/);
    await db.query("delete from ai_chat_turns where id=$1", [id]);
    assert.equal((await db.query("select * from whatsapp_context_vectors")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("real pgvector: global daily budget and retry backoff bound costs without blocking the original chat", async () => {
  const { db, add, claim, finish } = await setup();
  try {
    await add(phone, "Primeiro episódio");
    await add(other, "Segundo episódio");
    await add(phone, "Terceiro episódio");
    const rows = await claim(8, 2);
    assert.equal(rows.length, 2);
    assert.equal((await claim(8, 2)).length, 0);
    assert.equal(await finish(rows[0], null), true);
    assert.equal((await claim(8, 2)).length, 0);
    const state = (
      await db.query<{ status: string; attempts: number; waiting: boolean }>(
        "select status,attempts,retry_at>now() waiting from whatsapp_context_vectors where turn_id=$1",
        [rows[0].turn_id],
      )
    ).rows[0];
    assert.deepEqual(state, { status: "error", attempts: 1, waiting: true });
    await assert.rejects(
      db.query("select finish_whatsapp_semantic_memory($1,$2,$3,'[1,2,3]')", [
        rows[1].turn_id,
        rows[1].lock_token,
        provider,
      ]),
      /invalid_private_vector/,
    );
    assert.equal((await db.query("select * from ai_chat_turns")).rows.length, 3);
    await db.query(
      "update whatsapp_context_vectors set attempts=4,claimed_at=now()-interval '11 minutes' where turn_id=$1",
      [rows[1].turn_id],
    );
    assert.equal((await claim(8, 2)).length, 0);
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from whatsapp_context_vectors where turn_id=$1",
          [rows[1].turn_id],
        )
      ).rows[0].status,
      "dead",
    );
    assert.equal(await finish(rows[1]), false);
    await assert.rejects(
      db.query("select recall_whatsapp_semantic($1,$2,null,$3,now())", [phone, provider, epoch]),
      /invalid_private_recall/,
    );
  } finally {
    await db.close();
  }
});
