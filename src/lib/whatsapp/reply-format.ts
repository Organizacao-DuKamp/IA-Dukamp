/** Sources remain in usage metadata/web responses, not in WhatsApp prose. */
export function formatWhatsAppReply(value: string): string {
  return value
    .replace(
      /(?:^|\n)\s*(?:#{1,6}\s*)?\*{0,2}(?:fontes(?: consultadas)?|referências|sources)\*{0,2}:?\s*\n[\s\S]*$/i,
      "",
    )
    .replace(/!?\[[^\]\n]*\]\(https?:\/\/[^\s]*(?:\s+"[^"]*")?\)/gi, "")
    .replace(/https?:\/\/[^\s<>]+/gi, "")
    .replace(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g, "")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitWhatsAppReply(value: string, limit = 3500): string[] {
  const clean = formatWhatsAppReply(value);
  // A links-only provider response must not silently mark delivery as complete.
  const chars = Array.from(
    clean ||
      (value.trim()
        ? "Não consegui preparar uma resposta completa com os dados pesquisados. Pode reformular a pergunta?"
        : ""),
  );
  const chunks: string[] = [];
  while (chars.length) {
    let end = Math.min(chars.length, limit);
    if (chars.length > limit) {
      const candidate = chars.slice(0, limit).join("");
      const boundary = Math.max(candidate.lastIndexOf("\n"), candidate.lastIndexOf(" "));
      if (boundary > 0) end = Array.from(candidate.slice(0, boundary)).length;
    }
    const chunk = chars.splice(0, end).join("").trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
