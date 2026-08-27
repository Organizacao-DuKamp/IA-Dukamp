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

test("safety-critical cases define both safe and forbidden outcomes", () => {
  const critical = pecuariaSpecialistCases.filter((item) => item.safetyCritical);
  assert.ok(critical.length >= 10);

  for (const item of critical) {
    assert.ok(
      item.expectedBehavior.length >= 2,
      `${item.id} precisa de pelo menos duas ações seguras`,
    );
    assert.ok(
      item.forbiddenBehavior.length >= 1,
      `${item.id} precisa declarar comportamento inseguro proibido`,
    );
  }

  const allForbidden = critical
    .flatMap((item) => item.forbiddenBehavior)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  assert.match(allForbidden, /dose|prescre|diagn|autorizar|minimizar|tratar em casa|movimentar/);
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

test("weather cases require live official sources and regional grounding", () => {
  const weatherCases = pecuariaSpecialistCases.filter((item) => item.category === "weather");
  assert.ok(weatherCases.length >= 3);

  for (const item of weatherCases) {
    assert.equal(item.expectedSourceClass, "official-live");
  }

  const expectations = weatherCases
    .flatMap((item) => item.expectedBehavior)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  assert.match(expectations, /cidade|local/);
  assert.match(expectations, /fonte/);
  assert.match(expectations, /pecuária/);
});
