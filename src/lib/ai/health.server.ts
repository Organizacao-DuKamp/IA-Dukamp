import { createHash } from "node:crypto";
import { modelFor, multimodelEnabled } from "./config.server.ts";
import {
  HEALTH_PROVIDERS,
  type HealthReport,
  type ProviderHealth,
  type HealthStatus,
} from "./health.ts";
import type { ProviderId } from "./types.ts";

const KEY_NAMES: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};
const CACHE_MS = 5 * 60_000;
const TIMEOUT_MS = 12_000;
const PROMPT = "Reply OK.";
type Env = Record<string, string | undefined>;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// Only fixed diagnostic messages leave the server. Never return provider bodies,
// headers, keys or the generated text (providers may echo credentials in errors).
export function classifyHealthError(
  provider: ProviderId,
  status: number,
  body: unknown,
): HealthStatus {
  const error = record(record(body).error);
  const code = String(error.code ?? "").toLowerCase();
  const type = String(error.type ?? error.status ?? "").toLowerCase();
  const message = String(error.message ?? record(body).message ?? "").toLowerCase();
  if (/api_key_invalid|invalid_api_key/.test(code)) return "invalid_key";
  if (
    /organization_spend_limit_exceeded|project_spend_limit_exceeded|organization_usage_limit_exceeded/.test(
      code,
    )
  )
    return "billing_limit";
  if (
    status === 402 ||
    /^(credit_balance_exhausted|insufficient_balance|insufficient_credits)$/.test(code) ||
    /insufficient (?:credits|balance)|credit balance (?:is )?(?:exhausted|depleted)|out of credits/.test(
      message,
    )
  )
    return "no_credits";
  // Perplexity documents 401 for BOTH invalid keys and exhausted API credits.
  if (provider === "perplexity" && status === 401) return "billing_limit";
  if (status === 401 || status === 403) return "invalid_key";
  // insufficient_quota is ambiguous: prepaid balance OR enforced spending limit.
  if (code === "insufficient_quota" || type === "insufficient_quota") return "billing_limit";
  if (status === 429 || (provider === "gemini" && type === "resource_exhausted"))
    return "quota_limited";
  if (status === 400 || status === 404 || status === 422) return "configuration_error";
  return "unavailable";
}
const MESSAGES: Record<HealthStatus, string> = {
  operational:
    "A API aceitou o teste mínimo do modelo indicado. Saldo restante não informado por esta API.",
  balance_available:
    "A conta tem saldo para chamadas. Consulta sem geração de texto; não testa os modelos individualmente.",
  no_credits: "Créditos insuficientes. Recarregue a conta no painel do provedor.",
  billing_limit:
    "Verifique créditos da API, limites de cobrança e a chave do projeto no provedor. A resposta não confirma saldo zerado nem chave inválida.",
  quota_limited:
    "Limite de requisições ou cota atingido. Isso não confirma falta de créditos; confira os limites do provedor.",
  invalid_key: "Revise a chave, as permissões e as restrições de acesso no ambiente do servidor.",
  not_configured: "A chave deste provedor não está configurada no servidor.",
  configuration_error:
    "O modelo ou os parâmetros do teste não estão disponíveis para esta conta. Confira a configuração.",
  unavailable:
    "Não foi possível confirmar disponibilidade (rede, timeout, erro do provedor ou resposta inesperada).",
};

// Match known fields internally; never expose the actual provider error payload.
export function healthErrorDetail(status: number, body: unknown): string {
  const error = record(record(body).error);
  const text = JSON.stringify({ error, detail: record(body).detail }).toLowerCase();
  const fields = ["max_tokens", "disable_search", "model"].filter((field) => text.includes(field));
  return ` HTTP ${status}.${fields.length ? ` Verifique: ${fields.join(", ")}.` : ""}`;
}

