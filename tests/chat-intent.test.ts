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
