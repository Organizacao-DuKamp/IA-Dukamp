import assert from "node:assert/strict";
import test from "node:test";

import { fetchOfficialWeather, OfficialWeatherError } from "../src/lib/chat/weather-official.server.ts";

function municipalitiesPayload(extra: Array<Record<string, unknown>> = []) {
  const filler = Array.from({ length: 1_005 }, (_, index) => ({
    "municipio-id": 1000000 + index,
    "municipio-nome": `Cidade Teste ${index}`,
    "UF-sigla": index % 2 === 0 ? "SP" : "MG",
  }));
  return [...extra, ...filler];
}

test("fonte oficial resolve município no IBGE e estrutura a previsão do INMET", async () => {
  const calls: string[] = [];
  const result = await fetchOfficialWeather("Monte aprazivel", {
    fetchImpl: (async (input: RequestInfo | URL) => {
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
      assert.match(url, /apiprevmet3\.inmet\.gov\.br\/previsao\/3531407$/);
      return new Response(
        JSON.stringify({
          "3531407": {
            "2026-08-27": {
              manha: {
                resumo: "Poucas nuvens",
                temp_min: 18,
                temp_max: 29,
                umidade_min: 35,
                umidade_max: 75,
                dir_vento: "NE",
                int_vento: "Fracos",
                hora: "09:00",
                fonte: "INMET",
              },
              tarde: {
                resumo: "Claro",
                temp_min: 24,
                temp_max: 31,
                umidade_min: 30,
                umidade_max: 55,
                dir_vento: "N",
                int_vento: "Moderados",
                fonte: "INMET",
              },
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch,
  });

  assert.equal(calls.length, 2);
  assert.match(result, /Monte Aprazível - SP/);
  assert.match(result, /código IBGE 3531407/);
  assert.match(result, /Fonte: INMET, Instituto Nacional de Meteorologia/);
  assert.match(result, /2026-08-27/);
  assert.match(result, /temperatura 18–29 °C/);
  assert.match(result, /umidade 35–75%/);
  assert.match(result, /vento NE \/ Fracos/);
  assert.match(result, /apiprevmet3\.inmet\.gov\.br\/previsao\/3531407/);
});

test("UF explícita desambigua municípios homônimos", async () => {
  let forecastUrl = "";
  const result = await fetchOfficialWeather("Bom Jesus, PI", {
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("servicodados.ibge.gov.br")) {
        return new Response(
          JSON.stringify(
            municipalitiesPayload([
              { "municipio-id": 2201903, "municipio-nome": "Bom Jesus", "UF-sigla": "PI" },
              { "municipio-id": 2905008, "municipio-nome": "Bom Jesus", "UF-sigla": "BA" },
            ]),
          ),
          { status: 200 },
        );
      }
      forecastUrl = url;
      return new Response(
        JSON.stringify({
          "2201903": {
            "2026-08-27": {
              manha: { resumo: "Claro", temp_min: 20, temp_max: 34, fonte: "INMET" },
            },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch,
  });

  assert.match(forecastUrl, /\/2201903$/);
  assert.match(result, /Bom Jesus - PI/);
});

test("cidade homônima sem UF pede desambiguação em vez de escolher ao acaso", async () => {
  await assert.rejects(
    () =>
      fetchOfficialWeather("Bom Jesus", {
        fetchImpl: (async () =>
          new Response(
            JSON.stringify(
              municipalitiesPayload([
                { "municipio-id": 2201903, "municipio-nome": "Bom Jesus", "UF-sigla": "PI" },
                { "municipio-id": 2905008, "municipio-nome": "Bom Jesus", "UF-sigla": "BA" },
              ]),
            ),
            { status: 200 },
          )) as typeof fetch,
      }),
    (error: unknown) => {
      assert.ok(error instanceof OfficialWeatherError);
      assert.equal(error.status, 422);
      assert.equal(error.code, "weather_location_ambiguous");
      return true;
    },
  );
});
