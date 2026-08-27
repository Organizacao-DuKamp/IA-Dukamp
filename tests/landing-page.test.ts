import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const landingPath = "src/routes/index.tsx";

test("rota raiz apresenta a vitrine e direciona o atendimento para o WhatsApp", async () => {
  const source = await readFile(landingPath, "utf8");

  assert.match(source, /createFileRoute\("\/"\)/);
  assert.match(source, /Todo o conhecimento da pecuária/);
  assert.match(source, /https:\/\/wa\.me\/5516992256069/);
  assert.match(source, /Falar com a IA do Boi/);
  assert.match(source, /Previsão do tempo aplicada à sua região/);
  assert.doesNotMatch(source, /CattleShowcase|model-viewer|bull-3d/);
});

test("chat web interativo não é carregado pela página principal", async () => {
  const source = await readFile(landingPath, "utf8");

  assert.doesNotMatch(source, /WebChatAdapter|loadConversation|saveConversation/);
  assert.doesNotMatch(source, /<form|<textarea|\/api\/public\/chat/);
});

test("recursos visuais da vitrine enviada estão presentes", async () => {
  for (const asset of [
    "public/tpec-logo.png",
    "public/tpec-hero.png",
    "public/tpec-mobile.png",
    "public/og.png",
  ]) {
    await assert.doesNotReject(() => access(asset), asset);
  }
});

test("estilos da vitrine ficam isolados das telas administrativas", async () => {
  const css = await readFile("src/landing.css", "utf8");

  assert.match(css, /^\.tpec-landing\s*\{/);
  assert.doesNotMatch(css, /(^|\})\s*(body|nav|footer)\s*\{/m);
});
