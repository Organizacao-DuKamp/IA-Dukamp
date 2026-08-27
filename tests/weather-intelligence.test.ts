import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchWeatherIntelligence,
  renderWeatherFallbackReply,
  renderWeatherIntelligenceContext,
} from "../src/lib/chat/weather-intelligence.server.ts";

const FIXED_NOW = Date.parse("2026-08-27T14:00:00Z");

function municipalitiesPayload(extra: Array<Record<string, unknown>> = []) {
  const filler = Array.from({ length: 1_005 }, (_, index) => ({
    "municipio-id": 1000000 + index,
    "municipio-nome": `Cidade Teste ${index}`,
    "UF-sigla": index % 2 === 0 ? "SP" : "MG",
  }));
  return [...extra, ...filler];
}

function baselinePayload(options: { invalidDaily?: boolean } = {}) {
  const dailyMin = options.invalidDaily ? 35 : 18;
  const dailyMax = options.invalidDaily ? 20 : 31;
  const dailyRain = options.invalidDaily ? -2 : 14;
  return {
    latitude: -20.77,
    longitude: -49.71,
    timezone: "America/Sao_Paulo",
    current: {
      time: "2026-08-27T11:00",
      temperature_2m: 29,
      relative_humidity_2m: 34,
      apparent_temperature: 30,
      precipitation: 0,
      weather_code: 1,
      wind_speed_10m: 13,
      wind_direction_10m: 35,
      wind_gusts_10m: 24,
    },
    hourly: {
      time: [
        "2026-08-27T11:00",
        "2026-08-28T12:00",
        "2026-08-28T13:00",
        "2026-08-28T14:00",
        "2026-08-28T15:00",
      ],
      temperature_2m: [29, 30, 29, 27, 26],
      relative_humidity_2m: [34, 44, 51, 62, 68],
      apparent_temperature: [30, 31, 30, 28, 27],
      precipitation_probability: [0, 20, 55, 75, 45],
      precipitation: [0, 0, 2, 5, 1],
      weather_code: [1, 2, 61, 63, 61],
      wind_speed_10m: [13, 18, 22, 24, 20],
      wind_gusts_10m: [24, 31, 39, 44, 36],
    },
    daily: {
      time: ["2026-08-27", "2026-08-28", "2026-08-29"],
      weather_code: [1, 63, 2],
      temperature_2m_min: [18, dailyMin, 17],
      temperature_2m_max: [31, dailyMax, 29],
      apparent_temperature_min: [18, 19, 17],
      apparent_temperature_max: [32, 32, 29],
      precipitation_sum: [0, dailyRain, 0],
      precipitation_probability_max: [5, 75, 10],
      wind_speed_10m_max: [18, 26, 20],
      wind_gusts_10m_max: [30, 44, 32],
    },
  };
}

function modelPayload(rainMm: number) {
  return {
    daily: {
      time: ["2026-08-27", "2026-08-28", "2026-08-29"],
      temperature_2m_max: [31, 31, 29],
      temperature_2m_min: [18, 19, 17],
      precipitation_sum: [0, rainMm, 0],
      wind_gusts_10m_max: [30, 39, 31],
    },
    hourly: {
      time: ["2026-08-28T13:00", "2026-08-28T14:00"],
      temperature_2m: [29, 27],
      precipitation: [rainMm / 3, (rainMm * 2) / 3],
      wind_gusts_10m: [35, 40],
    },
  };
}

function inmetForecastPayload() {
  return {
    "3531407": {
      "2026-08-27": {
        manha: {
          resumo: "Poucas nuvens",
          temp_min: 18,
          temp_max: 31,
          umidade_min: 30,
          umidade_max: 72,
          fonte: "INMET",
        },
      },
      "2026-08-28": {
        tarde: {
          resumo: "Pancadas de chuva",
          temp_min: 20,
          temp_max: 30,
          umidade_min: 42,
          umidade_max: 82,
          fonte: "INMET",
        },
      },
    },
  };
}

function alertXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel><item>
  <event>Baixa umidade</event>
  <severity>Severo</severity>
  <onset>2026-08-27T12:00:00-03:00</onset>
  <expires>2026-08-28T18:00:00-03:00</expires>
  <areaDesc>Região de Monte Aprazível</areaDesc>
  <polygon>-21,-50 -20,-50 -20,-49 -21,-49 -21,-50</polygon>
  <description>Umidade relativa pode ficar abaixo de 20%.</description>
