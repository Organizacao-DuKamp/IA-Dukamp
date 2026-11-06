import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { emptyFarm, FarmBookSchema } from "../src/lib/guardian/schema.ts";
import { panelCodeHash, hashToken } from "../src/lib/guardian/panel.server.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { prepareImportRow, type ImportRow } from "../src/lib/guardian/imports.ts";
const phone = "5517999900001",
  other = "5517999900002",
  property = "00000000-0000-4000-8000-000000000111";
async function setup(path?: string) {
  const f = await farmIntegration(path);
  await f.guardian.commit({
    phone,
    messageId: "farm",
    accountVersion: 0,
    propertyId: property,
    propertyVersion: null,
    operation: "create",
    pending: null,
    book: emptyFarm("Teste", "Tanabi", "SP"),
    reply: "ok",
  });
  await f.db.exec(
    "CREATE TABLE whatsapp_processed_messages(message_id text primary key,phone_number text,status text,reply text,request_payload jsonb)",
  );
  return f;
}
test("OTP real SQL: phone binding, expiry, single use, concurrent consumption, durable distributed limits, revocation and legacy transition", async () => {
  const f = await setup();
  try {
    const issue = async (code: string, msg: string) => {
      const hash = panelCodeHash(code, phone, "test");
      assert.equal(await f.issue(phone, property, msg, hash), true);
      return hash;
    };
    const exchange = (number: string, hash: string, session: string, origin: string) =>
      f.rpc("select guardian_panel_exchange_otp($1,$2,$3,$4,false) data", [
        number,
        hash,
        hashToken(session),
        origin,
      ]);
    const hash = await issue("000123", "otp1");
    assert.equal(await exchange(other, hash, "wrong-user", "ip1"), false);
    const result = await Promise.all([
      exchange(phone, hash, "session1", "ip2"),
      exchange(phone, hash, "session2", "ip2"),
    ]);
    assert.equal(result.filter(Boolean).length, 1);
    assert.equal(await exchange(phone, hash, "reuse", "ip3"), false);
    const expired = await issue("100123", "otp2");
    await f.db.exec(
      "update guardian_panel_codes set expires_at=now()-interval '1 second' where consumed_at is null",
    );
    assert.equal(await exchange(phone, expired, "expired", "ip4"), false);
    await f.db.exec("truncate guardian_panel_limits");
    const locked = await issue("200123", "otp3");
    for (let i = 0; i < 5; i++)
      assert.equal(
        await exchange(phone, hashToken("bad" + i), "miss" + i, "distributed-" + i),
        false,
      );
    assert.equal(await exchange(phone, locked, "correct-after-misses", "new-ip"), false);
    assert.equal(
      (
        await f.db.query("select attempts from guardian_panel_limits where key_hash=$1", [
          "otp:phone:" + phone,
        ])
      ).rows[0].attempts,
      6,
    );
    await f.db.exec("truncate guardian_panel_limits");
    await f.issue(phone, property, "legacy", hashToken("ABCDEFGH23456789"));
    assert.equal(
      await f.store.exchange(hashToken("ABCDEFGH23456789"), hashToken("legacy-session"), false),
      true,
    );
    await f.db.exec(`update guardian_members set active=false where phone_number='${phone}'`);
    assert.equal(await f.store.authorize(hashToken("legacy-session")), null);
    await f.db.exec("set role anon");
    await assert.rejects(() =>
      f.db.query("select guardian_panel_exchange_otp($1,$2,$3,$4,false)", [
        phone,
        hash,
        hashToken("x"),
        "x",
      ]),
    );
  } finally {
    await f.db.close();
  }
});
for (const count of [1, 5, 13])
  test(`SQL groups ${count} simultaneous files, deduplicates replay, fences stale final and queues one final reply`, async () => {
    const f = await setup();
    try {
      const enqueue = (i: number) =>
        f.rpc<string>("select guardian_import_enqueue($1,$2,$3,$4,$5,$6,$7,$8) data", [
          phone,
          property,
          "photo" + i,
          `pagina-${i}.jpg`,
          "image/jpeg",
          hashToken("file" + i),
          "AA==",
          i === 0 ? `${count} imagens para cadastrar animais` : "",
        ]);
      const ids = await Promise.all(Array.from({ length: count }, (_, i) => enqueue(i)));
      assert.equal(new Set(ids).size, 1);
      const id = ids[0];
      await enqueue(0);
      assert.equal(
        (await f.db.query("select * from guardian_import_sources where batch_id=$1", [id])).rows
          .length,
        count,
      );
      await f.db.query(
        "update guardian_import_batches set ready_at=now()-interval '1 second' where id=$1",
        [id],
      );
      const claims = await f.db.query<{ id: string; revision: number; lease_token: string }>(
        "select * from guardian_import_claim()",
      );
      assert.equal(claims.rows.length, 1);
      assert.equal((await f.db.query("select * from guardian_import_claim()")).rows.length, 0);
      const b = claims.rows[0];
      await f.db.query("update guardian_import_sources set status='complete' where batch_id=$1", [
        id,
      ]);
      const finish = () =>
        f.rpc("select guardian_import_finish($1,$2,$3,$4,$5) data", [
          id,
          b.lease_token,
          b.revision,
          { identified: count },
          `Recebi ${count} imagens`,
        ]);
      assert.equal(await finish(), true);
      assert.equal(await finish(), true);
      assert.equal((await f.db.query("select * from whatsapp_processed_messages")).rows.length, 1);
      await assert.rejects(() =>
        f.rpc("select guardian_import_review($1,$2,$3,'approve','{}') data", [
          other,
          id,
          b.revision,
        ]),
      );
      await f.db.exec("set role authenticated");
      await assert.rejects(() => f.db.query("select * from guardian_import_rows"));
    } finally {
      await f.db.close();
    }
  });
