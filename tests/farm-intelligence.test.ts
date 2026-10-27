import assert from "node:assert/strict";
import test from "node:test";
import { emptyFarm, PreferencesSchema } from "../src/lib/guardian/schema.ts";
import { calculate } from "../src/lib/guardian/calculators.ts";
import { farmRuleEvents } from "../src/lib/guardian/rules.ts";
import { emptyOperations } from "../src/lib/guardian/operations.ts";
import { lookupGenealogy, compareGenealogy } from "../src/lib/guardian/genealogy.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const now = new Date("2026-10-26T15:00:00Z"),
  phone = "5517999991111";
const source = {
  actor: phone,
  messageId: "source",
  at: now.toISOString(),
  confirmed: true as const,
};
function monitoredFarm() {
  const book = emptyFarm("Boa Vista", "Tanabi", "SP");
  book.operations = {
    ...emptyOperations(),
    alertRules: {
      enabled: true,
      minGmd: 0,
      staleDays: 1,
      mortalityCount: 2,
      mortalityWindowDays: 7,
    },
  };
  book.operations.counts.push({ id: "count", count: 40, date: "2026-10-20", source });
  book.operations.movements.push({
    id: "deaths",
    type: "death",
    count: 2,
    date: "2026-10-25",
    description: "Mortalidade declarada",
    source,
  });
  book.animals.push({
    code: "7",
    sex: "male",
    source,
    weights: [
      { ...source, date: "2026-10-20", weightKg: 400, estimated: false, corrections: [] },
      { ...source, date: "2026-10-25", weightKg: 395, estimated: false, corrections: [] },
    ],
  });
  return book;
}
test("deterministic zootechnical rates require an explicit cohort and period; insufficient data is rejected", () => {
  const period = { start: "2026-10-01", end: "2026-10-26" };
  assert.equal(
    calculate({ kind: "mortality_rate", events: 2, eligible: 40, ...period }).values.ratePercent,
    5,
  );
  assert.equal(
    calculate({ kind: "birth_rate", events: 20, eligible: 25, ...period }).values.ratePercent,
    80,
  );
  assert.equal(
    calculate({ kind: "weaning_rate", events: 18, eligible: 20, ...period }).values.ratePercent,
    90,
  );
  assert.equal(
    calculate({ kind: "pregnancy_rate", events: 18, eligible: 25, ...period }).values.ratePercent,
    72,
  );
  assert.equal(
    calculate({ kind: "productivity", producedKg: 5000, productiveHa: 20, ...period }).values
      .kgPerHa,
    250,
  );
  assert.throws(() => calculate({ kind: "mortality_rate", events: 2, eligible: 0, ...period }));
  assert.throws(() => calculate({ kind: "pregnancy_rate", events: 30, eligible: 25, ...period }));
  assert.throws(() =>
    calculate({
      kind: "weaning_rate",
      events: 18,
      eligible: 20,
      start: period.end,
      end: period.start,
    }),
  );
  assert.throws(() => calculate({ kind: "mortality_rate", events: 2, eligible: 40 }));
});
test("configured rules use measured data, stable dedupe keys and evidence; disabled rules never emit warnings", () => {
  const book = monitoredFarm(),
    events = farmRuleEvents(book, 5, phone, now);
  assert.equal(events.length, 3);
  assert.ok(
    events.every(
      (e) => e.evidence.ruleVersion === "guardian-rules-v1" && e.evidence.sourceVersion === 5,
    ),
  );
  assert.deepEqual(
    events.map((e) => e.key),
    farmRuleEvents(book, 6, phone, now).map((e) => e.key),
  );
  assert.ok(events.some((e) => e.message.includes("não é uma taxa de mortalidade")));
  book.operations!.alertRules!.enabled = false;
  assert.deepEqual(farmRuleEvents(book, 5, phone, now), []);
  book.operations!.alertRules!.enabled = true;
  book.animals[0].weights[1].estimated = true;
  assert.equal(
    farmRuleEvents(book, 5, phone, now).some((e) => e.evidence.rule === "gmd"),
    false,
  );
});
test("genealogy connector refuses unconfigured/unauthorized integrations and mismatched official records", async () => {
  const query = { registry: "RGN", code: "ABC 123" };
  assert.equal((await lookupGenealogy(query)).status, "not_configured");
  const evidence = {
    registry: "RGN",
    code: "ABC 123",
    animal: "Animal informado",
    sire: "Pai A",
    dam: null,
    source: "https://registry.example/authorized-record",
    retrievedAt: now.toISOString(),
    authorization: "test-fixture-authorized",
  };
  const connector = { id: "fixture", authorized: true, lookup: async () => evidence };
  assert.equal((await lookupGenealogy(query, connector)).status, "found");
  assert.equal(
    (await lookupGenealogy(query, { ...connector, authorized: false })).status,
    "not_configured",
  );
  assert.equal((await lookupGenealogy({ ...query, code: "Other" }, connector)).status, "mismatch");
  const { GenealogyEvidence } = await import("../src/lib/guardian/genealogy.ts");
  const parsed = GenealogyEvidence.parse(evidence);
  const compared = compareGenealogy(parsed, { ...parsed, code: "XYZ 456", sire: "Pai A" });
  assert.equal(compared.sameSire, true);
  assert.equal(compared.sameDam, null);
});
test("integrated PostgreSQL: rule claims require consent, queue is deduplicated, stale-source alerts cancel and only current versions can be queued", async () => {
  const f = await farmIntegration();
  try {
    await f.observe(phone, "first", "Minha fazenda fica em Tanabi e tenho 40 cabeças.");
    let s = await f.guardian.load(phone);
    await f.guardian.commit({
      phone,
      messageId: "book",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "update",
      book: monitoredFarm(),
      pending: null,
      details: { kind: "profile" },
      reply: "ok",
    });
    assert.deepEqual(await f.rpc("select guardian_claim_rules(5) data"), []);
    s = await f.guardian.load(phone);
    await f.guardian.commit({
      phone,
      messageId: "consent",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "preferences",
      preferences: PreferencesSchema.parse({
        enabled: true,
        consentAt: now.toISOString(),
        consentMessageId: "consent",
        startHour: 0,
        endHour: 24,
      }),
      pending: null,
      reply: "ok",
    });
    const claimed = await f.rpc<
      Array<{
        propertyId: string;
        phone: string;
        version: number;
        book: ReturnType<typeof monitoredFarm>;
      }>
    >("select guardian_claim_rules(5) data");
    assert.equal(claimed.length, 1);
    const row = claimed[0],
      events = farmRuleEvents(row.book, row.version, row.phone, now);
    const queue = (version: number) =>
      f.rpc<number>("select guardian_queue_rule_events($1,$2,$3,$4) data", [
        row.propertyId,
        row.phone,
        version,
        events.map((e) => ({ ...e, evidence: { ...e.evidence, sourceVersion: version } })),
      ]);
    assert.equal(await queue(row.version), 3);
    assert.equal(await queue(row.version), 0);
    s = await f.guardian.load(phone);
    await f.guardian.commit({
      phone,
      messageId: "update",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "update",
      book: s.active!.book,
      pending: null,
      details: { kind: "profile" },
      reply: "ok",
    });
    assert.equal(
      (
        await f.db.query<{ n: number }>(
          "select count(*)::int n from guardian_events where status='cancelled' and last_error='rule_source_changed'",
        )
      ).rows[0].n,
      3,
    );
    assert.equal(await queue(row.version), 0);
    assert.equal(await queue(row.version + 1), 3);
    await f.db.query("update guardian_members set active=false where phone_number=$1", [phone]);
    assert.equal(await queue(row.version + 1), 0);
  } finally {
    await f.db.close();
  }
});
test("integrated PostgreSQL: review decisions require current admin authority and retain both evidence and an audit receipt", async () => {
  const f = await farmIntegration();
  const admin = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  try {
    await f.db.query("insert into auth.users values($1),($2)", [admin, other]);
    const id = (
      await f.db.query<{ id: string }>(
        "insert into guardian_review_queue(phone_number,message_id,reason) values($1,'ambiguous','ambiguous_property') returning id",
        [phone],
      )
    ).rows[0].id;
    await assert.rejects(
      f.rpc("select guardian_resolve_review($1,$2,'resolved') data", [id, other]),
      /guardian_review_denied/,
    );
    await f.db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
    await f.db.exec("SET ROLE authenticated");
    assert.equal((await f.db.query("select * from guardian_review_queue")).rows.length, 0);
    await assert.rejects(
      f.rpc("select guardian_resolve_review($1,$2,'resolved') data", [id, admin]),
      /permission denied/,
    );
    await f.db.exec("RESET ROLE");
    assert.equal(
      await f.rpc("select guardian_resolve_review($1,$2,'resolved') data", [id, admin]),
      true,
    );
    assert.equal(
      await f.rpc("select guardian_resolve_review($1,$2,'resolved') data", [id, admin]),
      false,
    );
    const row = (
      await f.db.query<{ status: string; message_id: string }>(
        "select status,message_id from guardian_review_queue where id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(row.status, "resolved");
    assert.equal(row.message_id, "ambiguous");
    assert.equal(
      (await f.db.query("select * from guardian_audit where action='review_resolved'")).rows.length,
      1,
    );
  } finally {
    await f.db.close();
  }
});
