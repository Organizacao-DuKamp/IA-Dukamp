import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("preserva a proporção da foto do pecuarista com o Nelore", async () => {
  const css = await readFile("src/landing-whatsapp-reference.css", "utf8");
  const rules = [...css.matchAll(/\.whatsapp-field-reference\s*\{([\s\S]*?)\}/g)].map((match) => match[1]).join("\n");

  assert.doesNotMatch(rules, /object-fit\s*:\s*fill/);
  assert.doesNotMatch(rules, /width\s*:\s*\d+%/);
  assert.match(rules, /height\s*:\s*100%/);
  assert.match(rules, /width\s*:\s*auto/);
});
