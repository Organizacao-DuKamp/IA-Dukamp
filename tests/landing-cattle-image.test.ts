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

test("usa um Nelore exclusivo no cartão de observação", async () => {
  const landing = await readFile("src/routes/index.tsx", "utf8");
  const css = await readFile("src/landing.css", "utf8");

  assert.match(landing, /observationCattlePhoto = "\/tpec-nelore-observation\.webp"/);
  assert.match(landing, /"O que devo observar neste caso\?"[^\n]+image: observationCattlePhoto/);
  assert.doesNotMatch(css, /article:nth-child\(4\)[^\n]+content\s*:\s*url/);
});
