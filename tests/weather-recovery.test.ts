import assert from "node:assert/strict";
import test from "node:test";
import { resolveWeatherTurn } from "../src/lib/chat/weather.ts";
import { createConversationState } from "../src/lib/chat/state.ts";
import {
  analyzeWeatherRequest,
  resolveWeatherTimeWindow,
  parseWeatherDates,
} from "../src/lib/chat/weather-analysis.ts";
import { validateWeatherGrounding } from "../src/lib/chat/response-validation.ts";
import { answerWeatherWithRecovery } from "../src/lib/chat/weather-response.server.ts";
import { orchestrateAI } from "../src/lib/ai/orchestrator.server.ts";
import { withAIUsageContext } from "../src/lib/chat/usage.server.ts";
import type { WeatherIntelligence } from "../src/lib/chat/weather-intelligence.server.ts";
import type { AIProviderResponse } from "../src/lib/ai/types.ts";

const now = Date.parse("2026-09-30T17:43:00Z");
const location = "São José do Rio Preto";
const text = "Como está o tempo em São José do Rio Preto dias 30/09 e 01/10/26";
const conversation = [{ role: "user" as const, content: text }];
const refusal =
  "Não consigo consultar a previsão meteorológica ao vivo neste momento para confirmar as condições de São José do Rio Preto (SP) em 30/09/2026 e 01/10/2026. Para o manejo, acompanhe os avisos do INMET para risco de chuva forte.";
// Dados inteiramente simulados; não são uma previsão real.
const forecast =
  "São José do Rio Preto/SP: 30/09/2026, mínima 20 °C e máxima 31 °C, chuva 0 mm; 01/10/2026, mínima 21 °C e máxima 32 °C, chuva 2 mm. Fonte: Open-Meteo. Atualizado às 14:43 BRT.";
const result: AIProviderResponse = {
  provider: "perplexity",
  model: "test",
  text: forecast,
  inputTokens: 10,
  outputTokens: 20,
  citations: [{ id: 1, url: "https://open-meteo.com/", title: "Open-Meteo" }],
  latency: 1,
};

function intelligence(): WeatherIntelligence {
  const analysis = analyzeWeatherRequest(text, now);
  return {
    location: {
      requested: location,
      city: location,
      uf: "SP",
      ibgeCode: 3549805,
      latitude: -20.81,
      longitude: -49.38,
      elevationM: null,
      timezone: "America/Sao_Paulo",
    },
    analysis,
    timeWindow: resolveWeatherTimeWindow(analysis, "America/Sao_Paulo", now),
    updatedAt: new Date(now).toISOString(),
    current: null,
    modeledCurrent: null,
    hourly: [],
    alerts: [],
    officialForecastText: null,
    dailyConsensus: [],
    hourlyConsensus: [],
    confidence: "moderate",
    validationIssues: [],
    daily: ["2026-09-30", "2026-10-01"].map((date) => ({
      date,
      weatherCode: 1,
      temperatureMinC: 20,
      temperatureMaxC: 31,
      apparentTemperatureMinC: null,
      apparentTemperatureMaxC: null,
      precipitationProbabilityMaxPct: 10,
      precipitationSumMm: 0,
      windSpeedMaxKmh: null,
      windGustMaxKmh: null,
    })),
    sources: [
      {
        id: "open-meteo-best-match",
        label: "Open-Meteo Best Match",
        kind: "model",
        status: "ok",
        retrievedAt: new Date(now).toISOString(),
        durationMs: 1,
        url: "https://api.open-meteo.com/v1/forecast",
      },
    ],
  };
}

test("frase exata do incidente reconhece clima e separa cidade das duas datas", () => {
  const turn = resolveWeatherTurn(text, createConversationState("incident"));
  assert.equal(turn.isWeatherTurn, true);
  assert.equal(turn.location, location);
  assert.equal(
    resolveWeatherTurn(
      "Como estará o tempo em São José do Rio Preto amanhã?",
      createConversationState("future"),
    ).location,
    location,
  );
  const analysis = analyzeWeatherRequest(text, now);
  assert.equal(analysis.depth, "standard");
  assert.ok(analysis.intents.includes("WEATHER_FORECAST"));
  const window = resolveWeatherTimeWindow(analysis, "America/Sao_Paulo", now);
  assert.equal(window.startDate, "2026-09-30");
  assert.equal(window.endDate, "2026-10-01");
});

test("previsão de cidade e datas depois de para não transforma as datas em local", () => {
  assert.equal(
    resolveWeatherTurn(
      "Qual a previsão de Rio Preto para 30/09 e 01/10?",
      createConversationState("dates"),
    ).location,
    "Rio Preto",
  );
  assert.equal(
    resolveWeatherTurn("Como está o tempo em Rio de Janeiro hoje?", createConversationState("rio"))
      .location,
    "Rio de Janeiro",
  );
});

test("ano de dois dígitos e calendário são validados; hoje e amanhã preservam ambos", () => {
  assert.deepEqual(parseWeatherDates("30/09 e 01/10/26", 2025), ["2026-09-30", "2026-10-01"]);
  assert.deepEqual(parseWeatherDates("31/02/26 e 29/02/2025"), []);
  const window = resolveWeatherTimeWindow(
    analyzeWeatherRequest("Como está o tempo hoje e amanhã?", now),
    "America/Sao_Paulo",
    now,
  );
  assert.equal(window.startDate, "2026-09-30");
  assert.equal(window.endDate, "2026-10-01");
});

