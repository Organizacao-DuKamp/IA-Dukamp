import assert from "node:assert/strict";
import test from "node:test";

import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { validateWeatherGrounding } from "../src/lib/chat/response-validation.ts";
import { applyAssistantTurn, createConversationState } from "../src/lib/chat/state.ts";
import {
  extractWeatherLocation,
  isWeatherRequest,
  resolveWeatherTurn,
  WEATHER_LOCATION_QUESTION,
  weatherSourceDirective,
} from "../src/lib/chat/weather.ts";

test("pedido de previsão com cidade e UF usa intenção meteorológica", () => {
  const result = classifyDomainIntent("Vai chover em Monte Aprazível - SP amanhã?");

  assert.equal(result.intent, "weather_forecast");
  assert.equal(result.needs_web_search, true);
  assert.equal(result.needs_internal_search, true);
  assert.equal(result.location, "Monte Aprazível - SP");
});

test("risco de calor regional também usa pesquisa meteorológica", () => {
  const result = classifyDomainIntent(
    "Qual o risco de calor para as vacas em Araçatuba/SP nesta semana?",
  );

  assert.equal(result.intent, "weather_forecast");
  assert.equal(result.location, "Araçatuba/SP");
});

test("localização também é extraída sem preposição", () => {
  assert.equal(
    extractWeatherLocation("previsão do tempo Monte Aprazível SP"),
    "Monte Aprazível SP",
  );
});

test("pedido meteorológico sem região não inventa localização", () => {
  const result = classifyDomainIntent("Qual é a previsão do tempo para amanhã?");

  assert.equal(result.intent, "weather_forecast");
  assert.equal(result.location, null);
});

test("tempo de entrega não é confundido com meteorologia", () => {
  assert.equal(isWeatherRequest("Quanto tempo demora a entrega do produto?"), false);
  assert.notEqual(
    classifyDomainIntent("Quanto tempo demora a entrega do produto?").intent,
    "weather_forecast",
  );
});

test("cidade enviada sozinha completa a pergunta meteorológica pendente", () => {
  const state = createConversationState("weather-follow-up");
  state.current_topic = "clima e previsão do tempo";
  state.pending_action = "consultar_previsao_tempo";
  state.pending_question = "Qual cidade e estado (UF) você quer consultar?";
  state.awaiting_user_response = true;

  const resolved = resolveWeatherTurn("Monte Aprazível - SP", state);
  assert.equal(resolved.isWeatherTurn, true);
  assert.equal(resolved.location, "Monte Aprazível - SP");
  assert.equal(resolved.usedRememberedLocation, false);
});

test("pergunta de localização exata funciona mesmo se só pending_question sobreviver", () => {
  const state = createConversationState("weather-pending-question-only");
  state.pending_question = WEATHER_LOCATION_QUESTION;
  state.awaiting_user_response = true;

  const resolved = resolveWeatherTurn("Monte aprazivel", state);
  assert.equal(resolved.isWeatherTurn, true);
  assert.equal(resolved.location, "Monte aprazivel");
});

test("histórico recupera cidade enviada após pergunta de clima quando state chega vazio", () => {
  const state = createConversationState("weather-history-recovery");

  const resolved = resolveWeatherTurn("Monte aprazivel", state, WEATHER_LOCATION_QUESTION);
  assert.equal(resolved.isWeatherTurn, true);
  assert.equal(resolved.location, "Monte aprazivel");
  assert.equal(resolved.usedRememberedLocation, false);
});

test("continuação como e amanhã reutiliza a última localização meteorológica", () => {
  const state = createConversationState("weather-memory");
  state.current_topic = "clima e previsão do tempo";
  state.confirmed_data.weather_location = "Monte Aprazível - SP";

  const resolved = resolveWeatherTurn("e amanhã?", state);
  assert.equal(resolved.isWeatherTurn, true);
  assert.equal(resolved.location, "Monte Aprazível - SP");
  assert.equal(resolved.usedRememberedLocation, true);
});

test("pergunta cidade e UF antes de pesquisar e mantém a ação pendente", () => {
  const state = createConversationState("weather-location-required");
  state.current_topic = "clima e previsão do tempo";
  state.pending_action = "consultar_previsao_tempo";
  state.missing_data.push("weather_location");

  const finalState = applyAssistantTurn(state, WEATHER_LOCATION_QUESTION);

  assert.match(WEATHER_LOCATION_QUESTION, /qual é a sua cidade e o estado \(UF\)/i);
  assert.equal(finalState.pending_action, "consultar_previsao_tempo");
  assert.equal(finalState.expected_response_type, "data");
  assert.ok(finalState.missing_data.includes("weather_location"));
});

test("validação meteorológica exige local, data, fonte e detalhes", () => {
  const valid = validateWeatherGrounding(
    "Monte Aprazível/SP — atualização de 27/08/2026 às 08:00 BRT. Segundo o INMET, a temperatura máxima prevista é 31 °C, com possibilidade de chuva e vento moderado.",
    "Monte Aprazível - SP",
  );
  assert.equal(valid.valid, true);

  const invalid = validateWeatherGrounding(
    "Amanhã pode chover e a temperatura deve cair.",
    "Monte Aprazível - SP",
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.includes("weather_location_missing"));
  assert.ok(invalid.issues.includes("weather_date_missing"));
  assert.ok(invalid.issues.includes("weather_source_missing"));
});

test("diretriz meteorológica prioriza fontes oficiais e impacto pecuário", () => {
  const directive = weatherSourceDirective("Monte Aprazível - SP");
  assert.match(directive, /INMET/);
  assert.match(directive, /CPTEC\/INPE/);
  assert.match(directive, /pelo menos duas fontes/i);
  assert.match(directive, /conforto térmico/i);
});