</item></channel></rss>`;
}

interface FixtureOptions {
  failEcmwf?: boolean;
  invalidBaseline?: boolean;
}

function fixtureFetch(options: FixtureOptions = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.includes("servicodados.ibge.gov.br")) {
      return new Response(
        JSON.stringify(
          municipalitiesPayload([
            {
              "municipio-id": 3531407,
              "municipio-nome": "Monte Aprazível",
              "UF-sigla": "SP",
            },
          ]),
        ),
        { status: 200 },
      );
    }

    if (url.includes("geocoding-api.open-meteo.com")) {
      return new Response(
        JSON.stringify({
          results: [
            {
              name: "Monte Aprazível",
              country_code: "BR",
              admin1: "São Paulo",
              latitude: -20.77,
              longitude: -49.71,
              elevation: 475,
              timezone: "America/Sao_Paulo",
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (url.startsWith("https://api.open-meteo.com/v1/forecast")) {
      return new Response(JSON.stringify(baselinePayload({ invalidDaily: options.invalidBaseline })), {
        status: 200,
      });
    }

    if (url.startsWith("https://api.open-meteo.com/v1/ecmwf")) {
      if (options.failEcmwf) return new Response("temporarily unavailable", { status: 503 });
      return new Response(JSON.stringify(modelPayload(18)), { status: 200 });
    }
    if (url.startsWith("https://api.open-meteo.com/v1/gfs")) {
      return new Response(JSON.stringify(modelPayload(7)), { status: 200 });
    }
    if (url.startsWith("https://api.open-meteo.com/v1/dwd-icon")) {
      return new Response(JSON.stringify(modelPayload(12)), { status: 200 });
    }

    if (url.includes("apiprevmet3.inmet.gov.br/estacao/proxima/3531407")) {
      return new Response(
        JSON.stringify({
          dados: [{ CD_ESTACAO: "A735", DC_NOME: "MONTE APRAZIVEL" }],
        }),
        { status: 200 },
      );
    }

    if (url.includes("apitempo.inmet.gov.br/estacao/2026-08-27/2026-08-27/A735")) {
      return new Response(
        JSON.stringify([
          {
            CD_ESTACAO: "A735",
            DC_NOME: "MONTE APRAZIVEL",
            DT_MEDICAO: "2026-08-27",
            HR_MEDICAO: "1400",
            TEM_INS: 28.6,
            UMD_INS: 36,
            CHUVA: 0,
            VEN_VEL: 3.2,
            VEN_DIR: 32,
            VEN_RAJ: 6.4,
          },
        ]),
        { status: 200 },
      );
    }

    if (url.includes("apiprevmet3.inmet.gov.br/avisos/ativos")) {
      return new Response(alertXml(), {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    }

    if (url.includes("apiprevmet3.inmet.gov.br/previsao/3531407")) {
      return new Response(JSON.stringify(inmetForecastPayload()), { status: 200 });
    }

    throw new Error(`URL não simulada: ${url}`);
  }) as typeof fetch;

  return { fetchImpl, calls };
}

test("previsão municipal cruza INMET, observação e ECMWF/GFS/ICON", async () => {
  const { fetchImpl, calls } = fixtureFetch();
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Qual a previsão do tempo para Monte Aprazível, SP?",
    { fetchImpl, now: () => FIXED_NOW },
  );

  assert.equal(intelligence.location.city, "Monte Aprazível");
  assert.equal(intelligence.location.uf, "SP");
  assert.equal(intelligence.location.ibgeCode, 3531407);
  assert.equal(intelligence.location.timezone, "America/Sao_Paulo");
  assert.equal(intelligence.current?.observed, true);
  assert.equal(intelligence.current?.temperatureC, 28.6);
  assert.ok(intelligence.officialForecastText?.includes("Pancadas de chuva"));
  assert.ok(intelligence.alerts.some((alert) => /baixa umidade/i.test(alert.event)));

  const tomorrow = intelligence.dailyConsensus.find((day) => day.date === "2026-08-28");
  assert.ok(tomorrow);
  assert.equal(tomorrow.precipitation.minMm, 7);
  assert.equal(tomorrow.precipitation.maxMm, 18);
  assert.equal(tomorrow.precipitation.medianMm, 12);
  assert.equal(tomorrow.precipitation.confidence, "moderate");
  assert.ok(calls.some((url) => url.includes("/v1/ecmwf")));
  assert.ok(calls.some((url) => url.includes("/v1/gfs")));
  assert.ok(calls.some((url) => url.includes("/v1/dwd-icon")));
});

test("contexto estruturado expõe divergência e janela horária sem escolher um modelo", async () => {
  const { fetchImpl } = fixtureFetch();
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Que horas tem mais chance de chover amanhã e quanto deve chover?",
    { fetchImpl, now: () => FIXED_NOW },
  );
  const context = renderWeatherIntelligenceContext(intelligence);

  assert.match(context, /CONSENSO ECMWF\/GFS\/ICON/);
  assert.match(context, /chuva faixa 7 mm a 18 mm/);
  assert.match(context, /mediana 12 mm/);
  assert.match(context, /2026-08-28T13:00/);
  assert.match(context, /probabilidade máxima 75%/);
  assert.match(context, /ALERTAS OFICIAIS INMET/);
});

test("falha de um modelo não derruba a previsão", async () => {
  const { fetchImpl } = fixtureFetch({ failEcmwf: true });
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Vai chover amanhã? Preciso levar o gado.",
    { fetchImpl, now: () => FIXED_NOW },
  );

  assert.equal(
    intelligence.sources.find((source) => source.label === "ECMWF IFS")?.status,
    "failed",
  );
  const tomorrow = intelligence.dailyConsensus.find((day) => day.date === "2026-08-28");
  assert.ok(tomorrow);
  assert.deepEqual(tomorrow.models.sort(), ["GFS", "ICON"]);
  assert.equal(tomorrow.precipitation.minMm, 7);
  assert.equal(tomorrow.precipitation.maxMm, 12);
});

test("validação descarta precipitação negativa e mínima acima da máxima", async () => {
  const { fetchImpl } = fixtureFetch({ invalidBaseline: true });
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Qual a temperatura agora em Monte Aprazível, SP?",
    { fetchImpl, now: () => FIXED_NOW },
  );

  const tomorrow = intelligence.daily.find((day) => day.date === "2026-08-28");
  assert.ok(tomorrow);
  assert.equal(tomorrow.temperatureMinC, null);
  assert.equal(tomorrow.temperatureMaxC, null);
  assert.equal(tomorrow.precipitationSumMm, null);
  assert.ok(intelligence.validationIssues.includes("weather_daily_min_above_max"));
  assert.ok(intelligence.validationIssues.includes("weather_daily_precipitation_invalid"));
});

test("consulta simples de temperatura não dispara três modelos nem alerta/previsão oficial", async () => {
  const { fetchImpl, calls } = fixtureFetch();
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Qual a temperatura agora em Monte Aprazível, SP?",
    { fetchImpl, now: () => FIXED_NOW },
  );

  assert.equal(intelligence.analysis.depth, "quick");
  assert.equal(calls.some((url) => url.includes("/v1/ecmwf")), false);
  assert.equal(calls.some((url) => url.includes("/v1/gfs")), false);
  assert.equal(calls.some((url) => url.includes("/v1/dwd-icon")), false);
  assert.equal(calls.some((url) => url.includes("/avisos/ativos")), false);
  assert.equal(calls.some((url) => url.includes("/previsao/3531407")), false);
  assert.ok(intelligence.current || intelligence.modeledCurrent);
});

test("fallback determinístico preserva dados quando a etapa de redação não estiver disponível", async () => {
  const { fetchImpl } = fixtureFetch();
  const intelligence = await fetchWeatherIntelligence(
    "Monte Aprazível, SP",
    "Vai chover amanhã? Preciso levar o gado.",
    { fetchImpl, now: () => FIXED_NOW },
  );
  const reply = renderWeatherFallbackReply(intelligence);

  assert.match(reply, /Monte Aprazível\/SP/);
  assert.match(reply, /2026-08-28/);
  assert.match(reply, /7 mm/);
  assert.match(reply, /18 mm/);
  assert.match(reply, /aviso oficial do INMET/i);
  assert.match(reply, /manejo|transporte|propriedade/i);
});
