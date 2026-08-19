import assert from "node:assert/strict";
import test from "node:test";

import { validateGrounding } from "../src/lib/chat/response-validation.ts";

test("attributed external market indicator is allowed in a broad market overview", () => {
  const result = validateGrounding(
    "Segundo o CEPEA, em 18/08/2026 o indicador ficou em R$ 350,00/@ em São Paulo.",
    { commercial: false, currentMarket: false },
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("market overview with dated sourced prices never becomes a DuKamp commercial fallback", () => {
  const result = validateGrounding(
    "Boi gordo — São Paulo: R$ 346,50/@ em 18/08/2026. Fonte: Brasil61. Frango no atacado: R$ 7,21/kg em 18/08/2026. Fonte: Agron.",
    { commercial: false, currentMarket: false },
  );

  assert.equal(result.valid, true);
  assert.ok(!result.issues.includes("unsupported_commercial_fact"));
});

test("incomplete market money requests market correction instead of commercial fallback", () => {
  const result = validateGrounding("O mercado de boi gordo está em R$ 350,00.", {
    commercial: false,
    currentMarket: false,
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("market_price_without_explicit_date"));
  assert.ok(result.issues.includes("market_price_without_source"));
  assert.ok(result.issues.includes("market_price_without_unit"));
  assert.ok(!result.issues.includes("unsupported_commercial_fact"));
});

test("unattributed non-market money remains blocked when no commercial evidence exists", () => {
  const result = validateGrounding("O valor está em R$ 350,00.", {
    commercial: false,
    currentMarket: false,
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("unsupported_commercial_fact"));
});
