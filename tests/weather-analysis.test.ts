import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeWeatherRequest,
  resolveWeatherTimeWindow,
} from "../src/lib/chat/weather-analysis.ts";

const FIXED_NOW = Date.parse("2026-08-27T14:00:00Z"); // 11:00 em America/Sao_Paulo

test("classifica condição atual simples como consulta rápida", () => {
  const analysis = analyzeWeatherRequest("Qual a temperatura agora?");
  assert.ok(analysis.intents.includes("WEATHER_CURRENT"));
  assert.equal(analysis.depth, "quick");
  assert.equal(analysis.needsModelConsensus, false);
});

test("chuva amanhã usa previsão e consenso de modelos", () => {
  const analysis = analyzeWeatherRequest("Vai chover amanhã?");
  assert.ok(analysis.intents.includes("WEATHER_FORECAST"));
  assert.equal(analysis.dayOffset, 1);
  assert.equal(analysis.depth, "standard");
  assert.equal(analysis.needsModelConsensus, true);
});

test("pergunta de horário ativa previsão horária", () => {
  const analysis = analyzeWeatherRequest("Que horas começa a chover amanhã?");
  assert.ok(analysis.intents.includes("WEATHER_HOURLY"));
  assert.equal(analysis.needsHourly, true);
  assert.equal(analysis.dayOffset, 1);
});

test("decisão operacional com gado recebe análise profunda e pecuária", () => {
  const analysis = analyzeWeatherRequest("Vai chover bastante amanhã? Preciso levar o gado.");
  assert.ok(analysis.intents.includes("WEATHER_FORECAST"));
  assert.ok(analysis.intents.includes("WEATHER_AGRO_ANALYSIS"));
  assert.equal(analysis.agroAnalysis, true);
  assert.equal(analysis.highImpactDecision, true);
  assert.equal(analysis.depth, "deep");
});

test("frente fria ativa alerta e cruzamento web complementar", () => {
  const analysis = analyzeWeatherRequest("Vai ter frente fria no fim de semana?");
  assert.ok(analysis.intents.includes("WEATHER_ALERT"));
  assert.equal(analysis.weekend, true);
  assert.equal(analysis.needsWebCrosscheck, true);
  assert.equal(analysis.depth, "deep");
});

test("calor prejudicando o gado produz múltiplos intents", () => {
  const analysis = analyzeWeatherRequest("Esse calor pode prejudicar o gado amanhã à tarde?");
  assert.ok(analysis.intents.includes("WEATHER_FORECAST"));
  assert.ok(analysis.intents.includes("WEATHER_HOURLY"));
  assert.ok(analysis.intents.includes("WEATHER_AGRO_ANALYSIS"));
  assert.equal(analysis.period, "afternoon");
});

test("amanhã vira data absoluta no fuso da localidade", () => {
  const window = resolveWeatherTimeWindow(
    analyzeWeatherRequest("Vai chover amanhã?"),
    "America/Sao_Paulo",
    FIXED_NOW,
  );
  assert.equal(window.localDate, "2026-08-27");
  assert.equal(window.startDate, "2026-08-28");
  assert.equal(window.endDate, "2026-08-28");
  assert.equal(window.localNow, "2026-08-27 11:00");
});

test("fim de semana vira sábado e domingo absolutos", () => {
  const window = resolveWeatherTimeWindow(
    analyzeWeatherRequest("Como fica o fim de semana?"),
    "America/Sao_Paulo",
    FIXED_NOW,
  );
  assert.equal(window.startDate, "2026-08-29");
  assert.equal(window.endDate, "2026-08-30");
});

test("período da manhã limita a janela horária", () => {
  const window = resolveWeatherTimeWindow(
    analyzeWeatherRequest("Posso trabalhar amanhã de manhã?"),
    "America/Sao_Paulo",
    FIXED_NOW,
  );
  assert.equal(window.startDate, "2026-08-28");
  assert.equal(window.startHour, 6);
  assert.equal(window.endHour, 11);
});

test("dia da semana é resolvido para a próxima ocorrência", () => {
  const window = resolveWeatherTimeWindow(
    analyzeWeatherRequest("Vai chover domingo?"),
    "America/Sao_Paulo",
    FIXED_NOW,
  );
  assert.equal(window.startDate, "2026-08-30");
  assert.equal(window.endDate, "2026-08-30");
});
