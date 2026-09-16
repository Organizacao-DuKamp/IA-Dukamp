import type { AIMode, ProviderId } from "./types.ts";

// Verified against official model catalogs on 2026-09-15. All IDs are overridable.
export const AI_MODELS: Record<ProviderId, Record<AIMode, string>> = {
  openai: { quick: "gpt-5.6-luna", base: "gpt-5.6-terra", deep_research: "gpt-5.6-sol" },
  gemini: {
    quick: "gemini-3.5-flash-lite",
    base: "gemini-3.8-flash",
    deep_research: "gemini-3.8-flash",
  },
  deepseek: {
    quick: "deepseek-v4-flash",
    base: "deepseek-v4-flash",
    deep_research: "deepseek-v4-pro",
  },
  perplexity: { quick: "sonar", base: "sonar-pro", deep_research: "sonar-deep-research" },
};
export function modelFor(
  provider: ProviderId,
  mode: AIMode,
  env: Record<string, string | undefined>,
): string {
  const suffix = { quick: "FAST", base: "BASE", deep_research: "ADVANCED" }[mode];
  const legacy =
    provider === "openai"
      ? env[`OPENAI_TPEC_${{ quick: "LUNA", base: "TERRA", deep_research: "SOL" }[mode]}_MODEL`]
      : undefined;
  return (
    env[`AI_${provider.toUpperCase()}_${suffix}_MODEL`]?.trim() ||
    legacy ||
    AI_MODELS[provider][mode]
  );
}
export function multimodelEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TPEC_MULTIMODEL_ENABLED === "true";
}
