export interface GroundingResult {
  valid: boolean;
  issues: string[];
}

function hasExplicitDate(reply: string): boolean {
  return /\b(?:[0-3]?\d[/-][01]?\d[/-]20\d{2}|20\d{2}-[01]\d-[0-3]\d|[0-3]?\d\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+20\d{2})\b/i.test(
    reply,
  );
}

function hasIdentifiedSource(reply: string): boolean {
  return /(?:\bfonte\s*:|\bsegundo\s+(?:o|a)\b|\b(?:CEPEA|ESALQ|Scot|B3|Conab|IMEA|IEA|Not[ií]cias\s+Agr[ií]colas|Canal\s+Rural|Agrolink|ANP|Banco\s+Central|IBGE|MAPA|MDIC|Comex\s+Stat|Brasil61|Agron|Safras\s*&\s*Mercado)\b)/i.test(
    reply,
  );
}

function hasMarketUnit(reply: string): boolean {
  return /(?:\/@|\b(?:arrobas?|sacas?|kg|quilos?|litros?|cabe[cç]as?|toneladas?|bushels?|R\$\s*\/\s*(?:@|kg|l|t))\b)/i.test(
    reply,
  );
}

function looksLikeMarketReply(reply: string): boolean {
  return /(?:\b(?:mercado|cota[cç][aã]o|indicador|boi\s+gordo|arroba|carca[cç]a|atacado|pra[cç]a|CEPEA|ESALQ|Scot|Conab|Brasil61|Agron|Safras\s*&\s*Mercado)\b|\/@)/i.test(
    reply,
  );
}

function addIssue(issues: string[], issue: string): void {
  if (!issues.includes(issue)) issues.push(issue);
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mentionsExpectedLocation(reply: string, location: string): boolean {
  const normalizedReply = normalizeComparable(reply);
  const tokens = normalizeComparable(location)
    .split(" ")
    .filter((token) => token.length >= 3 && !["regiao", "cidade", "brasil"].includes(token));
  if (tokens.length === 0) return normalizedReply.includes(normalizeComparable(location));
  return tokens.some((token) => new RegExp(`\\b${token}\\b`).test(normalizedReply));
}

function hasWeatherSource(reply: string): boolean {
  return /(?:\bfonte\s*:|\bsegundo\s+(?:o|a)\b|\b(?:INMET|CPTEC|INPE|CEMADEN|ANA|Defesa\s+Civil|ECMWF|NOAA|Open-?Meteo|Simepar|Epagri|Climatempo|IPMet|Funceme)\b)/i.test(
    reply,
  );
}

export function validateWeatherGrounding(reply: string, location: string): GroundingResult {
  const issues: string[] = [];
  if (!mentionsExpectedLocation(reply, location)) addIssue(issues, "weather_location_missing");
  if (!hasExplicitDate(reply)) addIssue(issues, "weather_date_missing");
  if (!hasWeatherSource(reply)) addIssue(issues, "weather_source_missing");
  if (
    !/\b(?:°\s*C|temperatura|chuva|precipita[cç][aã]o|umidade|vento|rajada|tempestade|geada|alerta)\b/i.test(
      reply,
    )
  )
    addIssue(issues, "weather_details_missing");
  return { valid: issues.length === 0, issues };
}

export function validateGrounding(
  reply: string,
  evidence: { commercial: boolean; citations?: number; currentMarket?: boolean },
): GroundingResult {
  const issues: string[] = [];
  const refs = [...reply.matchAll(/\[(\d+)]/g)].map((m) => Number(m[1]));
  if (refs.some((n) => n < 1 || n > (evidence.citations ?? 0)))
    addIssue(issues, "unmapped_citation");

  const hasMoney = /(?:R\$\s*\d|US\$\s*\d)/i.test(reply);
  const marketReply = hasMoney && looksLikeMarketReply(reply);
  const externallyAttributedMarketFact =
    marketReply && hasExplicitDate(reply) && hasIdentifiedSource(reply) && hasMarketUnit(reply);

  // Valores de mercado não são fatos comerciais da DuKamp. Se uma resposta
  // sobre mercado vier incompleta, sinalize como problema de grounding de
  // mercado para que o orquestrador a corrija com fonte/data/unidade. Isso
  // impede que uma análise de boi, carne, frango etc. seja substituída pelo
  // fallback de "estoque/preço da base oficial da DuKamp".
  if (!evidence.commercial && marketReply && !externallyAttributedMarketFact) {
    if (!hasExplicitDate(reply)) addIssue(issues, "market_price_without_explicit_date");
    if (!hasIdentifiedSource(reply)) addIssue(issues, "market_price_without_source");
    if (!hasMarketUnit(reply)) addIssue(issues, "market_price_without_unit");
  } else if (
    !evidence.commercial &&
    !externallyAttributedMarketFact &&
    /(?:R\$\s*\d|\b(?:estoque|dispon[ií]vel)\s*(?:de|:)?\s*\d)/i.test(reply)
  ) {
    addIssue(issues, "unsupported_commercial_fact");
  }

  if (evidence.currentMarket) {
    const offersCurrentLookupLater =
      /\b(?:se\s+(?:voc[eê]\s+)?quiser|caso\s+(?:voc[eê]\s+)?queira|quer\s+que\s+eu)\b[\s\S]{0,180}\b(?:mais\s+recent\w*|atualizad[oa]|de\s+hoje|agora)\b/i.test(
        reply,
      ) ||
      /\b(?:posso|consigo)\s+(?:te\s+)?(?:buscar|pesquisar|consultar|verificar|passar)\b[\s\S]{0,120}\b(?:mais\s+recent\w*|atualizad[oa]|de\s+hoje)\b/i.test(
        reply,
      );
    if (offersCurrentLookupLater) addIssue(issues, "deferred_current_market_lookup");

    if (hasMoney) {
      if (!hasExplicitDate(reply)) addIssue(issues, "market_price_without_explicit_date");
      if (!hasIdentifiedSource(reply)) addIssue(issues, "market_price_without_source");
      if (!hasMarketUnit(reply)) addIssue(issues, "market_price_without_unit");
    }
  }
  return { valid: issues.length === 0, issues };
}

export function stripUnmappedCitations(reply: string, citationCount: number): string {
  return reply
    .replace(/\[(\d+)]/g, (all, n) => (Number(n) <= citationCount ? all : ""))
    .replace(/ {2,}/g, " ")
    .trim();
}
