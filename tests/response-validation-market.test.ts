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

test("unattributed money remains blocked when no commercial evidence exists", () => {
  const result = validateGrounding("O valor está em R$ 350,00.", {
    commercial: false,
    currentMarket: false,
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("unsupported_commercial_fact"));
});
