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

interface EmbeddingRequestOptions {
  maxRetries: number;
  backoffMs: readonly number[];
  requestTimeoutMs: number;
  maxRateLimitWaitMs: number;
  purpose: "ingestion" | "query";
}

const INGESTION_OPTIONS: EmbeddingRequestOptions = {
  maxRetries: 7,
  backoffMs: [2_000, 4_000, 8_000, 16_000, 30_000, 60_000],
  requestTimeoutMs: 20_000,
  maxRateLimitWaitMs: 60_000,
  purpose: "ingestion",
};

// Busca conversacional nunca pode herdar minutos de backoff da ingestão.
// Se a semântica falhar, searchKnowledge ainda executa a busca lexical.
const QUERY_OPTIONS: EmbeddingRequestOptions = {
  maxRetries: 1,
  backoffMs: [500],
  requestTimeoutMs: 5_000,
  maxRateLimitWaitMs: 1_000,
  purpose: "query",
};

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

function embeddingApiKey(): string {
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
  return apiKey;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoffForAttempt(options: EmbeddingRequestOptions, attempt: number): number {
  return options.backoffMs[Math.min(attempt, options.backoffMs.length - 1)] ?? 500;
}

function retryAfterMs(response: Response, options: EmbeddingRequestOptions): number {
  const retryAfter = response.headers.get("Retry-After");
  const resetTokens = response.headers.get("x-ratelimit-reset-tokens");
  let waitMs = 0;

  if (retryAfter) {
    waitMs = Number.parseFloat(retryAfter) * 1_000;
  } else if (resetTokens?.endsWith("ms")) {
    waitMs = Number.parseFloat(resetTokens);
  } else if (resetTokens?.endsWith("s")) {
    waitMs = Number.parseFloat(resetTokens) * 1_000;
  }

  if (!Number.isFinite(waitMs) || waitMs <= 0) return 0;
  return Math.min(waitMs, options.maxRateLimitWaitMs);
}

async function waitBeforeRetry(
  options: EmbeddingRequestOptions,
  attempt: number,
  requestedWaitMs = 0,
): Promise<void> {
  const base = requestedWaitMs || backoffForAttempt(options, attempt);
  // Jitter pequeno somente na ingestão. A consulta interativa deve ser previsível.
  const jitter = options.purpose === "ingestion" ? Math.random() * 500 : 0;
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}

async function embedBatch(
  inputs: string[],
  apiKey: string,
  options: EmbeddingRequestOptions,
): Promise<number[][]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.requestTimeoutMs);

    try {
      logDiagnostic("info", "embeddings.request.start", {
        provider: "openai",
        model: embeddingModel(),
        purpose: options.purpose,
        attempt: attempt + 1,
        max_retries: options.maxRetries,
        timeout_ms: options.requestTimeoutMs,
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
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const waitMs = res.status === 429 ? retryAfterMs(res, options) : 0;
        logDiagnostic(
          retryableStatus(res.status) && attempt < options.maxRetries ? "warn" : "error",
          "embeddings.response.error",
          {
            provider: "openai",
            model: embeddingModel(),
            purpose: options.purpose,
            status: res.status,
            status_text: res.statusText,
            attempt: attempt + 1,
            max_retries: options.maxRetries,
            duration_ms: Date.now() - started,
            wait_ms: waitMs || undefined,
            response_headers: diagnosticResponseHeaders(res),
            error_body: safeErrorSnippet(body),
          },
        );

        const error = new EmbeddingError(
          `Falha ao gerar embeddings (${res.status}): ${safeErrorSnippet(body, 200)}`,
          res.status,
        );
        lastError = error;
        if (retryableStatus(res.status) && attempt < options.maxRetries) {
          clearTimeout(timer);
          await waitBeforeRetry(options, attempt, waitMs);
          continue;
        }
        throw error;
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
          purpose: options.purpose,
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
          purpose: options.purpose,
          status: res.status,
          duration_ms: Date.now() - started,
          expected_count: inputs.length,
          received_count: data.data?.length ?? 0,
          usage: data.usage,
        });
        throw new EmbeddingError("Resposta de embeddings inválida.", 502);
      }

      const out: number[][] = new Array(inputs.length);
      for (const d of data.data) out[d.index] = d.embedding;
      logDiagnostic("info", "embeddings.response.success", {
        provider: "openai",
        model: embeddingModel(),
        purpose: options.purpose,
        status: res.status,
        duration_ms: Date.now() - started,
        batch_size: inputs.length,
        dimensions: out[0]?.length ?? DIMENSIONS,
        usage: data.usage,
        response_headers: diagnosticResponseHeaders(res),
      });
      return out;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = error instanceof EmbeddingError ? error.status : null;
      const aborted = controller.signal.aborted || lastError.name === "AbortError";
      const transient = aborted || status === null || retryableStatus(status);

      if (transient && attempt < options.maxRetries) {
        logDiagnostic("warn", "embeddings.request.retry", {
          provider: "openai",
          model: embeddingModel(),
          purpose: options.purpose,
          attempt: attempt + 1,
          max_retries: options.maxRetries,
          error_name: lastError.name,
          error_message: lastError.message,
        });
        clearTimeout(timer);
        await waitBeforeRetry(options, attempt);
        continue;
      }

      logDiagnostic("error", "embeddings.request.failed", {
        provider: "openai",
        model: embeddingModel(),
        purpose: options.purpose,
        attempts: attempt + 1,
        error_name: lastError.name,
        error_message: lastError.message,
      });
      if (aborted) {
        throw new EmbeddingError("A busca semântica demorou demais para responder.", 504);
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error("Falha após múltiplas tentativas.");
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = embeddingApiKey();
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const vecs = await embedBatch(slice, apiKey, INGESTION_OPTIONS);
    all.push(...vecs);

    if (i + BATCH < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return all;
}

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = embeddingApiKey();
  const [vector] = await embedBatch([text], apiKey, QUERY_OPTIONS);
  return vector;
}

/** pgvector accepts either an array or a bracketed string; string is safest across drivers. */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
