// Run in the backend environment after configuring secrets; makes paid API calls.
// Logs only provider/model/status/tokens. Never logs prompts, responses or errors.
import { createProviderRegistry } from "../src/lib/ai/registry.server.ts";
import { AIProviderError } from "../src/lib/ai/types.ts";
const registry = createProviderRegistry();
let failed = false;
for (const provider of registry.values()) {
  if (!process.env[provider.keyName]) {
    console.log(JSON.stringify({ provider: provider.id, status: "missing_secret" }));
    failed = true;
    continue;
  }
  try {
    const result = await provider.generate(
      {
        messages: [
          {
            role: "user",
            content:
              provider.id === "perplexity"
                ? "Encontre uma fonte sobre ganho médio diário em bovinos e cite-a."
                : "Explique em uma frase o que é GMD em bovinos.",
          },
        ],
        instructions: "Você é a TPEC-IA, especialista em pecuária. Seja breve. Não invente fontes.",
        mode: "base",
        category: "GENERAL",
        webRequired: provider.id === "perplexity",
        maxOutputTokens: 1000,
        signal: AbortSignal.timeout(90000),
      },
      { env: process.env, fetchImpl: fetch },
    );
    if (provider.id === "perplexity" && !result.citations.length)
      throw new AIProviderError("missing_sources");
    console.log(
      JSON.stringify({
        provider: provider.id,
        model: result.model,
        status: "ok",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }),
    );
  } catch (error) {
    failed = true;
    console.log(
      JSON.stringify({
        provider: provider.id,
        status: "failed",
        code: error instanceof AIProviderError ? error.code : "provider_failure",
      }),
    );
  }
}
process.exitCode = failed ? 1 : 0;
