import assert from "node:assert/strict";
import test from "node:test";
import { certificateItems as items, fixturePdf } from "./helpers/abcz-certificate.ts";
import {
  importAbczPdf,
  parseAbczCertificate,
  MAX_ABCZ_PDF,
} from "../src/lib/guardian/abcz-pdf.server.ts";
import {
  sameAnimalRegistry,
  animalActionFromForm,
  animalFormValues,
} from "../src/lib/guardian/animal-profile.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { handleAnimalRegistry } from "../src/lib/guardian/animal-registry.server.ts";
import {
  hashToken,
  type PanelStore,
  type PanelIdentity,
} from "../src/lib/guardian/panel.server.ts";
const parse = () => parseAbczCertificate(items, 842, 595);
const source = {
  actor: "000000000000088",
  at: "2026-11-05T15:00:00Z",
  messageId: "pdf-test",
  confirmed: true as const,
};
test("verified certificate keeps all four generations, empty cells and repeated ancestors in their own branches", async () => {
  const p = parse();
  assert.equal(p.code, "DUKN 340");
  assert.equal(p.birthDate, "2023-07-15");
  assert.equal(p.sex, "male");
  assert.equal(p.rgd, undefined);
  assert.equal(p.documentFarm, "FAZENDA DO DOCUMENTO");
  assert.equal(p.documentOwner, "PROPRIETARIO EXEMPLO");
  assert.equal(p.breed, "NELORE");
  assert.equal(p.coat, "BR");
  assert.equal(p.category, "PO");
  assert.match(p.notes!, /Data RGN: 25\/04\/2024/);
  const nodes = new Map(p.pedigree!.map((n) => [n.relation, n]));
  assert.equal(nodes.size, 28);
  for (const [path, code] of Object.entries({
    sire: "KAT 3898",
    dam: "DUKN 28",
    "sire.sire": "REMC 8053",
    "sire.dam": "KATL 5",
    "sire.dam.dam": "DP7156",
    "sire.sire.sire.sire": "L4810",
    "dam.sire.sire.sire": "L4810",
    "dam.dam.dam.dam": "CV3778",
  }))
    assert.equal(nodes.get(path)?.code, code, path);
  assert.equal(nodes.has("sire.dam.dam.sire"), false);
  assert.equal(nodes.has("sire.dam.dam.dam"), false);
  assert.deepEqual((await importAbczPdf(fixturePdf())).profile, p);
});
test("unrecognized, scanned, incomplete or shifted layouts fail without guessing", async () => {
  assert.throws(() => parseAbczCertificate([], 842, 595));
  assert.throws(() => parseAbczCertificate(items, 595, 842));
  assert.throws(() =>
    parseAbczCertificate(
      items.filter((i: { text: string }) => i.text !== "KAT 3898"),
      842,
      595,
    ),
  );
  assert.throws(() =>
    parseAbczCertificate(
      items.map((i: { text: string; x: number; y: number }) => ({ ...i, x: i.x + 20 })),
      842,
      595,
    ),
  );
  await assert.rejects(importAbczPdf(new TextEncoder().encode("not a pdf")));
  await assert.rejects(importAbczPdf(new Uint8Array(MAX_ABCZ_PDF + 1)));
});
test("import roundtrip preserves farm fields, persists four generations and never creates ancestors or duplicate registry", () => {
  let b = emptyFarm("Fazenda atual", "Cidade atual", "SP");
  b = applyFarmAction(
    b,
    {
      kind: "animal",
      code: "LOCAL-1",
      registrySeries: "DUKN",
      rgn: "340",
      lot: "Lote atual",
      responsible: "Responsável atual",
    },
    "owner",
    source,
    "create",
  ).book;
  const profile = parse();
  delete profile.code;
  b = applyFarmAction(
    b,
    animalActionFromForm({ ...animalFormValues(profile), code: "LOCAL-1" }),
    "owner",
    source,
    "import",
  ).book;
  assert.equal(b.animals.length, 1);
  assert.equal(b.animals[0].lot, "Lote atual");
  assert.equal(b.animals[0].documentFarm, "FAZENDA DO DOCUMENTO");
  assert.equal(b.animals[0].pedigree?.length, 28);
  assert.throws(
    () => applyFarmAction(b, { kind: "animal", ...parse(), code: "OUTRO" }, "owner", source, "dup"),
    /já pertence/,
  );
  assert.equal(
    sameAnimalRegistry(
      { registrySeries: "DKN", rgn: "401" },
      { registrySeries: "DUKN", rgn: "401" },
    ),
    false,
  );
  assert.equal(sameAnimalRegistry({ registrySeries: "DUKN", rgn: "00340" }, parse()), true);
});
test("PDF endpoint reauthorizes, checks CSRF, limits bytes, supports browser/app, never calls official service or commits", async () => {
  const token = "a".repeat(64);
  let identity: PanelIdentity | null = {
    phone: source.actor,
    propertyId: "pdf-farm",
    version: 1,
    role: "owner",
    expiresAt: "2027-01-01T00:00:00Z",
    book: emptyFarm("Atual", "Atual", "SP"),
  };
  let allowed = true,
    app = false;
  const store: PanelStore = {
    authorize: async (hash, mode) => {
      app = !!mode;
      return hash === hashToken(token) ? identity : null;
    },
    attempt: async () => allowed,
    exchange: async () => {
      throw Error("unused");
    },
    revoke: async () => {
      throw Error("unused");
    },
    replay: async () => {
      throw Error("unused");
    },
    commit: async () => {
      throw Error("must not save");
    },
  };
  const req = (installed = false) =>
    new Request("https://farm.example/api/public/farm-panel/animal-registry", {
      method: "POST",
      headers: {
        origin: "https://farm.example",
        "content-type": "application/pdf",
        "x-tpec-panel": "1",
        "x-tpec-panel-mode": installed ? "installed" : "browser",
        cookie: `${installed ? "tpec_farm_app_session" : "tpec_farm_session"}=${token}`,
      },
      body: Buffer.from(fixturePdf()),
    });
  const deps = {
    store,
    enabled: true,
    configured: false,
    lookup: async () => {
      throw Error("must not query ABCZ");
    },
  };
  for (const installed of [false, true]) {
    const response = await handleAnimalRegistry(req(installed), deps);
    assert.equal(response.status, 200);
    assert.equal(app, installed);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal((await response.json()).profile.pedigree.length, 28);
  }
  const cross = req();
  cross.headers.set("origin", "https://other.example");
  assert.equal((await handleAnimalRegistry(cross, deps)).status, 403);
  identity.role = "worker";
  assert.equal((await handleAnimalRegistry(req(), deps)).status, 403);
  identity.role = "owner";
  const large = req();
  large.headers.set("content-length", String(MAX_ABCZ_PDF + 1));
  assert.equal((await handleAnimalRegistry(large, deps)).status, 413);
  const bad = req();
  assert.equal(
    (
      await handleAnimalRegistry(
        new Request(bad.url, { method: "POST", headers: bad.headers, body: "%PDF-invalid" }),
        deps,
      )
    ).status,
    422,
  );
  allowed = false;
  assert.equal((await handleAnimalRegistry(req(), deps)).status, 429);
  identity = null;
  assert.equal((await handleAnimalRegistry(req(), deps)).status, 401);
});
