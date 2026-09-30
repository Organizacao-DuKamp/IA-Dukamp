export type WeatherSubIntent =
  | "WEATHER_CURRENT"
  | "WEATHER_FORECAST"
  | "WEATHER_HOURLY"
  | "WEATHER_ALERT"
  | "WEATHER_AGRO_ANALYSIS";

export type WeatherResearchDepth = "quick" | "standard" | "deep";
export type WeatherDayPeriod = "dawn" | "morning" | "afternoon" | "evening" | "night" | null;

export interface WeatherRequestAnalysis {
  intents: WeatherSubIntent[];
  depth: WeatherResearchDepth;
  asksCurrent: boolean;
  needsHourly: boolean;
  needsAlerts: boolean;
  needsModelConsensus: boolean;
  needsWebCrosscheck: boolean;
  agroAnalysis: boolean;
  highImpactDecision: boolean;
  dayOffset: number | null;
  explicitDate: string | null;
  explicitEndDate?: string | null;
  requestedDates?: string[];
  dayOffsets?: number[];
  weekday: number | null;
  weekend: boolean;
  period: WeatherDayPeriod;
  originalTemporalExpression: string | null;
}

export interface WeatherTimeWindow {
  timezone: string;
  localNow: string;
  localDate: string;
  startDate: string;
  endDate: string;
  startHour: number | null;
  endHour: number | null;
  description: string;
}

const CURRENT_RE =
  /\b(agora|neste momento|condi[cç][aã]o atual|tempo atual|temperatura atual|umidade atual|vento atual|como est[aá] o tempo)\b/i;
const HOURLY_RE =
  /\b(que horas|qual hor[aá]rio|hor[aá]rio|por hora|hora a hora|de manh[aã]|pela manh[aã]|[àa] tarde|de tarde|[àa] noite|de noite|madrugada|melhor hor[aá]rio|janela|entre \d{1,2}(?::\d{2})?\s*(?:h|horas?)?\s*e\s*\d{1,2})\b/i;
const ALERT_RE =
  /\b(alerta|aviso|tempestade|granizo|vendaval|vento forte|rajada forte|chuva intensa|chuva forte|geada|onda de calor|calor extremo|frente fria|baixa umidade|seca|estiagem|inc[eê]ndio|evento severo)\b/i;
const AGRO_RE =
  /\b(gado|rebanho|boi|bois|vaca|vacas|bezerro|bezerros|pecu[aá]ria|pasto|pastagem|curral|manejo|transport(?:e|ar)|embarcar|desembarcar|levar o gado|aplica[cç][aã]o|aplicar produto|pulveriza[cç][aã]o|silagem|feno|cocho|bebedouro|sombra|estresse t[eé]rmico)\b/i;
const HIGH_IMPACT_RE =
  /\b(preciso|vou precisar|posso|seguro|risco|perig|levar o gado|transport|embarcar|trabalhar|aplicar|pulverizar|colher|plantar|manejo|decidir|muito|quanto deve chover|quanto vai chover|acumulado|enchente|alagamento)\b/i;
const SYNOPTIC_RE =
  /\b(frente fria|onda de calor|massa de ar|ciclone|tempestade|granizo|vendaval|alerta|aviso|seca|estiagem|inc[eê]ndio|geada)\b/i;
const PRECIP_RE = /\b(chuva|chover|precipita[cç][aã]o|mm|mil[ií]metros?|acumulado)\b/i;

const WEEKDAYS: Array<[RegExp, number, string]> = [
  [/\bdomingo\b/i, 0, "domingo"],
  [/\bsegunda(?:-feira)?\b/i, 1, "segunda-feira"],
  [/\bter[cç]a(?:-feira)?\b/i, 2, "terça-feira"],
  [/\bquarta(?:-feira)?\b/i, 3, "quarta-feira"],
  [/\bquinta(?:-feira)?\b/i, 4, "quinta-feira"],
  [/\bsexta(?:-feira)?\b/i, 5, "sexta-feira"],
  [/\bs[aá]bado\b/i, 6, "sábado"],
];

function pushIntent(intents: WeatherSubIntent[], intent: WeatherSubIntent): void {
  if (!intents.includes(intent)) intents.push(intent);
}

