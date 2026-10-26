import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  extractPropertyObservation,
  observedFields,
} from "../src/lib/guardian/observed-property.ts";
import {
  projectObservedProperty,
  processObservedPropertyNotes,
  type PropertyProjectionStore,
  type ProjectionResult,
  type ObservedSummary,
  type ObservedDetail,
} from "../src/lib/guardian/observed-property.server.ts";

const at = new Date("2026-10-25T15:00:00Z"),
  phone = "5517999991111",
  other = "5517999992222";
const example =
  "Tpec-ia, eu tenho uma fazenda com 40 gados aqui em tanabi, eu preciso fazer eles engordar 40kg a mais. Você acha que demora quanto tempo?";
const extract = (text: string) => extractPropertyObservation({ text, at });
test("the reported example yields only the affirmed municipality and count, without a farm name, UF or forecast", () => {
  const result = extract(example);
  assert.equal(result.name, null);
  assert.deepEqual(
    result.facts.map((f) => [f.field, f.value]),
    [
      ["city", "tanabi"],
      ["herdTotal", 40],
    ],
  );
  assert.ok(
    result.facts.every((f) => example.includes(f.quote) && f.effectiveDate === "2026-10-25"),
  );
  assert.equal(observedFields.city.variable, false);
  assert.equal(observedFields.herdTotal.variable, true);
});
test("questions, scenarios, plans, third parties, estimates and negative claims do not establish a count", () => {
  for (const text of [
    "Tenho 40 gados?",
    "Se eu tivesse uma fazenda com 40 gados em Tanabi, quanto ganharia?",
    "Por exemplo, eu tenho 40 bovinos.",
    "Meu vizinho tem uma fazenda com 40 bovinos em Tanabi.",
    "Acho que tenho 40 gados.",
    "Tenho uns 40 bovinos.",
    "Quero ter 40 gados.",
    "Pretendo comprar 40 bovinos.",
    "Não tenho 40 bovinos.",
    "Vou vender 40 bois amanhã.",
    "Tenho 40 bovinos, talvez.",
    "Suponha uma fazenda. Eu teria 40 gados.",
    "Minha fazenda não fica em Tanabi.",
    'João disse: "Eu tenho 40 bovinos."',
  ]) {
    assert.equal(extract(text).facts.length, 0, text);
  }
});
test("sales and births never infer a stock change or invent individual animal records", () => {
  for (const text of ["Vendi 2 bois.", "Comprei 5 vacas.", "Nasceram 2 bezerros hoje."])
    assert.equal(extract(text).facts.length, 0, text);
  assert.deepEqual(
    extract("Tenho 40 vacas.").facts.map((f) => [f.field, f.value]),
    [["cows", 40]],
  );
  assert.deepEqual(
    extract("Agora tenho 38 bovinos.").facts.map((f) => [f.field, f.value]),
    [["herdTotal", 38]],
  );
  assert.equal(extract("Tenho 0 bovinos.").facts[0].value, 0);
  assert.equal(extract("Tenho 1.200 bovinos.").facts[0].value, 1200);
});
test("named properties and explicitly stated UF are retained; residence does not imply farm location", () => {
  const named = extract(
    "Minha fazenda se chama Boa Vista. Minha fazenda fica em Monte Aprazível/SP.",
  );
  assert.equal(named.name, "Boa Vista");
  assert.deepEqual(
    named.facts.map((f) => [f.field, f.value]),
    [
      ["name", "Boa Vista"],
      ["city", "Monte Aprazível"],
      ["uf", "SP"],
    ],
  );
  assert.equal(extract("Moro em Tanabi/SP.").facts.length, 0);
  assert.equal(
    extract("Minha fazenda fica em Tanabi.").facts.some((f) => f.field === "uf"),
    false,
  );
  assert.equal(extract("Tenho 40 bovinos. Tenho 50 bovinos.").facts.length, 0);
});
test("short numerical answers confirm only the field actually asked, and leading desires are excluded", () => {
  const result = extractPropertyObservation({
    text: "40",
    at,
    history: [{ role: "assistant", content: "Quantos bovinos você tem na sua fazenda?" }],
  });
  assert.equal(result.facts[0].value, 40);
  assert.match(result.facts[0].question!, /Quantos bovinos/);
  for (const q of ["Quantos bovinos você pretende comprar?", "Você quer 40 bovinos?"])
    assert.equal(
      extractPropertyObservation({ text: "40", at, history: [{ role: "assistant", content: q }] })
        .facts.length,
      0,
    );
});
test("audio accepts its own transcript; generated media analysis and credentials are not promoted", () => {
  const text =
    "[Mensagem recebida por áudio] Pedido do usuário: Analise. Transcrição do áudio: Tenho 40 bovinos.";
  assert.equal(extractPropertyObservation({ text, mediaType: "audio", at }).facts[0].value, 40);
  assert.equal(
    extractPropertyObservation({ text: "Tenho 40 bovinos.", mediaType: "image", at }).facts.length,
    0,
  );
  assert.equal(extract("Minha fazenda fica em Tanabi, senha abc123.").facts.length, 0);
});

