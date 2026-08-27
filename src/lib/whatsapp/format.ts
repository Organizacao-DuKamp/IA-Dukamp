const HARD_MAX_CHARS = 3500;
const SOFT_SPLIT_TRIGGER_CHARS = 850;
const SOFT_TARGET_CHARS = 650;

export interface WhatsAppTextSplitOptions {
  hardMaxChars?: number;
  softSplitTriggerChars?: number;
  softTargetChars?: number;
}

function normalizeWhatsAppText(value: string): string {
  const lines = value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .trimEnd()
        .replace(/^#{1,6}\s+(.+)$/u, "*$1*")
        .replace(/\*\*([^*\n]+)\*\*/g, "*$1*"),
    );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function boundaryCut(value: string, maxChars: number): number {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return chars.length;

  const floor = Math.max(1, Math.floor(maxChars * 0.58));
  const ceiling = Math.min(maxChars, chars.length);

  // Trabalha somente com índices de code points. Assim emojis e caracteres
  // acentuados nunca deslocam o ponto de corte em relação ao Array.from usado
  // por hardSplit.
  for (let index = ceiling - 1; index >= floor; index -= 1) {
    if (chars[index] === "\n") return index;
  }

  for (let index = ceiling - 1; index >= floor; index -= 1) {
    if (/\s/u.test(chars[index] ?? "") && /[.!?;:,]/u.test(chars[index - 1] ?? "")) {
      return index;
    }
  }

  for (let index = ceiling - 1; index >= floor; index -= 1) {
    if (/\s/u.test(chars[index] ?? "")) return index;
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

function sentenceUnits(block: string): string[] {
  const byLine = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const sentences = block
    .split(/(?<=[.!?])\s+(?=[\p{L}\p{N}*_])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.length > 1 ? sentences : [block.trim()];
}

function expandBlock(block: string, targetChars: number, hardMaxChars: number): string[] {
  if (Array.from(block).length <= targetChars) return [block.trim()];

  const result: string[] = [];
  let current = "";

  for (const unit of sentenceUnits(block)) {
    const safeUnits =
      Array.from(unit).length > hardMaxChars ? hardSplit(unit, hardMaxChars) : [unit.trim()];

    for (const safeUnit of safeUnits) {
      if (!current) {
        current = safeUnit;
        continue;
      }

      const separator = /\n/u.test(block) ? "\n" : " ";
      const candidate = `${current}${separator}${safeUnit}`;
      if (Array.from(candidate).length <= targetChars) {
        current = candidate;
      } else {
        result.push(current.trim());
        current = safeUnit;
      }
    }
  }

  if (current.trim()) result.push(current.trim());
  return result.flatMap((item) =>
    Array.from(item).length > hardMaxChars ? hardSplit(item, hardMaxChars) : [item],
  );
}

/**
 * Prepara texto para o WhatsApp sem alterar o conteúdo factual. Respostas curtas
 * continuam em uma única bolha. Respostas longas são quebradas em limites
 * semânticos (parágrafos, linhas e frases), evitando o antigo corte cego no meio
 * de uma frase ou de uma seção.
 */
export function splitWhatsAppOutboundText(
  value: string,
  options: WhatsAppTextSplitOptions = {},
): string[] {
  const hardMaxChars = Math.max(200, Math.trunc(options.hardMaxChars ?? HARD_MAX_CHARS));
  const softTargetChars = Math.min(
    hardMaxChars,
    Math.max(180, Math.trunc(options.softTargetChars ?? SOFT_TARGET_CHARS)),
  );
  const softSplitTriggerChars = Math.min(
    hardMaxChars,
    Math.max(softTargetChars, Math.trunc(options.softSplitTriggerChars ?? SOFT_SPLIT_TRIGGER_CHARS)),
  );

  const normalized = normalizeWhatsAppText(value);
  if (!normalized) return [];

  const length = Array.from(normalized).length;
  if (length <= softSplitTriggerChars) return [normalized];

  const paragraphBlocks = normalized
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);
  const blocks = paragraphBlocks.flatMap((block) =>
    expandBlock(block, softTargetChars, hardMaxChars),
  );

  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (Array.from(block).length > hardMaxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      chunks.push(...hardSplit(block, hardMaxChars));
      continue;
    }

    if (!current) {
      current = block;
      continue;
    }

    const candidate = `${current}\n\n${block}`;
    if (Array.from(candidate).length <= softTargetChars) {
      current = candidate;
    } else {
      chunks.push(current.trim());
      current = block;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.flatMap((chunk) =>
    Array.from(chunk).length > hardMaxChars ? hardSplit(chunk, hardMaxChars) : [chunk],
  );
}
