import assert from "node:assert/strict";
import test from "node:test";
import { classifyDomainIntent } from "../src/lib/chat/intent.ts";

test("generic bovine mineral compatibility for sheep is nutrition, not catalog", () => {
  const result = classifyDomainIntent(
    "Posso usar um suplemento mineral bovino DuKamp para ovelhas?",
  );
  assert.equal(result.intent, "nutrition");
  assert.equal(result.needs_internal_search, true);
});

test("generic bovine ration compatibility for horses is nutrition, not catalog", () => {
  const result = classifyDomainIntent("Posso fornecer ração de bovino para cavalos?");
  assert.equal(result.intent, "nutrition");
});

test("catalog listing remains a product intent", () => {
  const result = classifyDomainIntent("Quais suplementos minerais DuKamp vocês têm?");
  assert.equal(result.intent, "product");
});

test("explicit product recommendation remains commercial", () => {
  const result = classifyDomainIntent("Qual produto DuKamp é indicado para novilhas na seca?");
  assert.equal(result.intent, "product_recommendation");
});