async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.whatsapp_followup_profiles(phone_number text PRIMARY KEY, context_reset_at timestamptz);
    CREATE FUNCTION public.whatsapp_context_boundary(text) RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT greatest('2026-10-14T00:00:00Z'::timestamptz,(SELECT context_reset_at FROM public.whatsapp_followup_profiles WHERE phone_number=$1)) $$;
    REVOKE ALL ON FUNCTION public.whatsapp_context_boundary(text) FROM PUBLIC,anon,authenticated;
    GRANT EXECUTE ON FUNCTION public.whatsapp_context_boundary(text) TO service_role;
    GRANT SELECT ON public.whatsapp_followup_profiles TO service_role;
    CREATE TABLE public.whatsapp_user_memory_facts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),phone_number text,source_message_id text,value_text text,last_seen_at timestamptz,first_seen_at timestamptz DEFAULT now(),status text DEFAULT 'active',metadata jsonb DEFAULT '{}');
    CREATE TABLE public.whatsapp_memory_inbox(phone_number text,message_id text,user_text text,created_at timestamptz);
    ALTER TABLE public.whatsapp_user_memory_facts ENABLE ROW LEVEL SECURITY;
    GRANT SELECT,INSERT,UPDATE ON public.whatsapp_user_memory_facts TO service_role;`);
  const name = (await readdir("supabase/migrations")).find((p) =>
    p.endsWith("_guardian_observed_property_profiles.sql"),
  )!;
  await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
  const rpc = async <T = unknown>(query: string, values: unknown[] = []): Promise<T> =>
    (await db.query<{ data: T }>(query, values)).rows[0]?.data;
  const store: PropertyProjectionStore = {
    commit: (i, source, o, time) =>
      rpc<ProjectionResult>("select public.guardian_observe_property($1,$2,$3,$4,$5,$6,$7) data", [
        i.phone,
        i.messageId,
        time,
        source,
        o.name,
        o.another,
        JSON.stringify(o.facts),
      ]),
    pending: (limit) =>
      rpc<Awaited<ReturnType<PropertyProjectionStore["pending"]>>>(
        "select public.guardian_pending_property_notes($1) data",
        [limit],
      ),
    finish: async (id, outcome) => {
      await rpc("select public.guardian_finish_property_note($1,$2) data", [id, outcome]);
    },
    source: async (note) => {
      const row = (
        await db.query<{ user_text: string; created_at: string }>(
          "select user_text,created_at from public.whatsapp_memory_inbox where phone_number=$1 and message_id=$2",
          [note.phone_number, note.source_message_id],
        )
      ).rows[0];
      return row ? { text: row.user_text, at: row.created_at } : null;
    },
  };
  const send = (text: string, id: string, time = at.toISOString(), p = phone) =>
    projectObservedProperty(
      { phone: p, messageId: id, text, at: time },
      { store, enabled: true, now: at },
    );
  const list = () =>
    rpc<{ profiles: ObservedSummary[]; partial: boolean }>(
      "select public.guardian_observed_profiles() data",
    );
  const detail = (id: string) =>
    rpc<ObservedDetail | null>("select public.guardian_observed_profile($1) data", [id]);
  return { db, store, send, list, detail, rpc };
}
test("real SQL: implicit profile, dated variable history, replay and stable city across changing stock", async () => {
  const { db, send, list, detail } = await database();
  try {
    const first = await send(example, "first");
    assert.equal(first.status, "saved");
    assert.equal(first.added, 2);
    const before = await list();
    assert.equal(before.profiles.length, 1);
    assert.equal(before.profiles[0].name, "Propriedade de " + phone);
    await send("Agora tenho 38 bovinos.", "new", "2026-10-25T16:00:00Z");
    await send("Tenho 40 gados.", "older", "2026-10-24T16:00:00Z");
    assert.equal((await send(example, "first")).added, 0);
    const d = await detail(first.propertyId!);
    assert.equal(d.current.find((f) => f.field === "herdTotal").value, 38);
    assert.equal(d.current.find((f) => f.field === "city").value, "tanabi");
    assert.deepEqual(
      d.history
        .filter((f) => f.field === "herdTotal")
        .map((f) => f.value)
        .sort(),
      [38, 40, 40],
    );
    await send("Minha fazenda se chama Boa Vista.", "name", "2026-10-25T17:00:00Z");
    assert.equal((await list()).profiles.length, 1);
    assert.equal((await list()).profiles[0].id, first.propertyId);
    assert.equal((await list()).profiles[0].name, "Boa Vista");
  } finally {
    await db.close();
  }
});
test("real SQL: separate senders, ambiguous unnamed second properties and private client roles", async () => {
  const { db, send, list, rpc } = await database();
  try {
    await send("Minha fazenda se chama Boa Vista.", "one");
    await send("Minha fazenda se chama Santa Fé.", "two");
    const unresolved = await send("Tenho 40 bovinos.", "ambiguous");
    assert.equal(unresolved.status, "ambiguous_property");
    await send("Tenho 15 bovinos.", "other", at.toISOString(), other);
    assert.equal((await list()).profiles.length, 3);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("SET ROLE " + role);
      await assert.rejects(
        () => rpc("select public.guardian_observed_profiles() data"),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select * from public.guardian_observed_facts"),
        /permission denied/,
      );
      await db.exec("RESET ROLE");
    }
  } finally {
    await db.close();
  }
});
test("real SQL: reset hides derived profiles and refuses late old source without reviving a generation", async () => {
  const { db, send, list, detail } = await database();
  try {
    const original = await send(example, "first");
    await db.exec(
      `INSERT INTO public.whatsapp_followup_profiles VALUES('${phone}','2026-10-25T16:00:00Z')`,
    );
    assert.equal((await list()).profiles.length, 0);
    assert.equal(await detail(original.propertyId!), null);
    assert.equal((await send(example, "late")).status, "reset");
    await send("Tenho 38 bovinos.", "fresh", "2026-10-25T17:00:00Z");
    const latest = await list();
    assert.equal(latest.profiles.length, 1);
    assert.notEqual(latest.profiles[0].id, original.propertyId);
    assert.equal(latest.profiles[0].facts.city, undefined);
  } finally {
    await db.close();
  }
});
test("real SQL: past notes reconcile once without another model call or changing source evidence", async () => {
  const { db, store, list } = await database();
  try {
    await db.query("INSERT INTO public.whatsapp_memory_inbox VALUES($1,'backfill',$2,$3)", [
      phone,
      example,
      at.toISOString(),
    ]);
    await db.query(
      `INSERT INTO public.whatsapp_user_memory_facts(phone_number,source_message_id,value_text,last_seen_at,metadata) VALUES($1,'backfill',$2,$3,$4)`,
      [
        phone,
        example,
        at.toISOString(),
        JSON.stringify({
          capture: "conversation_v1",
          memory_epoch: "reset-2026-10-14-duk-a91f",
          kind: "reported",
        }),
      ],
    );
    const first = await processObservedPropertyNotes({ store, enabled: true });
    assert.equal(first.enabled, true);
    assert.equal(first.facts, 2);
    assert.equal(first.failed, 0);
    assert.equal((await list()).profiles.length, 1);
    assert.equal((await processObservedPropertyNotes({ store, enabled: true })).checked, 0);
    assert.equal(
      (
        await db.query<{ value_text: string }>(
          "select value_text from public.whatsapp_user_memory_facts",
        )
      ).rows[0].value_text,
      example,
    );
  } finally {
    await db.close();
  }
});

test("backfill reads the whole original message and never assigns a fragment of a multi-property report", async () => {
  const { db, store, list } = await database();
  try {
    const original =
      "Minha fazenda se chama Boa Vista. Minha fazenda se chama Santa Fé. Tenho 40 bovinos.";
    await db.query("INSERT INTO public.whatsapp_memory_inbox VALUES($1,'multi',$2,$3)", [
      phone,
      original,
      at.toISOString(),
    ]);
    await db.query(
      "INSERT INTO public.whatsapp_user_memory_facts(phone_number,source_message_id,value_text,last_seen_at,metadata) VALUES($1,'multi',$2,$3,$4)",
      [
        phone,
        "Minha fazenda se chama Boa Vista.",
        at.toISOString(),
        JSON.stringify({
          capture: "conversation_v1",
          memory_epoch: "reset-2026-10-14-duk-a91f",
          kind: "reported",
        }),
      ],
    );
    const result = await processObservedPropertyNotes({ store, enabled: true });
    assert.equal(result.failed, 0);
    assert.equal(result.facts, 0);
    assert.equal((await list()).profiles.length, 0);
  } finally {
    await db.close();
  }
});
