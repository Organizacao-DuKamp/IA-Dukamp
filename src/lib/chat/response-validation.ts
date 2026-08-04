export interface GroundingResult {
  valid: boolean;
  issues: string[];
}
export function validateGrounding(
  reply: string,
  evidence: { commercial: boolean; citations?: number },
): GroundingResult {
  const issues: string[] = [];
  const refs = [...reply.matchAll(/\[(\d+)]/g)].map((m) => Number(m[1]));
  if (refs.some((n) => n < 1 || n > (evidence.citations ?? 0))) issues.push("unmapped_citation");
  if (
    !evidence.commercial &&
    /(?:R\$\s*\d|\b(?:estoque|dispon[ií]vel)\s*(?:de|:)?\s*\d)/i.test(reply)
  )
    issues.push("unsupported_commercial_fact");
  return { valid: issues.length === 0, issues };
}
export function stripUnmappedCitations(reply: string, citationCount: number): string {
  return reply
    .replace(/\[(\d+)]/g, (all, n) => (Number(n) <= citationCount ? all : ""))
    .replace(/ {2,}/g, " ")
    .trim();
}
