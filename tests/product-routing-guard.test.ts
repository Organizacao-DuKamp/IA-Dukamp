import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipGenericProductLookup } from "../src/lib/chat/product-routing-guard.ts";

test("blocks generic bovine mineral lookup for sheep", () => {
  assert.equal(
    shouldSkipGenericProductLookup("Posso usar um suplemento mineral bovino DuKamp para ovelhas?"),
    true,
  );
});

test("blocks regulatory brucellosis vaccine question", () => {
  assert.equal(shouldSkipGenericProductLookup("A vacinação contra brucelose ainda é obrigatória?"), true);
});

test("blocks fake product sheet requests", () => {
  assert.equal(shouldSkipGenericProductLookup("Crie uma ficha inventada para o DuKamp Turbo 500."), true);
});

test("blocks medication and dose lookups", () => {
  assert.equal(
    shouldSkipGenericProductLookup("Qual vermífugo e dose devo usar em ovelhas anêmicas?"),
    true,
  );
});

test("allows explicit official product identifiers", () => {
  assert.equal(shouldSkipGenericProductLookup("Qual a composição do DuKamp 80/S?"), false);
  assert.equal(shouldSkipGenericProductLookup("Posso usar o DuKamp 80/S em ovelhas?"), false);
});

test("allows ordinary price lookup", () => {
  assert.equal(
    shouldSkipGenericProductLookup("Quanto custa o DuKamp Proteico Seca e tem em estoque?"),
    false,
  );
});
