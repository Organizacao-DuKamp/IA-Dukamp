// Simple, deterministic text chunker with overlap.
// Splits by paragraphs first, then packs into ~CHUNK_SIZE with OVERLAP tail.

const CHUNK_SIZE = 1200;
const OVERLAP = 180;

export function chunkText(input: string): string[] {
  const clean = input.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  for (const p of paragraphs) {
    if (p.length > CHUNK_SIZE) {
      // Hard split long paragraphs.
      flush();
      for (let i = 0; i < p.length; i += CHUNK_SIZE - OVERLAP) {
        const slice = p.slice(i, i + CHUNK_SIZE);
        chunks.push(slice);
        if (i + CHUNK_SIZE >= p.length) break;
      }
      continue;
    }
    if (buf.length + p.length + 2 > CHUNK_SIZE) {
      flush();
      // seed next buffer with overlap tail of last chunk
      const last = chunks[chunks.length - 1] ?? "";
      if (last.length > OVERLAP) buf = last.slice(-OVERLAP) + "\n\n";
    }
    buf += (buf ? "\n\n" : "") + p;
  }
  flush();
  return chunks;
}
