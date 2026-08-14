// Embeddings via OpenAI (3072 dims, compatible with the existing pgvector
// schema). OPENAI_API_KEY is server-only; never sent to the client.

import {
  diagnosticResponseHeaders,
  logDiagnostic,
  safeErrorSnippet,
} from "../chat/diagnostics.server.ts";

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
    const started = Date.now();
    try {
      logDiagnostic("info", "embeddings.request.start", {
        provider: "openai",
        model: embeddingModel(),
        attempt: attempt + 1,
        batch_size: inputs.length,
        input_chars: inputs.reduce((sum, item) => sum + item.length, 0),
        dimensions: DIMENSIONS,
      });

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

        logDiagnostic(attempt < MAX_RETRIES ? "warn" : "error", "embeddings.response.rate_limit", {
          provider: "openai",
          model: embeddingModel(),
          status: res.status,
          attempt: attempt + 1,
          max_retries: MAX_RETRIES,
          duration_ms: Date.now() - started,
          wait_ms: Math.round(waitMs),
          response_headers: diagnosticResponseHeaders(res),
        });

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logDiagnostic("error", "embeddings.response.error", {
          provider: "openai",
          model: embeddingModel(),
          status: res.status,
          status_text: res.statusText,
          attempt: attempt + 1,
          duration_ms: Date.now() - started,
          response_headers: diagnosticResponseHeaders(res),
          error_body: safeErrorSnippet(body),
        });
        throw new EmbeddingError(
          `Falha ao gerar embeddings (${res.status}): ${safeErrorSnippet(body, 200)}`,
          res.status,
        );
      }

      const raw = await res.text().catch(() => "");
      let data: {
        data?: Array<{ embedding: number[]; index: number }>;
        usage?: unknown;
      };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch (error) {
        logDiagnostic("error", "embeddings.response.invalid_json", {
          provider: "openai",
          model: embeddingModel(),
          status: res.status,
          duration_ms: Date.now() - started,
          response_headers: diagnosticResponseHeaders(res),
          body_preview: safeErrorSnippet(raw, 500),
          error_message: error instanceof Error ? error.message : String(error),
        });
        throw new EmbeddingError("Resposta de embeddings inválida.", 502);
      }

      if (!data.data || data.data.length !== inputs.length) {
        logDiagnostic("error", "embeddings.response.invalid_shape", {
          provider: "openai",
          model: embeddingModel(),
          status: res.status,
          duration_ms: Date.now() - started,
          expected_count: inputs.length,
          received_count: data.data?.length ?? 0,
          usage: data.usage,
        });
        throw new EmbeddingError("Resposta de embeddings inválida.", 502);
      }

      // Ensure order by index
      const out: number[][] = new Array(inputs.length);
      for (const d of data.data) out[d.index] = d.embedding;
      logDiagnostic("info", "embeddings.response.success", {
        provider: "openai",
        model: embeddingModel(),
        status: res.status,
        duration_ms: Date.now() - started,
        batch_size: inputs.length,
        dimensions: out[0]?.length ?? DIMENSIONS,
        usage: data.usage,
        response_headers: diagnosticResponseHeaders(res),
      });
      return out;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // If it's a network error (not 429 which is handled above), we might still want to retry
      if (attempt < MAX_RETRIES) {
        const waitMs = BACKOFF[Math.min(attempt, BACKOFF.length - 1)] + Math.random() * 1000;
        logDiagnostic("warn", "embeddings.request.retry", {
          provider: "openai",
          model: embeddingModel(),
          attempt: attempt + 1,
          max_retries: MAX_RETRIES,
          wait_ms: Math.round(waitMs),
          error_name: lastError.name,
          error_message: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      logDiagnostic("error", "embeddings.request.failed", {
        provider: "openai",
        model: embeddingModel(),
        attempts: attempt + 1,
        error_name: lastError.name,
        error_message: lastError.message,
      });
      throw lastError;
    }
  }

  throw lastError || new Error("Falha após múltiplas tentativas.");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!apiKey || apiKey.startsWith("sb_publishable_")) {
    logDiagnostic("error", "embeddings.configuration_error", {
      provider: "openai",
      model: embeddingModel(),
      reason: !apiKey ? "missing_api_key" : "invalid_api_key_type",
    });
    throw new EmbeddingError(
      "Serviço de embeddings indisponível (chave ausente ou inválida no backend).",
      500,
    );
  }
  if (texts.length === 0) return [];
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vecs = await embedBatch(slice, apiKey);
    all.push(...vecs);

    // Pequeno throttling entre lotes para suavizar TPM, exceto se for o último
    if (i + BATCH < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
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
