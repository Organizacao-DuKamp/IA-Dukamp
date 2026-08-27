import { logDiagnostic, safeErrorSnippet } from "./diagnostics.server.ts";

const IBGE_MUNICIPALITIES_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado&orderBy=nome";
const INMET_FORECAST_BASE_URL = "https://apiprevmet3.inmet.gov.br/previsao";
const DEFAULT_TIMEOUT_MS = 6_000;
const MUNICIPALITIES_TTL_MS = 24 * 60 * 60_000;
const FORECAST_TTL_MS = 5 * 60_000;

const BRAZILIAN_UFS = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

type JsonRecord = Record<string, unknown>;

interface Municipality {
  id: number;
  name: string;
  uf: string;
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

export interface OfficialWeatherOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

export class OfficialWeatherError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "official_weather_failed") {
    super(message);
    this.name = "OfficialWeatherError";
    this.status = status;
    this.code = code;
  }
}

let municipalitiesCache: CacheEntry<Municipality[]> | null = null;
const forecastCache = new Map<string, CacheEntry<string>>();
const inFlightForecasts = new Map<string, Promise<string>>();

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textField(record: JsonRecord | null, ...keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function numberField(record: JsonRecord | null, ...keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function nestedUf(record: JsonRecord): string | null {
  const flattened = textField(record, "UF-sigla", "uf", "sigla_uf");
  if (flattened && BRAZILIAN_UFS.has(flattened.toUpperCase())) return flattened.toUpperCase();

  const micro = asRecord(record.microrregiao);
  const meso = asRecord(micro?.mesorregiao);
  const microUf = textField(asRecord(meso?.UF), "sigla");
  if (microUf && BRAZILIAN_UFS.has(microUf.toUpperCase())) return microUf.toUpperCase();

  const immediate = asRecord(record["regiao-imediata"]);
  const intermediate = asRecord(immediate?.["regiao-intermediaria"]);
  const immediateUf = textField(asRecord(intermediate?.UF), "sigla");
  if (immediateUf && BRAZILIAN_UFS.has(immediateUf.toUpperCase())) {
    return immediateUf.toUpperCase();
  }
  return null;
}

function parseMunicipalities(payload: unknown): Municipality[] {
  if (!Array.isArray(payload)) return [];
  const municipalities: Municipality[] = [];
  for (const value of payload) {
    const record = asRecord(value);
    if (!record) continue;
    const id = numberField(record, "municipio-id", "id");
    const name = textField(record, "municipio-nome", "nome");
    const uf = nestedUf(record);
    if (!id || !name || !uf) continue;
    municipalities.push({ id: Math.trunc(id), name, uf });
  }
  return municipalities;
}

function locationHint(location: string): { city: string; uf: string | null } {
  const cleaned = location.replace(/\s+/g, " ").trim().slice(0, 120);
  const suffix = cleaned.match(/(?:,|\s)\s*([A-Za-z]{2})$/);
  const maybeUf = suffix?.[1]?.toUpperCase() ?? null;
  const uf = maybeUf && BRAZILIAN_UFS.has(maybeUf) ? maybeUf : null;
  const city =
    uf && suffix
      ? cleaned
          .slice(0, suffix.index)
          .replace(/[\s,/-]+$/g, "")
          .trim()
      : cleaned;
  return { city, uf };
}

function resolveMunicipality(location: string, municipalities: Municipality[]): Municipality {
  const hint = locationHint(location);
  const wanted = normalizeComparable(hint.city);
  const exact = municipalities.filter(
    (municipality) =>
      normalizeComparable(municipality.name) === wanted &&
      (!hint.uf || municipality.uf === hint.uf),
  );

  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new OfficialWeatherError(
      `Localidade ambígua para previsão: ${location}. Informe também a UF.`,
      422,
      "weather_location_ambiguous",
    );
  }

  throw new OfficialWeatherError(
    `Não consegui localizar ${location} no cadastro de municípios do IBGE.`,
    404,
    "weather_location_not_found",
  );
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  label: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      logDiagnostic("warn", "weather.official.http_error", {
        source: label,
        status: response.status,
        duration_ms: Date.now() - started,
        error_body: safeErrorSnippet(raw),
      });
      throw new OfficialWeatherError(
        `A fonte oficial ${label} não respondeu corretamente.`,
        response.status,
        `weather_${label.toLowerCase()}_http_error`,
      );
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new OfficialWeatherError(
        `A fonte oficial ${label} retornou dados inválidos.`,
        502,
        `weather_${label.toLowerCase()}_invalid_json`,
      );
    }
  } catch (error) {
    if (error instanceof OfficialWeatherError) throw error;
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new OfficialWeatherError(
        `A consulta à fonte oficial ${label} excedeu o tempo limite.`,
        504,
        `weather_${label.toLowerCase()}_timeout`,
      );
    }
    throw new OfficialWeatherError(
      `Não foi possível consultar a fonte oficial ${label}.`,
      502,
      `weather_${label.toLowerCase()}_unavailable`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function municipalities(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  now: () => number,
  allowCache: boolean,
): Promise<Municipality[]> {
  if (allowCache && municipalitiesCache && now() - municipalitiesCache.at < MUNICIPALITIES_TTL_MS) {
    return municipalitiesCache.value;
  }
  const payload = await fetchJson(IBGE_MUNICIPALITIES_URL, fetchImpl, timeoutMs, "IBGE");
  const parsed = parseMunicipalities(payload);
  if (parsed.length < 1_000) {
    throw new OfficialWeatherError(
      "O cadastro de municípios do IBGE veio incompleto.",
      502,
      "weather_ibge_incomplete",
    );
  }
  if (allowCache) municipalitiesCache = { at: now(), value: parsed };
  return parsed;
}

function forecastRoot(payload: unknown, municipalityId: number): JsonRecord | null {
  const root = asRecord(payload);
  if (!root) return null;
  const keyed = asRecord(root[String(municipalityId)]);
  return keyed ?? root;
}

function periodLine(label: string, period: JsonRecord): string {
  const parts: string[] = [];
  const summary = textField(period, "resumo", "tempo");
  const min = numberField(period, "temp_min", "temperatura_min");
  const max = numberField(period, "temp_max", "temperatura_max");
  const humidityMin = numberField(period, "umidade_min");
  const humidityMax = numberField(period, "umidade_max");
  const windDirection = textField(period, "dir_vento", "direcao_vento");
  const windIntensity = textField(period, "int_vento", "intensidade_vento");
  const updateHour = textField(period, "hora");

  if (summary) parts.push(summary);
  if (min !== null || max !== null) {
    const temperature = min !== null && max !== null ? `${min}–${max} °C` : `${min ?? max} °C`;
    parts.push(`temperatura ${temperature}`);
  }
  if (humidityMin !== null || humidityMax !== null) {
    const humidity =
      humidityMin !== null && humidityMax !== null
        ? `${humidityMin}–${humidityMax}%`
        : `${humidityMin ?? humidityMax}%`;
    parts.push(`umidade ${humidity}`);
  }
  if (windDirection || windIntensity) {
    parts.push(`vento ${[windDirection, windIntensity].filter(Boolean).join(" / ")}`);
  }
  if (updateHour) parts.push(`hora-base ${updateHour}`);
  return `${label}: ${parts.length ? parts.join("; ") : "sem detalhes estruturados"}`;
}

function renderInmetForecast(
  payload: unknown,
  municipality: Municipality,
  requestedLocation: string,
): string {
  const root = forecastRoot(payload, municipality.id);
  if (!root) {
    throw new OfficialWeatherError(
      "O INMET não retornou uma previsão estruturada para o município.",
      502,
      "weather_inmet_empty",
    );
  }

  const dayLines: string[] = [];
  let sourceName = "INMET/PREVMET";
  for (const [date, rawDay] of Object.entries(root).slice(0, 7)) {
    const day = asRecord(rawDay);
    if (!day) continue;
    const periods: string[] = [];
    for (const [key, label] of [
      ["manha", "manhã"],
      ["tarde", "tarde"],
      ["noite", "noite"],
    ] as const) {
      const period = asRecord(day[key]);
      if (!period) continue;
      sourceName = textField(period, "fonte") ?? sourceName;
      periods.push(periodLine(label, period));
    }
    if (periods.length === 0) {
      sourceName = textField(day, "fonte") ?? sourceName;
      periods.push(periodLine("dia", day));
    }
    dayLines.push(`- ${date}: ${periods.join(" | ")}`);
  }

  if (dayLines.length === 0) {
    throw new OfficialWeatherError(
      "O INMET retornou a previsão sem períodos utilizáveis.",
      502,
      "weather_inmet_unusable",
    );
  }

  const sourceUrl = `${INMET_FORECAST_BASE_URL}/${municipality.id}`;
  return [
    "DADOS METEOROLÓGICOS OFICIAIS ESTRUTURADOS — use como fonte primária da previsão:",
    `Local solicitado: ${requestedLocation}. Município resolvido pelo IBGE: ${municipality.name} - ${municipality.uf}, Brasil (código IBGE ${municipality.id}).`,
    `Fonte: ${sourceName}, Instituto Nacional de Meteorologia (INMET/MAPA).`,
    `Consulta oficial: ${sourceUrl}`,
    "Previsão retornada pelo INMET:",
    ...dayLines,
    "Observação: estes dados são previsão oficial por município. Alertas, observações de estação e divergências de modelos devem ser cruzados separadamente quando disponíveis.",
  ].join("\n");
}

async function fetchOfficialWeatherUncached(
  location: string,
  options: OfficialWeatherOptions,
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 2_000), 10_000);
  const now = options.now ?? Date.now;
  const allowCache = !options.fetchImpl;
  const list = await municipalities(fetchImpl, timeoutMs, now, allowCache);
  const municipality = resolveMunicipality(location, list);
  const payload = await fetchJson(
    `${INMET_FORECAST_BASE_URL}/${municipality.id}`,
    fetchImpl,
    timeoutMs,
    "INMET",
  );
  return renderInmetForecast(payload, municipality, location);
}