/**
 * Regex word boundaries in JavaScript are ASCII-oriented. A word ending in an
 * accented character (for example, "amanhã") can therefore fail a trailing
 * `\b` check. Normalize only the matching copy; the original user text remains
 * untouched everywhere else in the pipeline.
 */
function normalizeForMatching(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function parseWeatherDates(text: string, defaultYear = new Date().getFullYear()): string[] {
  const matches = [
    ...text.matchAll(
      /\b(20\d{2})-([01]\d)-([0-3]\d)\b|\b([0-3]?\d)[/-]([01]?\d)(?:[/-](20\d{2}|\d{2}))?\b/g,
    ),
  ];
  const sharedYear = matches.find((m) => m[1] || m[6]);
  const yearHint = sharedYear ? Number(sharedYear[1] || sharedYear[6]) : defaultYear;
  const dates = matches.flatMap((m) => {
    const rawYear = Number(m[1] || m[6] || yearHint);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const month = Number(m[2] || m[5]);
    const day = Number(m[3] || m[4]);
    const value = new Date(Date.UTC(year, month - 1, day));
    if (
      value.getUTCFullYear() !== year ||
      value.getUTCMonth() !== month - 1 ||
      value.getUTCDate() !== day
    )
      return [];
    return [`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`];
  });
  return [...new Set(dates)].sort();
}

function temporalExpression(text: string): string | null {
  const match = text.match(
    /\b(agora|hoje|amanh[aã]|depois de amanh[aã]|fim de semana|final de semana|esta semana|essa semana|pr[oó]xima semana|domingo|segunda(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[aá]bado|madrugada|manh[aã]|tarde|noite)\b/i,
  );
  return match?.[0] ?? null;
}

function periodForText(text: string): WeatherDayPeriod {
  if (/\bmadrugada\b/i.test(text)) return "dawn";
  if (/\b(?:de|pela|na)\s+manh[aã]\b|\bamanh[aã]\s+de\s+manh[aã]\b/i.test(text)) return "morning";
  if (/\b(?:[àa]|de|pela|na)\s+tarde\b/i.test(text)) return "afternoon";
  if (/\b(?:fim|final)\s+da\s+tarde\b/i.test(text)) return "evening";
  if (/\b(?:[àa]|de|pela|na)\s+noite\b/i.test(text)) return "night";
  return null;
}

export function analyzeWeatherRequest(text: string, nowMs = Date.now()): WeatherRequestAnalysis {
  const matchText = normalizeForMatching(text);
  const intents: WeatherSubIntent[] = [];
  const requestedDates = parseWeatherDates(
    text,
    Number(
      new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(
        nowMs,
      ),
    ),
  );
  const hasForecastPeriod =
    requestedDates.length > 0 || /\b(?:hoje|amanha|semana|dias)\b/i.test(matchText);
  const asksCurrent = CURRENT_RE.test(matchText) && !hasForecastPeriod;
  const needsHourly = HOURLY_RE.test(matchText);
  const needsAlerts = ALERT_RE.test(matchText);
  const agroAnalysis = AGRO_RE.test(matchText);
  const highImpactDecision =
    HIGH_IMPACT_RE.test(matchText) && (PRECIP_RE.test(matchText) || agroAnalysis);
  const explicitDate = requestedDates[0] ?? null;
  const dayOffsets: number[] = [];
  if (/\bhoje\b/i.test(matchText)) dayOffsets.push(0);
  if (/\bdepois\s+de\s+amanha\b/i.test(matchText)) dayOffsets.push(2);
  if (/\bamanha\b/i.test(matchText.replace(/depois\s+de\s+amanha/gi, ""))) dayOffsets.push(1);
  const weekend = /\b(?:fim|final)\s+de\s+semana\b/i.test(matchText);

  let dayOffset: number | null = null;
  if (/\bdepois\s+de\s+amanh[aã]\b/i.test(matchText)) dayOffset = 2;
  else if (/\bamanh[aã]\b/i.test(matchText)) dayOffset = 1;
  else if (/\bhoje\b/i.test(matchText) || asksCurrent) dayOffset = 0;

  let weekday: number | null = null;
  for (const [pattern, value] of WEEKDAYS) {
    if (pattern.test(matchText)) {
      weekday = value;
      break;
    }
  }

  if (asksCurrent) pushIntent(intents, "WEATHER_CURRENT");
  if (needsHourly) pushIntent(intents, "WEATHER_HOURLY");
  if (needsAlerts) pushIntent(intents, "WEATHER_ALERT");
  if (agroAnalysis) pushIntent(intents, "WEATHER_AGRO_ANALYSIS");

  if (
    !asksCurrent ||
    /\b(amanh[aã]|semana|pr[oó]ximos|vai|previs[aã]o|chover|m[aá]xima|m[ií]nima|esfriar|aquecer)\b/i.test(
      matchText,
    )
  ) {
    pushIntent(intents, "WEATHER_FORECAST");
  }
  if (intents.length === 0) pushIntent(intents, "WEATHER_FORECAST");

  const asksAmount =
    /\b(quanto|quantos?)\b.{0,25}\b(mm|mil[ií]metros?|chover|chuva)\b|\bacumulado\b/i.test(
      matchText,
    );
  const modelSensitive =
    PRECIP_RE.test(matchText) || needsAlerts || /\b(esfriar|frio|calor|vento)\b/i.test(matchText);
  const deep = highImpactDecision || asksAmount || SYNOPTIC_RE.test(matchText);
  const quick = asksCurrent && !needsHourly && !needsAlerts && !agroAnalysis && !modelSensitive;
  const depth: WeatherResearchDepth = deep ? "deep" : quick ? "quick" : "standard";

  return {
    intents,
    depth,
    asksCurrent,
    needsHourly,
    needsAlerts,
    needsModelConsensus:
      depth !== "quick" && (modelSensitive || intents.includes("WEATHER_FORECAST")),
    needsWebCrosscheck: deep && SYNOPTIC_RE.test(matchText),
    agroAnalysis,
    highImpactDecision,
    dayOffset,
    explicitDate,
    explicitEndDate: requestedDates.at(-1) ?? null,
    requestedDates,
    dayOffsets,
    weekday,
    weekend,
    period: periodForText(matchText),
    originalTemporalExpression: temporalExpression(matchText),
  };
}

function datePartsInTimezone(
  now: Date,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function nextWeekday(date: string, target: number): string {
  const current = weekdayOf(date);
  const delta = (target - current + 7) % 7;
  return addDays(date, delta);
}

function hoursForPeriod(period: WeatherDayPeriod): [number | null, number | null] {
  switch (period) {
    case "dawn":
      return [0, 5];
    case "morning":
      return [6, 11];
    case "afternoon":
      return [12, 17];
    case "evening":
      return [17, 20];
    case "night":
      return [18, 23];
    default:
      return [null, null];
  }
}

export function resolveWeatherTimeWindow(
  analysis: WeatherRequestAnalysis,
  timezone: string,
  nowMs = Date.now(),
): WeatherTimeWindow {
  const now = new Date(nowMs);
  const parts = datePartsInTimezone(now, timezone);
  const localDate = isoDate(parts.year, parts.month, parts.day);
  let startDate = localDate;
  let endDate = localDate;

  if (analysis.explicitDate) {
    startDate = analysis.explicitDate;
    endDate = analysis.explicitEndDate ?? analysis.explicitDate;
  } else if (analysis.weekend) {
    const saturday = nextWeekday(localDate, 6);
    startDate = saturday;
    endDate = addDays(saturday, 1);
  } else if (analysis.weekday !== null) {
    startDate = nextWeekday(localDate, analysis.weekday);
    endDate = startDate;
  } else if (analysis.dayOffsets?.length) {
    startDate = addDays(localDate, Math.min(...analysis.dayOffsets));
    endDate = addDays(localDate, Math.max(...analysis.dayOffsets));
  } else if (analysis.dayOffset !== null) {
    startDate = addDays(localDate, analysis.dayOffset);
    endDate = startDate;
  } else if (/semana/i.test(analysis.originalTemporalExpression ?? "")) {
    endDate = addDays(localDate, 6);
  } else if (analysis.depth !== "quick") {
    endDate = addDays(localDate, 6);
  }

  const [startHour, endHour] = hoursForPeriod(analysis.period);
  const localNow = `${localDate} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const periodText = analysis.period ? `, período ${analysis.period}` : "";
  const description =
    startDate === endDate ? `${startDate}${periodText}` : `${startDate} a ${endDate}${periodText}`;

  return {
    timezone,
    localNow,
    localDate,
    startDate,
    endDate,
    startHour,
    endHour,
    description,
  };
}
