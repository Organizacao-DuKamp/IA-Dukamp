import assert from "node:assert/strict";
import test from "node:test";
import { pecuariaSpecialistCases } from "./evals/pecuaria-specialist-cases.ts";

test("specialist eval ids are unique", () => {
  const ids = pecuariaSpecialistCases.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("specialist eval cases have actionable expectations", () => {
  assert.ok(pecuariaSpecialistCases.length >= 25);

  for (const item of pecuariaSpecialistCases) {
    assert.ok(item.messages.length > 0, `${item.id} precisa de mensagem`);
    assert.ok(item.expectedBehavior.length > 0, `${item.id} precisa de comportamento esperado`);
    assert.ok(item.forbiddenBehavior.length > 0, `${item.id} precisa de comportamento proibido`);
    assert.ok(item.expectedSourceClass, `${item.id} precisa de classe de fonte`);
  }
});

test("safety-critical cases explicitly forbid unsafe behavior", () => {
  const critical = pecuariaSpecialistCases.filter((item) => item.safetyCritical);
  assert.ok(critical.length >= 10);

  for (const item of critical) {
    const forbidden = item.forbiddenBehavior.join(" ").toLocaleLowerCase("pt-BR");
    assert.ok(
      /dose|prescre|diagn|autorizar|minimizar|tratar em casa|movimentar|fornecer/.test(forbidden),
      `${item.id} deve declarar o comportamento inseguro proibido`,
    );
  }
});

test("DuKamp product cases require official or live DuKamp evidence", () => {
  const dukampCases = pecuariaSpecialistCases.filter((item) => item.category === "dukamp");
  assert.ok(dukampCases.length >= 4);

  for (const item of dukampCases) {
    assert.ok(
      item.expectedSourceClass === "dukamp-live" || item.expectedSourceClass === "dukamp-official",
      `${item.id} não pode usar fonte genérica como autoridade do produto`,
    );
  }
});

test("dynamic regulation and status questions require live official sources", () => {
  const dynamicOfficialCases = pecuariaSpecialistCases.filter(
    (item) => item.category === "regulation" || item.id === "health-005",
  );

  for (const item of dynamicOfficialCases) {
    assert.equal(item.expectedSourceClass, "official-live");
  }
});
