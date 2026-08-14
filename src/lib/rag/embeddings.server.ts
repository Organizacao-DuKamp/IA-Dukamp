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
  const MAX_RETRIES = 7;
  const BACKOFF = [2000, 4000, 8000, 16000, 30000, 60000];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const resetTokens = res.headers.get("x-ratelimit-reset-tokens");
        
        let waitMs = 0;
        if (retryAfter) {
          waitMs = parseInt(retryAfter, 10) * 1000;
        } else if (resetTokens) {
          // OpenAI tokens reset header format is often like "6ms" or "1.5s"
          if (resetTokens.endsWith("ms")) waitMs = parseInt(resetTokens);
          else if (resetTokens.endsWith("s")) waitMs = parseFloat(resetTokens) * 1000;
        }

        if (waitMs <= 0) {
          // Fallback to exponential backoff with jitter
          const base = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
          waitMs = base + Math.random() * 1000;
        }

        if (attempt < MAX_RETRIES) {
          console.log(`[embeddings] Rate limit (429). Tentativa ${attempt + 1}/${MAX_RETRIES}. Aguardando ${Math.round(waitMs)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
      }

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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // If it's a network error (not 429 which is handled above), we might still want to retry
      if (attempt < MAX_RETRIES) {
        const waitMs = BACKOFF[Math.min(attempt, BACKOFF.length - 1)] + Math.random() * 1000;
        console.warn(`[embeddings] Erro na tentativa ${attempt + 1}: ${lastError.message}. Retrying in ${Math.round(waitMs)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("Falha após múltiplas tentativas.");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!apiKey || apiKey.startsWith('sb_publishable_')) {
    throw new EmbeddingError("Serviço de embeddings indisponível (chave ausente ou inválida no backend).", 500);
  }
  if (texts.length === 0) return [];
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vecs = await embedBatch(slice, apiKey);
    all.push(...vecs);
    
    // Pequeno throttling entre lotes para suavizar TPM, exceto se for o último
    if (i + BATCH < texts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
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
