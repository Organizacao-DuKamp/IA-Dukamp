import assert from "node:assert/strict";
import test from "node:test";

import { classifyDomainIntent } from "../src/lib/chat/intent.ts";

test("broad meat-market questions use current research instead of strict quote flow", () => {
  const result = classifyDomainIntent("como está o mercado de carnes no Brasil hoje?");

  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, false);
});

test("explicit livestock price questions still use the market quote flow", () => {
  const result = classifyDomainIntent("qual a cotação do boi gordo hoje?");

  assert.equal(result.intent, "market_quote");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, false);
});

test("generic current market questions still request current web research", () => {
  const result = classifyDomainIntent("como está o mercado pecuário hoje?");

  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, false);
});

test("milk market panorama is research, not a forced quote", () => {
  const result = classifyDomainIntent("como está o mercado do leite hoje?");

  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
});

test("explicit milk price remains a quote", () => {
  const result = classifyDomainIntent("qual o preço do leite hoje?");

  assert.equal(result.intent, "market_quote");
  assert.equal(result.needs_web_search, true);
});

test("feeding corn to cattle is nutrition and must not trigger quote grounding", () => {
  const result = classifyDomainIntent("posso dar milho para o gado na ração?");

  assert.equal(result.intent, "nutrition");
  assert.equal(result.needs_internal_search, true);
  assert.equal(result.needs_web_search, false);
});

test("feeding corn today remains nutrition instead of becoming an implicit quote", () => {
  const result = classifyDomainIntent("posso dar milho para o gado hoje na ração?");

  assert.equal(result.intent, "nutrition");
  assert.equal(result.needs_web_search, false);
});

test("explicit corn price triggers market quote", () => {
  const result = classifyDomainIntent("quanto está o milho hoje?");

  assert.equal(result.intent, "market_quote");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, false);
});

test("short implicit quote still understands corn today", () => {
  const result = classifyDomainIntent("milho hoje?");

  assert.equal(result.intent, "market_quote");
  assert.equal(result.needs_web_search, true);
});

test("soy market panorama is current research rather than a price quote", () => {
  const result = classifyDomainIntent("qual o panorama do mercado de soja hoje?");

  assert.equal(result.intent, "current_research");
  assert.equal(result.needs_web_search, true);
});
