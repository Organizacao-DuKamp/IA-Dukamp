// Embeddings via Lovable AI Gateway (Gemini embedding-001, 3072 dims).
// LOVABLE_API_KEY is server-only; never sent to the client.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "google/gemini-embedding-001";
const BATCH = 50; // Gemini caps at 100 inputs per request; stay well below.

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function embedBatch(inputs: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EmbeddingError(
      `Falha ao gerar embeddings (${res.status}): ${body.slice(0, 200)}`,
      res.status,
    );
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  if (!data.data || data.data.length !== inputs.length) {
    throw new EmbeddingError("Resposta de embeddings inválida.", 502);
  }
  // Ensure order by index
  const out: number[][] = new Array(inputs.length);
  for (const d of data.data) out[d.index] = d.embedding;
  return out;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new EmbeddingError("LOVABLE_API_KEY ausente no servidor.", 500);
  if (texts.length === 0) return [];
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vecs = await embedBatch(slice, apiKey);
    all.push(...vecs);
  }
  return all;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/** pgvector accepts either an array or a bracketed string; string is safest across drivers. */
export function toPgVector(vec: number[]): string {
  return "[" + vec.join(",") + "]";
}