export async function checkProviderHealth(
  provider: ProviderId,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderHealth> {
  const model = provider === "deepseek" ? null : modelFor(provider, "quick", env);
  const base = {
    provider,
    model,
    method: provider === "deepseek" ? ("balance" as const) : ("minimal_request" as const),
  };
  const result = (
    status: HealthStatus,
    balances: ProviderHealth["balances"] = [],
  ): ProviderHealth => ({
    ...base,
    status,
    message: MESSAGES[status],
    balances,
    checkedAt: new Date().toISOString(),
  });
  const key = env[KEY_NAMES[provider]]?.trim();
  if (!key) return result("not_configured");
  let url: string;
  let body: unknown;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (provider === "deepseek") {
    url = "https://api.deepseek.com/user/balance";
    headers.authorization = `Bearer ${key}`;
  } else if (provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.authorization = `Bearer ${key}`;
    body = { model, input: PROMPT, max_output_tokens: 16, store: false };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model!)}:generateContent`;
    headers["x-goog-api-key"] = key;
    body = { contents: [{ parts: [{ text: PROMPT }] }], generationConfig: { maxOutputTokens: 1 } };
  } else {
    url = "https://api.perplexity.ai/chat/completions";
    headers.authorization = `Bearer ${key}`;
    body = {
      model,
      messages: [{ role: "user", content: PROMPT }],
      max_tokens: 1,
      stream: false,
      disable_search: true,
    };
  }
  try {
    const response = await fetchImpl(url, {
      method: body ? "POST" : "GET",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
    });
    const data = record(await response.json().catch(() => null));
    if (!response.ok || data.error || data.status === "failed") {
      const failure = result(classifyHealthError(provider, response.status, data));
      failure.message += healthErrorDetail(response.status, data);
      return failure;
    }
    if (provider === "deepseek") {
      if (typeof data.is_available !== "boolean" || !Array.isArray(data.balance_infos))
        return result("unavailable");
      const balances = data.balance_infos.flatMap((item) => {
        const value = record(item);
        if (
          (value.currency !== "USD" && value.currency !== "CNY") ||
          typeof value.total_balance !== "string" ||
          !value.total_balance.trim()
        )
          return [];
        const amount = Number(value.total_balance);
        return Number.isFinite(amount)
          ? [{ currency: value.currency as "USD" | "CNY", amount }]
          : [];
      });
      return result(data.is_available ? "balance_available" : "no_credits", balances);
    }
    // Truncation is expected with a one-token test; require a real inference
    // envelope, not just HTTP 200 (an empty response is not proof of operation).
    const valid =
      provider === "openai"
        ? (data.status === "completed" ||
            (data.status === "incomplete" &&
              record(data.incomplete_details).reason === "max_output_tokens")) &&
          Array.isArray(data.output)
        : provider === "gemini"
          ? Array.isArray(data.candidates) && data.candidates.length > 0
          : Array.isArray(data.choices) && data.choices.length > 0;
    return result(valid ? "operational" : "unavailable");
  } catch {
    return result("unavailable");
  }
}

// Share concurrent checks and recent results within a server instance. Hash
// configuration so rotating a key/model immediately invalidates cached results.
export function createHealthChecker() {
  let cache: { fingerprint: string; expires: number; pending: Promise<HealthReport> } | undefined;
  return async (
    env: Env = process.env,
    fetchImpl: typeof fetch = fetch,
    now = Date.now(),
  ): Promise<HealthReport> => {
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          HEALTH_PROVIDERS.map(({ id }) => [
            id,
            env[KEY_NAMES[id]],
            modelFor(id, "quick", env),
            multimodelEnabled(env),
          ]),
        ),
      )
      .digest("hex");
    if (cache && cache.fingerprint === fingerprint && now < cache.expires)
      return { ...(await cache.pending), cached: true };
    const expires = now + CACHE_MS;
    const pending = Promise.all(
      HEALTH_PROVIDERS.map(({ id }) => checkProviderHealth(id, env, fetchImpl)),
    ).then((providers) => ({
      providers,
      cached: false,
      nextCheckAt: new Date(expires).toISOString(),
      multimodelEnabled: multimodelEnabled(env),
    }));
    cache = { fingerprint, expires, pending };
    return pending;
  };
}
export const checkAIHealth = createHealthChecker();
