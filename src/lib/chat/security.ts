const INSTRUCTION_PATTERNS = [
  /ignore (?:todas? )?(?:as )?instru[cç][oõ]es? (?:anteriores|acima)/gi,
  /revele (?:o )?(?:prompt|segredo|token|chave)/gi,
  /(?:system|assistant)\s*:/gi,
  /<\/?(?:system|assistant|developer)[^>]*>/gi,
];
export function sanitizeRetrievedContent(content: string, maxChars = 2400): string {
  // eslint-disable-next-line no-control-regex
  let clean = content.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ");
  for (const pattern of INSTRUCTION_PATTERNS)
    clean = clean.replace(pattern, "[instrução não confiável removida]");
  return clean
    .replace(/\s{3,}/g, "  ")
    .trim()
    .slice(0, maxChars);
}
export function redactLogValue(value: string): string {
  return value
    .replace(/(?:sk-|pplx-|sb_secret_)[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}
