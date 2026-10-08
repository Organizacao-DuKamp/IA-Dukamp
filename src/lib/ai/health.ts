import type { ProviderId } from "./types.ts";

export const HEALTH_PROVIDERS: { id: ProviderId; name: string; billingUrl: string }[] = [
  {
    id: "openai",
    name: "OpenAI",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
  },
  { id: "gemini", name: "Google Gemini", billingUrl: "https://aistudio.google.com/usage" },
  { id: "deepseek", name: "DeepSeek", billingUrl: "https://platform.deepseek.com/" },
  { id: "perplexity", name: "Perplexity", billingUrl: "https://www.perplexity.ai/account/api" },
];
export type HealthStatus =
  | "operational"
  | "balance_available"
  | "no_credits"
  | "billing_limit"
  | "quota_limited"
  | "invalid_key"
  | "not_configured"
  | "configuration_error"
  | "unavailable";
export interface ProviderHealth {
  provider: ProviderId;
  model: string | null;
  status: HealthStatus;
  message: string;
  balances: { currency: "USD" | "CNY"; amount: number }[];
  method: "balance" | "minimal_request";
  checkedAt: string;
}
export interface HealthReport {
  providers: ProviderHealth[];
  cached: boolean;
  nextCheckAt: string;
  multimodelEnabled: boolean;
}
export const HEALTH_LABELS: Record<HealthStatus, string> = {
  operational: "Operante",
  balance_available: "Saldo disponível",
  no_credits: "Sem créditos — recarregar",
  billing_limit: "Limite de cobrança",
  quota_limited: "Limite de uso atingido",
  invalid_key: "Chave inválida ou sem permissão",
  not_configured: "Não configurada",
  configuration_error: "Revisar configuração",
  unavailable: "Indisponível neste teste",
};
