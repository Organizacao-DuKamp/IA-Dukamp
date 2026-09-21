import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInterpretationDirective,
  classifyUserIntent,
  createConversationState,
} from "../src/lib/chat/state.ts";

test("resposta curta prioriza a última pergunta proativa sobre tópico antigo de clima", () => {
  const state = createConversationState("wa:test");
  state.current_topic = "clima e previsão do tempo";
  state.user_goal = "ver previsão do tempo para São José do Rio Preto";

  const text = "Continua do mesmo jeito";
  const lastAssistant =
    "Como estão os 2 bovinos que apresentaram sinais de doença? Houve alguma melhora ou eles continuam do mesmo jeito?";

  const analysis = classifyUserIntent(text, state);
  assert.equal(analysis.intent, "continuacao");

  const directive = buildInterpretationDirective(state, analysis, text, lastAssistant);
  assert.ok(directive);
  assert.match(directive!, /referência PRINCIPAL/i);
  assert.match(directive!, /2 bovinos/i);
  assert.match(directive!, /Interprete a mensagem atual como resposta a essa fala/i);
});

test("continuação sem última fala ainda usa o tópico persistido como fallback", () => {
  const state = createConversationState("wa:test");
  state.current_topic = "clima e previsão do tempo";

  const analysis = classifyUserIntent("E amanhã?", state);
  const directive = buildInterpretationDirective(state, analysis, "E amanhã?", null);

  assert.ok(directive);
  assert.match(directive!, /clima e previsão do tempo/i);
});