export async function fetchOfficialWeather(
  location: string,
  options: OfficialWeatherOptions = {},
): Promise<string> {
  const normalizedLocation = normalizeComparable(location);
  if (!normalizedLocation) {
    throw new OfficialWeatherError(
      "Localidade vazia para previsão do tempo.",
      400,
      "weather_location_empty",
    );
  }

  const now = options.now ?? Date.now;
  const allowCache = !options.fetchImpl;
  if (allowCache) {
    const cached = forecastCache.get(normalizedLocation);
    if (cached && now() - cached.at < FORECAST_TTL_MS) {
      logDiagnostic("info", "weather.official.cache_hit", { location: normalizedLocation });
      return cached.value;
    }
    const pending = inFlightForecasts.get(normalizedLocation);
    if (pending) {
      logDiagnostic("info", "weather.official.inflight_join", { location: normalizedLocation });
      return pending;
    }
  }

  const task = fetchOfficialWeatherUncached(location, options)
    .then((result) => {
      if (allowCache) forecastCache.set(normalizedLocation, { at: now(), value: result });
      logDiagnostic("info", "weather.official.success", {
        location: normalizedLocation,
        result_chars: result.length,
      });
      return result;
    })
    .finally(() => {
      if (allowCache) inFlightForecasts.delete(normalizedLocation);
    });

  if (allowCache) inFlightForecasts.set(normalizedLocation, task);
  return task;
}