test("recusa com cidade, datas e INMET não passa como previsão; uma data faltando também não", () => {
  assert.ok(validateWeatherGrounding(refusal, location).issues.includes("weather_lookup_refused"));
  assert.equal(
    validateWeatherGrounding(forecast, location, ["2026-09-30", "2026-10-01"]).valid,
    true,
  );
  assert.ok(
    validateWeatherGrounding(forecast.split("; 01/10")[0], location, [
      "2026-09-30",
      "2026-10-01",
    ]).issues.includes("weather_requested_date_missing"),
  );
});

test("resposta inicial válida usa tier econômico e não faz pesquisa adicional", async () => {
  let calls = 0;
  const reply = await answerWeatherWithRecovery(
    conversation,
    { channel: "whatsapp", researchDepth: "none" },
    location,
    intelligence(),
    {
      askAI: async (_messages, options) => {
        calls++;
        assert.equal(options?.model, "luna");
        return forecast;
      },
      research: async () => {
        throw new Error("pesquisa desnecessária");
      },
      now: () => now,
    },
  );
  assert.equal(calls, 1);
  assert.match(reply, /31 °C/);
});

test("recusa ou erro de qualquer provedor preserva previsão estruturada sem nova chamada paga", async () => {
  for (const answer of [refusal, null]) {
    let researchCalls = 0;
    const reply = await answerWeatherWithRecovery(
      conversation,
      { channel: "whatsapp" },
      location,
      intelligence(),
      {
        askAI: async () => {
          if (answer === null) throw new Error("provider unavailable");
          return answer;
        },
        research: async () => {
          researchCalls++;
          throw new Error("not needed");
        },
        now: () => now,
      },
    );
    assert.equal(researchCalls, 0);
    assert.match(reply, /2026-09-30/);
    assert.match(reply, /2026-10-01/);
    assert.match(reply, /31 °C/);
    assert.doesNotMatch(reply, /não consigo consultar/i);
  }
});

test("sem camada estruturada, erro ou recusa aciona pesquisa profunda com fontes", async () => {
  for (const answer of [refusal, null]) {
    let researchCalls = 0;
    const reply = await answerWeatherWithRecovery(
      conversation,
      { channel: "whatsapp" },
      location,
      null,
      {
        askAI: async () => {
          if (answer === null) throw new Error("failed");
          return answer;
        },
        research: async (input) => {
          researchCalls++;
          assert.equal(input.mode, "deep_research");
          assert.equal(input.webRequired, true);
          assert.match(input.sourcePolicy!, /2026-09-30 a 2026-10-01/);
          return result;
        },
        now: () => now,
      },
    );
    assert.equal(researchCalls, 1);
    assert.match(reply, /32 °C/);
  }
});

test("ausência do segundo dia aciona recuperação, indisponibilidade total deixa ação útil sem inventar números", async () => {
  let researchCalls = 0;
  const reply = await answerWeatherWithRecovery(conversation, {}, location, null, {
    askAI: async () => forecast.split("; 01/10")[0],
    research: async () => {
      researchCalls++;
      throw new Error("offline");
    },
    now: () => now,
  });
  assert.equal(researchCalls, 1);
  assert.match(reply, /tempo\.inmet\.gov\.br/);
  assert.doesNotMatch(reply, /\d+ °C/);
});

test("orquestrador rejeita recusa mesmo com citações e tenta alternativa com pesquisa real", async () => {
  await withAIUsageContext(async (events) => {
    const calls: string[] = [];
    const reply = await orchestrateAI(
      { message: text, messages: conversation, mode: "quick", webRequired: true },
      {
        env: { PERPLEXITY_API_KEY: "test-p", OPENAI_API_KEY: "test-o" },
        fetchImpl: async (url, init) => {
          calls.push(String(url));
          if (String(url).includes("perplexity"))
            return Response.json({
              choices: [{ message: { content: refusal } }],
              citations: ["https://tempo.inmet.gov.br/"],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            });
          const body = JSON.parse(String(init?.body));
          assert.equal(body.tool_choice, "required");
          return Response.json({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: forecast,
                    annotations: [
                      { type: "url_citation", url: "https://open-meteo.com/", title: "Open-Meteo" },
                    ],
                  },
                ],
              },
            ],
            usage: { input_tokens: 100, output_tokens: 50 },
          });
        },
      },
    );
    assert.equal(reply.provider, "openai");
    assert.equal(calls.length, 2);
    assert.equal(events[0].errorCode, "lookup_refused");
    assert.equal(events[0].inputTokens, 100);
    assert.equal(events[1].fallbackReason, "lookup_refused");
  });
});

test("pesquisa profunda meteorológica válida dispensa segunda síntese paga", async () => {
  let calls = 0;
  const reply = await orchestrateAI(
    {
      message: text,
      messages: conversation,
      mode: "deep_research",
      webRequired: true,
      skipSynthesis: true,
    },
    {
      env: { PERPLEXITY_API_KEY: "test-p", OPENAI_API_KEY: "test-o" },
      fetchImpl: async (url) => {
        calls++;
        assert.match(String(url), /perplexity/);
        return Response.json({
          choices: [{ message: { content: forecast } }],
          citations: ["https://open-meteo.com/"],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        });
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(reply.provider, "perplexity");
});

test("fallback usa previsão municipal oficial se a fonte modelada falhar", async () => {
  const data = intelligence();
  data.daily = [];
  data.officialForecastText = forecast.replace("Open-Meteo", "INMET");
  const reply = await answerWeatherWithRecovery(conversation, {}, location, data, {
    askAI: async () => {
      throw new Error("IA indisponível");
    },
    research: async () => {
      throw new Error("não deveria pesquisar");
    },
    now: () => now,
  });
  assert.match(reply, /32 °C/);
  assert.match(reply, /INMET/);
  assert.doesNotMatch(reply, /as fontes consultadas não confirmaram/);
});
