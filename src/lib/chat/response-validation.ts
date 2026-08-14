export interface GroundingResult {
  valid: boolean;
  issues: string[];
}
export function validateGrounding(
  reply: string,
  evidence: { commercial: boolean; citations?: number; currentMarket?: boolean },
): GroundingResult {
  const issues: string[] = [];
  const refs = [...reply.matchAll(/\[(\d+)]/g)].map((m) => Number(m[1]));
  if (refs.some((n) => n < 1 || n > (evidence.citations ?? 0))) issues.push("unmapped_citation");
  if (
    !evidence.commercial &&
    /(?:R\$\s*\d|\b(?:estoque|dispon[ií]vel)\s*(?:de|:)?\s*\d)/i.test(reply)
  )
    issues.push("unsupported_commercial_fact");

  if (evidence.currentMarket) {
    const offersCurrentLookupLater =
      /\b(?:se\s+(?:voc[eê]\s+)?quiser|caso\s+(?:voc[eê]\s+)?queira|quer\s+que\s+eu)\b[\s\S]{0,180}\b(?:mais\s+recent\w*|atualizad[oa]|de\s+hoje|agora)\b/i.test(
        reply,
      ) ||
      /\b(?:posso|consigo)\s+(?:te\s+)?(?:buscar|pesquisar|consultar|verificar|passar)\b[\s\S]{0,120}\b(?:mais\s+recent\w*|atualizad[oa]|de\s+hoje)\b/i.test(
        reply,
      );
    if (offersCurrentLookupLater) issues.push("deferred_current_market_lookup");

    const hasPrice = /\b(?:R\$|US\$)\s*\d/i.test(reply);
    if (hasPrice) {
      if (
        !/\b(?:[0-3]?\d[/-][01]?\d[/-]20\d{2}|20\d{2}-[01]\d-[0-3]\d|[0-3]?\d\s+de\s+(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+20\d{2})\b/i.test(
          reply,
        )
      )
        issues.push("market_price_without_explicit_date");
      if (
        !/(?:\bfonte\s*:|\bsegundo\s+(?:o|a)\b|\b(?:CEPEA|ESALQ|Scot|B3|Conab|IMEA|IEA|Not[ií]cias\s+Agr[ií]colas|Canal\s+Rural|Agrolink|ANP|Banco\s+Central)\b)/i.test(
          reply,
        )
      )
        issues.push("market_price_without_source");
      if (
        !/(?:\/@|\b(?:arrobas?|sacas?|kg|quilos?|litros?|cabe[cç]as?|toneladas?|bushels?|R\$\s*\/\s*(?:@|kg|l|t))\b)/i.test(
          reply,
        )
      )
        issues.push("market_price_without_unit");
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
