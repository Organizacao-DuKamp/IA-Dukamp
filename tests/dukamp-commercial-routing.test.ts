import assert from "node:assert/strict";
import test from "node:test";

import { classifyDomainIntent } from "../src/lib/chat/intent.ts";

for (const question of [
  "quais produtos vocês têm?",
  "quais suplementos vocês têm?",
  "liste o catálogo da DuKamp",
  "mostre as rações que vocês vendem",
]) {
  test(`pergunta comercial é classificada como product: ${question}`, () => {
    assert.equal(classifyDomainIntent(question).intent, "product");
  });
}

test("pedido de contatos comerciais é classificado como vendedor", () => {
  assert.equal(classifyDomainIntent("quero os contatos comerciais").intent, "seller_contact");
});
