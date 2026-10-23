import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "../types.ts";
import { USER_MEMORY_EPOCH } from "../memory-reset.ts";
import { recallPeriod, referencesPriorContext } from "./recall.ts";
import type { RecallArchive } from "./whatsapp.server.ts";
import { embeddingModel, embeddingProvider, toPgVector } from "../../rag/embeddings.server.ts";
import { parseOpenAIUsage, recordAIUsageEvent } from "../usage.server.ts";

const Vector = z
  .array(z.number().finite())
  .length(3072)
  .refine((v) => v.some((n) => n !== 0));
const Claims = z
  .array(
    z.object({
      turn_id: z.uuid(),
      phone_number: z.string().regex(/^\d{6,20}$/),
      user_text: z.string().min(4).max(6000),
      source_hash: z.string().regex(/^[a-f0-9]{64}$/),
      lock_token: z.uuid(),
    }),
  )
  .max(8);
export type SemanticClaim = z.infer<typeof Claims>[number];
export interface SemanticMemoryStore {
  claim(provider: string, limit: number, dailyBudget: number): Promise<SemanticClaim[]>;
  finish(claim: SemanticClaim, provider: string, vector: number[] | null): Promise<boolean>;
  search(phone: string, provider: string, vector: number[], before: string): Promise<RecallArchive>;
}
async function database() {
  const { supabaseAdmin } = await import("../../../integrations/supabase/client.server.ts");
  return supabaseAdmin as unknown as SupabaseClient;
}
export const semanticMemoryStore: SemanticMemoryStore = {
  async claim(provider, limit, dailyBudget) {
    const { data, error } = await (
      await database()
    )
      .rpc("claim_whatsapp_semantic_memory", {
        p_provider: provider,
        p_epoch: USER_MEMORY_EPOCH,
        p_limit: limit,
        p_daily_budget: dailyBudget,
      })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("private_memory_claim_unavailable");
    return Claims.parse(data);
  },
  async finish(claim, provider, vector) {
    const { data, error } = await (
      await database()
    )
      .rpc("finish_whatsapp_semantic_memory", {
        p_turn_id: claim.turn_id,
        p_lock: claim.lock_token,
        p_provider: provider,
        p_embedding: vector ? toPgVector(vector) : null,
      })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("private_memory_completion_unavailable");
    return data === true;
  },
  async search(phone, provider, vector, before) {
    const { data, error } = await (
      await database()
    )
      .rpc("recall_whatsapp_semantic", {
        p_phone: phone,
        p_provider: provider,
        p_embedding: toPgVector(vector),
        p_epoch: USER_MEMORY_EPOCH,
        p_before: before,
      })
      .abortSignal(AbortSignal.timeout(3000));
    if (error || !data || !Array.isArray(data.turns) || !Array.isArray(data.facts))
      throw new Error("private_memory_search_unavailable");
    return data as RecallArchive;
  },
};

