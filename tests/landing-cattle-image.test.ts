import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mantém a imagem exclusiva do painel de análise corporal", async () => {
  const animations = await readFile("public/landing-animations.js", "utf8");
  const rootRoute = await readFile("src/routes/__root.tsx", "utf8");
  const weakImages = animations.match(/const WEAK_CATTLE_IMAGES = \[([\s\S]*?)\];/)?.[1] ?? "";

  assert.doesNotMatch(weakImages, /tpec-nelore-elite-panel\.webp/);
  assert.match(rootRoute, /landing-animations\.js\?v=20260911-panel-image-fix/);
});
