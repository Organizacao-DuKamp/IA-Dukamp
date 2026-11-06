import test from "node:test";
import assert from "node:assert/strict";
import { certificateItems } from "./helpers/abcz-certificate.ts";
import { parseAbczCertificate } from "../src/lib/guardian/abcz-pdf.server.ts";
import { pedigreeTreeNodes, pedigreeTreeLabel } from "../src/lib/guardian/pedigree-tree.ts";

test("four-generation tree preserves branch positions, missing ancestors and repeated animals", () => {
  const animal = parseAbczCertificate(certificateItems, 842, 595);
  const nodes = pedigreeTreeNodes(animal, 4);
  assert.equal(nodes.length, 31);
  assert.equal(nodes.filter((n) => n.code).length, 29);
  assert.equal(nodes.find((n) => n.path === "sire.dam.dam.sire")!.code, undefined);
  for (const [path, parent, index] of [
    ["sire", "", 0],
    ["dam", "", 1],
    ["sire.dam", "sire", 1],
    ["dam.sire", "dam", 2],
  ] as const) {
    const node = nodes.find((n) => n.path === path)!;
    assert.equal(node.parentPath, parent);
    assert.equal(node.index, index);
  }
  const repeated = nodes.filter((n) => n.code === "L4810");
  assert.ok(repeated.length >= 2);
  assert.notEqual(repeated[0].path, repeated[1].path);
  assert.equal(pedigreeTreeLabel("dam.sire"), "Avô materno");
  assert.equal(pedigreeTreeNodes(animal, 2).length, 7);
});

test("manual parents work without an imported pedigree and editing a parent hides stale descendants", () => {
  const manual = pedigreeTreeNodes({ code: "B1", sire: "Pai declarado", dam: "Mãe declarada" }, 1);
  assert.equal(manual.find((n) => n.path === "sire")!.code, "Pai declarado");
  const animal = parseAbczCertificate(certificateItems, 842, 595);
  const edited = pedigreeTreeNodes({ ...animal, sire: "Outro pai" }, 4);
  assert.equal(edited.find((n) => n.path === "sire")!.code, "Outro pai");
  assert.equal(edited.find((n) => n.path === "sire")!.name, undefined);
  assert.equal(edited.find((n) => n.path === "sire.sire")!.code, undefined);
  assert.equal(edited.find((n) => n.path === "dam.sire")!.code, "QUI 8125");
  assert.equal(pedigreeTreeNodes({ code: "sem-pais" }, 1).filter((n) => n.code).length, 1);
});
