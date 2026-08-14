// Embeddings via OpenAI (3072 dims, compatible with the existing pgvector
// schema). OPENAI_API_KEY is server-only; never sent to the client.

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-large";
const DIMENSIONS = 3072;
const BATCH = 50;

export function embeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL;
}

export function embeddingProvider(): string {
  return `openai:${embeddingModel()}:${DIMENSIONS}`;
}

export class EmbeddingError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function embedBatch(inputs: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: embeddingModel(),
      input: inputs,
      dimensions: DIMENSIONS,
      encoding_format: "float",
    }),
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
  const apiKey = process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY;
  console.log('[embeddings] resolving key:', apiKey ? (apiKey.startsWith('sk-') ? 'sk-...' : (apiKey.startsWith('sb_') ? 'sb_...' : 'unknown')) : 'missing');
  if (!apiKey || apiKey.startsWith('sb_publishable_')) {
    throw new EmbeddingError("Serviço de embeddings indisponível (chave ausente ou inválida no backend).", 500);
  }
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
