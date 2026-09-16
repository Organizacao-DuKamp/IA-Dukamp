import assert from "node:assert/strict";
import test from "node:test";

import { isSelfContainedCalculation } from "../src/lib/ai/chat.server.ts";
import { classifyUserIntent, createConversationState } from "../src/lib/chat/state.ts";
import { splitOutboundText } from "../src/lib/whatsapp/enhanced-http.server.ts";

const recommendation =
  "Opa comprei 10 cabeça nelore de média de 300 kilos e quero engordar elas e vender com 120 dias e com gmd de 1 a 1.2 kg que me sugere,";

test("complete livestock recommendation is a new question even after stale option state", () => {
  const state = createConversationState("wa:test");
  state.current_topic = "cotações e preços de mercado";
  state.awaiting_user_response = true;
  state.expected_response_type = "option";
  state.offered_options = ["opção antiga 1", "opção antiga 2"];
  state.pending_question = null;
  state.pending_action = null;

  const analysis = classifyUserIntent(recommendation, state);
  assert.equal(analysis.intent, "nova_pergunta");
  assert.equal(analysis.extracted.numero_animais, 10);
  assert.equal(analysis.extracted.periodo_dias, 120);
});

test("GMD target plus recommendation request is not isolated as a pure calculation", () => {
  assert.equal(isSelfContainedCalculation(recommendation), false);
  assert.equal(
    isSelfContainedCalculation(
      "Tenho 80 bois de 420 kg por 90 dias. Calcule o consumo total e o custo por animal.",
    ),
    true,
  );
});

test("long fallback messages are visibly marked as continuations", () => {
  const chunks = splitOutboundText("x".repeat(4155));
  assert.equal(chunks.length, 2);
  assert.match(chunks[0], /^\(1\/2\) /);
  assert.match(chunks[1], /^\(2\/2\) /);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 3500));
});
