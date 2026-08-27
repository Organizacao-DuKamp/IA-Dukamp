export type WeatherConfidence = "high" | "moderate" | "low";

export interface WeatherModelDay {
  model: string;
  date: string;
  precipitationMm: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  windGustMaxKmh: number | null;
}

export interface WeatherModelHour {
  model: string;
  time: string;
  precipitationMm: number | null;
  temperatureC: number | null;
  windGustKmh: number | null;
}

export interface WeatherDayConsensus {
  date: string;
  models: string[];
  sampleCount: number;
  precipitation: {
    valuesMm: number[];
    minMm: number | null;
    maxMm: number | null;
    medianMm: number | null;
    spreadMm: number | null;
    rainVotes: number;
    dryVotes: number;
    confidence: WeatherConfidence;
  };
  temperatureMax: {
    valuesC: number[];
    minC: number | null;
    maxC: number | null;
    spreadC: number | null;
  };
  windGust: {
    valuesKmh: number[];
    minKmh: number | null;
    maxKmh: number | null;
  };
}

export interface WeatherHourConsensus {
  time: string;
  models: string[];
  precipitation: {
    valuesMm: number[];
    minMm: number | null;
    maxMm: number | null;
    rainVotes: number;
    confidence: WeatherConfidence;
  };
}

const RAIN_SIGNAL_MM = 0.2;

function finite(values: Array<number | null>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function minOrNull(values: number[]): number | null {
  return values.length ? Math.min(...values) : null;
}

function maxOrNull(values: number[]): number | null {
  return values.length ? Math.max(...values) : null;
}

function medianOrNull(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function round(value: number | null, digits = 1): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function precipitationConfidence(valuesMm: number[]): WeatherConfidence {
  if (valuesMm.length < 2) return "low";

  const rainVotes = valuesMm.filter((value) => value >= RAIN_SIGNAL_MM).length;
  const dryVotes = valuesMm.length - rainVotes;
  const unanimousSignal = rainVotes === 0 || dryVotes === 0;
  const min = Math.min(...valuesMm);
  const max = Math.max(...valuesMm);
  const spread = max - min;
  const median = medianOrNull(valuesMm) ?? 0;

  // Para acumulados muito baixos, diferenças pequenas em mm não devem derrubar
  // a confiança de um consenso de "praticamente sem chuva".
  if (unanimousSignal && max < 2 && spread <= 1.5) return "high";

  // Em chuva relevante, combine concordância do sinal e dispersão absoluta/
  // relativa. Assim 7/12/18 mm não vira um falso valor exato, mas ainda é um
  // consenso moderado de que haverá chuva.
  const relativeSpread = median > 0.5 ? spread / median : Number.POSITIVE_INFINITY;
  if (unanimousSignal && (spread <= 4 || relativeSpread <= 0.35)) return "high";
  if (Math.max(rainVotes, dryVotes) >= Math.ceil(valuesMm.length * 0.66)) return "moderate";
  return "low";
}

export function buildDailyConsensus(days: WeatherModelDay[]): WeatherDayConsensus[] {
  const byDate = new Map<string, WeatherModelDay[]>();
  for (const day of days) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(day.date)) continue;
    const group = byDate.get(day.date) ?? [];
    group.push(day);
    byDate.set(day.date, group);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => {
      const precipitation = finite(group.map((item) => item.precipitationMm));
      const temperatureMax = finite(group.map((item) => item.temperatureMaxC));
      const windGust = finite(group.map((item) => item.windGustMaxKmh));
      const precipMin = minOrNull(precipitation);
      const precipMax = maxOrNull(precipitation);
      const tempMin = minOrNull(temperatureMax);
      const tempMax = maxOrNull(temperatureMax);

      return {
        date,
        models: [...new Set(group.map((item) => item.model))],
        sampleCount: group.length,
        precipitation: {
          valuesMm: precipitation.map((value) => round(value) ?? value),
          minMm: round(precipMin),
          maxMm: round(precipMax),
          medianMm: round(medianOrNull(precipitation)),
          spreadMm:
            precipMin !== null && precipMax !== null ? round(precipMax - precipMin) : null,
          rainVotes: precipitation.filter((value) => value >= RAIN_SIGNAL_MM).length,
          dryVotes: precipitation.filter((value) => value < RAIN_SIGNAL_MM).length,
          confidence: precipitationConfidence(precipitation),
        },
        temperatureMax: {
          valuesC: temperatureMax.map((value) => round(value) ?? value),
          minC: round(tempMin),
          maxC: round(tempMax),
          spreadC: tempMin !== null && tempMax !== null ? round(tempMax - tempMin) : null,
        },
        windGust: {
          valuesKmh: windGust.map((value) => round(value) ?? value),
          minKmh: round(minOrNull(windGust)),
          maxKmh: round(maxOrNull(windGust)),
        },
      };
    });
}

export function buildHourlyConsensus(hours: WeatherModelHour[]): WeatherHourConsensus[] {
  const byTime = new Map<string, WeatherModelHour[]>();
  for (const hour of hours) {
    if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}/.test(hour.time)) continue;
    const group = byTime.get(hour.time) ?? [];
    group.push(hour);
    byTime.set(hour.time, group);
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, group]) => {
      const precipitation = finite(group.map((item) => item.precipitationMm));
      return {
        time,
        models: [...new Set(group.map((item) => item.model))],
        precipitation: {
          valuesMm: precipitation.map((value) => round(value) ?? value),
          minMm: round(minOrNull(precipitation)),
          maxMm: round(maxOrNull(precipitation)),
          rainVotes: precipitation.filter((value) => value >= RAIN_SIGNAL_MM).length,
          confidence: precipitationConfidence(precipitation),
        },
      };
    });
}

export function overallWeatherConfidence(
  consensus: WeatherDayConsensus[],
  sourceCount: number,
): WeatherConfidence {
  if (sourceCount < 2 || consensus.length === 0) return "low";
  const firstDays = consensus.slice(0, 3).map((day) => day.precipitation.confidence);
  if (firstDays.every((confidence) => confidence === "high")) return "high";
  if (firstDays.some((confidence) => confidence === "low")) return "moderate";
  return "moderate";
}
