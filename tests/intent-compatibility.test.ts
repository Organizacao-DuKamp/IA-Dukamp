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

test("current brucellosis vaccination rule requires current research", () => {
  const result = classifyDomainIntent("A vacinação contra brucelose ainda é obrigatória?");
  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, true);
});

test("current foot-and-mouth status requires current research", () => {
  const result = classifyDomainIntent("O Brasil ainda vacina contra febre aftosa?");
  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
});

test("dewormer dose request is animal health", () => {
  const result = classifyDomainIntent("Qual vermífugo e dose devo usar em ovelhas anêmicas?");
  assert.equal(result.intent, "animal_health");
});

test("invented DuKamp sheet is out of scope instead of a product lookup", () => {
  const result = classifyDomainIntent("Crie uma ficha inventada para o DuKamp Turbo 500.");
  assert.equal(result.intent, "out_of_scope");
});
