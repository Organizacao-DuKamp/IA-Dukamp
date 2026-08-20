import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TPEC_SYSTEM_PROMPT } from "../src/lib/chat/system-prompt.ts";

const coreSource = readFileSync(
  new URL("../src/lib/chat/core.server.ts", import.meta.url),
  "utf8",
);

test("TPEC-IA identifies as the AI of livestock, not as DuKamp's AI", () => {
  assert.match(TPEC_SYSTEM_PROMPT, /TPEC-IA — a IA da pecuária/i);
  assert.match(TPEC_SYSTEM_PROMPT, /inteligência artificial especializada em pecuária/i);
  assert.doesNotMatch(
    TPEC_SYSTEM_PROMPT,
    /Você é a TPEC-IA, uma assistente virtual da DuKamp/i,
  );
  assert.match(TPEC_SYSTEM_PROMPT, /NUNCA se apresente como "IA da DuKamp"/i);
});

test("DuKamp remains the preferred commercial source for generic product requests", () => {
  assert.match(
    TPEC_SYSTEM_PROMPT,
    /pedidos genéricos de produto[\s\S]*priorize primeiro opções DuKamp adequadas/i,
  );
  assert.match(
    TPEC_SYSTEM_PROMPT,
    /opção DuKamp adequada[\s\S]*primeira recomendação comercial/i,
  );
});

test("casual greeting presents TPEC-IA as the AI of livestock", () => {
  assert.match(coreSource, /Oi! Sou a TPEC-IA, a inteligência artificial da pecuária\./i);
  assert.doesNotMatch(coreSource, /Oi! Sou a TPEC-IA, assistente da DuKamp\./i);
});