test("SQL durable batches survive restart; corrections, partial approval, 500 records, receipts and rollback share one transaction", async () => {
  const path = await mkdtemp(join(tmpdir(), "tpec-import-"));
  let f = await setup(path);
  try {
    const id = await f.rpc<string>(
      "select guardian_import_enqueue($1,$2,'report','animais.csv','text/csv',$3,'AA==','Cadastrar animais') data",
      [phone, property, hashToken("report")],
    );
    const source = (
      await f.db.query<{ id: string }>("select id from guardian_import_sources where batch_id=$1", [
        id,
      ])
    ).rows[0].id;
    for (let i = 1; i <= 500; i++)
      await f.db.query(
        "insert into guardian_import_rows(batch_id,source_id,page,ordinal,profile) values($1,$2,1,$3,$4)",
        [id, source, i, { code: "DUKN " + i, name: "Animal " + i }],
      );
    await f.db.query(
      "update guardian_import_sources set status='complete',completed_pages=1 where id=$1",
      [source],
    );
    await f.db.query("update guardian_import_batches set status='review' where id=$1", [id]);
    let b = (
      await f.db.query<{ revision: number }>(
        "select revision from guardian_import_batches where id=$1",
        [id],
      )
    ).rows[0];
    const first = (
      await f.db.query<ImportRow>(
        "select * from guardian_import_rows where batch_id=$1 order by ordinal limit 1",
        [id],
      )
    ).rows[0];
    await f.rpc("select guardian_import_review($1,$2,$3,'edit',$4) data", [
      phone,
      id,
      b.revision,
      {
        id: first.id,
        profile: { code: "DUKN 1", name: "Corrigido" },
        issues: [],
        updateFields: [],
      },
    ]);
    b = (
      await f.db.query<{ revision: number }>(
        "select revision from guardian_import_batches where id=$1",
        [id],
      )
    ).rows[0];
    const ids = (
      await f.db.query<{ id: string }>(
        "select id from guardian_import_rows where batch_id=$1 and ordinal<=100",
        [id],
      )
    ).rows.map((r) => r.id);
    assert.equal(
      await f.rpc("select guardian_import_review($1,$2,$3,'approve',$4) data", [
        phone,
        id,
        b.revision,
        { ids },
      ]),
      true,
    );
    assert.equal(
      (
        await f.db.query(
          "select id from guardian_import_rows where batch_id=$1 and status='approved'",
          [id],
        )
      ).rows.length,
      100,
    );
    await f.db.close();
    f = await farmIntegration(path, true);
    assert.equal(
      (await f.db.query("select * from guardian_import_rows where batch_id=$1", [id])).rows.length,
      500,
    );
    const run = async () => {
      const batch = (
        await f.db.query<{ revision: number }>(
          "select revision from guardian_import_batches where id=$1",
          [id],
        )
      ).rows[0];
      while (true) {
        const chunk = (
          await f.db.query<ImportRow>(
            "select * from guardian_import_rows where batch_id=$1 and status='approved' order by ordinal limit 20",
            [id],
          )
        ).rows;
        if (!chunk.length) break;
        const s = await f.guardian.load(phone);
        let book = s.active!.book;
        const results = [];
        const message = "import:" + chunk[0].id;
        for (const r of chunk) {
          const planned = prepareImportRow(r, book);
          if (planned.action)
            book = applyFarmAction(
              book,
              planned.action,
              "owner",
              { actor: phone, messageId: message, at: new Date().toISOString(), confirmed: true },
              r.id,
            ).book;
          results.push({ id: r.id, status: planned.status, result: planned.result });
        }
        const args = [
          phone,
          id,
          batch.revision,
          s.accountVersion,
          s.active!.version,
          message,
          FarmBookSchema.parse(book),
          results,
          "chunk saved",
          s.pending,
        ];
        const committed = await f.rpc(
          "select guardian_import_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) data",
          args,
        );
        assert.equal(committed, "committed");
        assert.equal(
          await f.rpc("select guardian_import_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) data", args),
          "conflict",
        );
      }
    };
    await run();
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 100);
    assert.equal((await f.guardian.load(phone)).active!.book.animals[0].name, "Corrigido");
    await f.db.query("update guardian_import_batches set status='review' where id=$1", [id]);
    b = (
      await f.db.query<{ revision: number }>(
        "select revision from guardian_import_batches where id=$1",
        [id],
      )
    ).rows[0];
    await f.rpc("select guardian_import_review($1,$2,$3,'approve','{}') data", [
      phone,
      id,
      b.revision,
    ]);
    await run();
    const final = await f.guardian.load(phone);
    assert.equal(final.active!.book.animals.length, 500);
    assert.equal(final.active!.book.tasks.length, 0);
    assert.equal(final.active!.book.ledger.length, 0);
    assert.equal(new Set(final.active!.book.animals.map((a) => a.code)).size, 500);
  } finally {
    await f.db.close();
    await rm(path, { recursive: true, force: true });
  }
});
