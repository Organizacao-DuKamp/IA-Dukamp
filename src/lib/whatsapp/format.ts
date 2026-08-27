const HARD_MAX_CHARS = 3500;

export interface WhatsAppTextSplitOptions {
  hardMaxChars?: number;
}

function isBulletLine(value: string): boolean {
  return /^\s*(?:[•*-]|\d+[.)])\s+/u.test(value);
}

function isStandaloneHeading(value: string): boolean {
  return /^\*[^*\n]{1,80}\*$/u.test(value.trim());
}

function formatBulletLine(value: string): string {
  const match = value.match(/^(\s*(?:[•*-]|\d+[.)]))\s+(.+)$/u);
  if (!match) return value.trimEnd();

  const marker = match[1]?.trim() ?? "•";
  const body = match[2]?.trim() ?? "";
  const labelled = body.match(/^([^—\n]{1,32})\s+—\s+(.+)$/u);

  let formattedBody = body;
  if (labelled) {
    const label = labelled[1]?.trim() ?? "";
    const details = labelled[2]?.trim() ?? "";
    formattedBody = `*${label}*\n  ${details}`;
  }

  // Em itens extensos, o ponto e vírgula normalmente já marca uma mudança de
  // dado (temperatura, chuva, vento etc.). Mantemos a pontuação e apenas criamos
  // uma nova linha visual, sem reescrever o conteúdo factual.
  formattedBody = formattedBody.replace(/;\s+/g, ";\n  ");
  return `${marker} ${formattedBody}`;
}

function normalizeWhatsAppText(value: string): string {
  const rawLines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let previousWasBullet = false;

  for (const rawLine of rawLines) {
    const canonical = rawLine
      .trimEnd()
      .replace(/^#{1,6}\s+(.+)$/u, "*$1*")
      .replace(/\*\*([^*\n]+)\*\*/g, "*$1*");

    if (!canonical.trim()) {
      if (output.length > 0 && output[output.length - 1] !== "") output.push("");
      previousWasBullet = false;
      continue;
    }

    const bullet = isBulletLine(canonical);
    const heading = isStandaloneHeading(canonical);

    // Itens consecutivos e títulos precisam de respiro no WhatsApp. O espaço é
    // inserido na camada de transporte para a legibilidade não depender do LLM.
    if (
      output.length > 0 &&
      output[output.length - 1] !== "" &&
      ((bullet && previousWasBullet) || heading)
    ) {
      output.push("");
    }

    output.push(bullet ? formatBulletLine(canonical) : canonical.trimEnd());
    previousWasBullet = bullet;
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function boundaryCut(value: string, maxChars: number): number {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return chars.length;

  const floor = Math.max(1, Math.floor(maxChars * 0.58));
  const ceiling = Math.min(maxChars, chars.length);

  const isBreak = (index: number, type: "blank" | "line" | "punctuation" | "space") => {
    const current = chars[index] ?? "";
    const previous = chars[index - 1] ?? "";
    if (type === "blank") return current === "\n" && previous === "\n";
    if (type === "line") return current === "\n";
    if (type === "punctuation") return /\s/u.test(current) && /[.!?;:,]/u.test(previous);
    return /\s/u.test(current);
  };

  for (const type of ["blank", "line", "punctuation", "space"] as const) {
    for (let index = ceiling - 1; index >= floor; index -= 1) {
      if (isBreak(index, type)) return Math.max(1, index);
    }
  }

  return maxChars;
}

function hardSplit(value: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = value.trim();

  while (Array.from(remaining).length > maxChars) {
    const cut = boundaryCut(remaining, maxChars);
    const chars = Array.from(remaining);
    const head = chars.slice(0, cut).join("").trim();
    remaining = chars.slice(cut).join("").trim();
    if (head) chunks.push(head);
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Prepara a resposta para leitura no WhatsApp sem alterar os fatos. Respostas
 * normais permanecem em uma única mensagem: a legibilidade vem de títulos,
 * espaços e quebras internas. Só ultrapassar o limite rígido gera vários envios,
 * preservando o perfil de idempotência já existente no webhook.
 */
export function splitWhatsAppOutboundText(
  value: string,
  options: WhatsAppTextSplitOptions = {},
): string[] {
  const hardMaxChars = Math.max(200, Math.trunc(options.hardMaxChars ?? HARD_MAX_CHARS));
  const normalized = normalizeWhatsAppText(value);
  if (!normalized) return [];

  if (Array.from(normalized).length <= hardMaxChars) return [normalized];
  return hardSplit(normalized, hardMaxChars);
}
