import assert from "node:assert/strict";
import test from "node:test";

import { selectAdaptiveModelRoute } from "../src/lib/chat/model-router.ts";

const user = (content: string) => [{ role: "user" as const, content }];

test("turnos leves usam Luna com raciocínio low", () => {
  const route = selectAdaptiveModelRoute(user("Bom dia"), {
    sourcePolicy: "CONVERSA CASUAL: responda naturalmente.",
    researchDepth: "none",
  });

  assert.deepEqual(route, {
    tier: "luna",
    reasoningEffort: "low",
    reason: "lightweight_turn",
    escalated: false,
  });
});

test("conversa normal sem domínio usa Luna mesmo com mais de uma frase", () => {
  const route = selectAdaptiveModelRoute(user("Tudo bem por aí? Como você está?"));

  assert.equal(route.tier, "luna");
  assert.equal(route.reasoningEffort, "low");
  assert.equal(route.reason, "lightweight_turn");
});

test("pergunta pecuária normal usa Terra medium", () => {
  const route = selectAdaptiveModelRoute(user("O que é creep feeding e quando costuma ser usado?"));

  assert.equal(route.tier, "terra");
  assert.equal(route.reasoningEffort, "medium");
  assert.equal(route.reason, "default_balanced");
  assert.equal(route.escalated, false);
});

test("pesquisa atual normal continua em Terra medium", () => {
  const route = selectAdaptiveModelRoute(user("Quanto está o bezerro em São Paulo hoje?"), {
    context: "CHATGPT_WEB_SEARCH_REQUIRED\nPROFILE: current_market\nDEPTH: medium",
  });

  assert.equal(route.tier, "terra");
  assert.equal(route.reasoningEffort, "medium");
  assert.equal(route.reason, "current_research");
});

test("cálculo e tarefa clínica complexa sobem para Sol medium", () => {
  const calculation = selectAdaptiveModelRoute(
    user("Calcule e formule uma dieta para 80 novilhas com essas exigências."),
  );
  const clinical = selectAdaptiveModelRoute(
    user("Faça um diagnóstico diferencial e avalie a dosagem desse medicamento."),
  );

  assert.equal(calculation.tier, "sol");
  assert.equal(calculation.reasoningEffort, "medium");
  assert.equal(clinical.tier, "sol");
  assert.equal(clinical.reasoningEffort, "medium");
});

test("falha de validação escala para Sol high", () => {
  const route = selectAdaptiveModelRoute(user("Qual a cotação?"), {
    sourcePolicy: "CORREÇÃO OBRIGATÓRIA ANTES DE RESPONDER: faltou data e fonte.",
    researchDepth: "high",
  });

  assert.equal(route.tier, "sol");
  assert.equal(route.reasoningEffort, "high");
  assert.equal(route.reason, "validation_correction");
  assert.equal(route.escalated, true);
});