/** Separate envelope: provider errors and private text never enter diagnostic logs. */
export async function embedPrivateMemory(
  texts: string[],
  purpose: "query" | "index",
  deps: { fetch?: typeof fetch; apiKey?: string } = {},
): Promise<number[][]> {
  if (!texts.length || texts.length > 8 || texts.some((t) => !t.trim() || t.length > 6000))
    throw new Error("invalid_private_embedding_input");
  const key = deps.apiKey ?? process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sb_publishable_")) throw new Error("private_embeddings_unavailable");
  const started = Date.now();
  try {
    const response = await (deps.fetch ?? fetch)("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: embeddingModel(),
        input: texts,
        dimensions: 3072,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("private_embeddings_unavailable");
    const parsed = z
      .object({
        data: z
          .array(
            z.object({
              index: z
                .number()
                .int()
                .min(0)
                .max(texts.length - 1),
              embedding: Vector,
            }),
          )
          .length(texts.length),
        usage: z.unknown().optional(),
      })
      .parse(await response.json());
    if (new Set(parsed.data.map((d) => d.index)).size !== texts.length)
      throw new Error("invalid_private_vectors");
    recordAIUsageEvent({
      provider: "openai",
      operation: "embedding",
      model: embeddingModel(),
      modelTier: "embedding",
      stage: `private_memory_${purpose}`,
      routeReason: purpose,
      inputChars: texts.reduce((n, t) => n + t.length, 0),
      durationMs: Date.now() - started,
      ...parseOpenAIUsage(parsed.usage),
    });
    return parsed.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch {
    // Do not propagate SDK/schema errors that could include the request or provider body.
    throw new Error("private_embeddings_unavailable");
  }
}

export function wantsSemanticRecall(text: string, now = new Date()): boolean {
  if (recallPeriod(text, now)) return false; // Exact-date retrieval already reads original turns.
  const folded = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    referencesPriorContext(text) ||
    /\b(ultim[ao]s?|melhorou|piorou|tinha.{0,40}(?:recomend\w*|suger\w*)|lote\s+\S+|animal\s+\S+|novilha)\b/.test(
      folded,
    )
  );
}
const queryCache = new Map<string, { vector: number[]; until: number }>();
export type SemanticRecall =
  | { status: "available"; archive: RecallArchive }
  | { status: "skipped" | "unavailable" };
export async function recallPrivateSemantic(
  input: { phone: string; text: string; history?: ChatMessage[]; now: Date },
  deps: { store?: SemanticMemoryStore; embed?: typeof embedPrivateMemory; enabled?: boolean } = {},
): Promise<SemanticRecall> {
  if (
    !(deps.enabled ?? process.env.WHATSAPP_SEMANTIC_MEMORY_ENABLED === "true") ||
    !wantsSemanticRecall(input.text, input.now)
  )
    return { status: "skipped" };
  if (!/^\d{6,20}$/.test(input.phone)) throw new Error("invalid_recall_owner");
  try {
    const provider = embeddingProvider();
    const query = [
      input.text.slice(0, 900),
      ...(referencesPriorContext(input.text)
        ? (input.history ?? [])
            .filter((m) => m.role === "user")
            .slice(-2)
            .map((m) => m.content.slice(0, 300))
        : []),
    ]
      .join("\n")
      .slice(0, 1500);
    const key = createHash("sha256").update(`${input.phone}\n${provider}\n${query}`).digest("hex");
    const cached = !deps.embed ? queryCache.get(key) : undefined;
    const vector =
      cached && cached.until > Date.now()
        ? cached.vector
        : Vector.parse((await (deps.embed ?? embedPrivateMemory)([query], "query"))[0]);
    if (!deps.embed && (!cached || cached.until <= Date.now())) {
      for (const [cacheKey, value] of queryCache)
        if (value.until <= Date.now()) queryCache.delete(cacheKey);
      if (queryCache.size >= 64) queryCache.delete(queryCache.keys().next().value!);
      queryCache.set(key, { vector, until: Date.now() + 5 * 60000 });
    }
    const archive = await (deps.store ?? semanticMemoryStore).search(
      input.phone,
      provider,
      vector,
      input.now.toISOString(),
    );
    return { status: "available", archive };
  } catch {
    return { status: "unavailable" };
  }
}
export async function processPrivateSemanticMemory(
  deps: {
    store?: SemanticMemoryStore;
    embed?: typeof embedPrivateMemory;
    enabled?: boolean;
    limit?: number;
    dailyBudget?: number;
  } = {},
) {
  if (
    !(deps.enabled ?? process.env.WHATSAPP_SEMANTIC_MEMORY_ENABLED === "true") ||
    (process.env.CONTEXT && process.env.CONTEXT !== "production")
  )
    return { enabled: false as const };
  const store = deps.store ?? semanticMemoryStore,
    provider = embeddingProvider();
  const requestedLimit = deps.limit ?? 4;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(8, Math.trunc(requestedLimit)))
    : 4;
  const requestedBudget =
    deps.dailyBudget ?? Number(process.env.WHATSAPP_SEMANTIC_MEMORY_DAILY_BUDGET ?? 200);
  const budget = Number.isFinite(requestedBudget)
    ? Math.max(1, Math.min(10000, Math.trunc(requestedBudget)))
    : 200;
  const claims = Claims.parse(await store.claim(provider, limit, budget));
  let vectors: number[][] | null = null;
  if (claims.length) {
    try {
      vectors = z
        .array(Vector)
        .length(claims.length)
        .parse(
          await (deps.embed ?? embedPrivateMemory)(
            claims.map((c) => c.user_text),
            "index",
          ),
        );
    } catch {
      vectors = null;
    }
  }
  const result = {
    enabled: true as const,
    claimed: claims.length,
    indexed: 0,
    failed: 0,
    discarded: 0,
  };
  for (let i = 0; i < claims.length; i++) {
    try {
      const saved = await store.finish(claims[i], provider, vectors?.[i] ?? null);
      if (!saved) result.discarded++;
      else if (vectors) result.indexed++;
      else result.failed++;
    } catch {
      result.failed++;
    } // Lease recovery is bounded; never log the claim or provider error.
  }
  return result;
}
