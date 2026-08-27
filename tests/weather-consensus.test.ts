import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyConsensus, precipitationConfidence } from "../src/lib/chat/weather-consensus.ts";

test("consenso preserva faixa quando ECMWF GFS e ICON divergem no volume", () => {
  const [day] = buildDailyConsensus([
    {
      model: "ECMWF IFS",
      date: "2026-08-28",
      precipitationMm: 18,
      temperatureMinC: 20,
      temperatureMaxC: 31,
      windGustMaxKmh: 35,
    },
    {
      model: "GFS",
      date: "2026-08-28",
      precipitationMm: 7,
      temperatureMinC: 19,
      temperatureMaxC: 32,
      windGustMaxKmh: 42,
    },
    {
      model: "ICON",
      date: "2026-08-28",
      precipitationMm: 12,
      temperatureMinC: 20,
      temperatureMaxC: 31.5,
      windGustMaxKmh: 39,
    },
  ]);

  assert.equal(day.precipitation.minMm, 7);
  assert.equal(day.precipitation.maxMm, 18);
  assert.equal(day.precipitation.medianMm, 12);
  assert.equal(day.precipitation.rainVotes, 3);
  assert.equal(day.precipitation.confidence, "moderate");
});

test("modelos concordando em pouca ou nenhuma chuva geram confiança alta", () => {
  assert.equal(precipitationConfidence([0, 0.1, 0]), "high");
});

test("sinal dividido entre chuva e tempo seco reduz confiança", () => {
  assert.equal(precipitationConfidence([0, 0.1, 14]), "low");
});

test("consenso agrupa vários dias sem misturar datas", () => {
  const days = buildDailyConsensus([
    {
      model: "ECMWF IFS",
      date: "2026-08-28",
      precipitationMm: 2,
      temperatureMinC: 19,
      temperatureMaxC: 30,
      windGustMaxKmh: 30,
    },
    {
      model: "GFS",
      date: "2026-08-28",
      precipitationMm: 3,
      temperatureMinC: 20,
      temperatureMaxC: 31,
      windGustMaxKmh: 32,
    },
    {
      model: "ECMWF IFS",
      date: "2026-08-29",
      precipitationMm: 0,
      temperatureMinC: 17,
      temperatureMaxC: 28,
      windGustMaxKmh: 25,
    },
    {
      model: "GFS",
      date: "2026-08-29",
      precipitationMm: 0.1,
      temperatureMinC: 18,
      temperatureMaxC: 29,
      windGustMaxKmh: 27,
    },
  ]);

  assert.equal(days.length, 2);
  assert.equal(days[0].date, "2026-08-28");
  assert.equal(days[1].date, "2026-08-29");
  assert.equal(days[1].precipitation.confidence, "high");
});
