import type { AIProvider, ProviderId } from "./types.ts";
import { openai } from "./providers/openai.server.ts";
import { gemini } from "./providers/gemini.server.ts";
import { deepseek } from "./providers/deepseek.server.ts";
import { perplexity } from "./providers/perplexity.server.ts";
export function createProviderRegistry(
  initial: AIProvider[] = [openai, gemini, deepseek, perplexity],
) {
  const providers = new Map<ProviderId, AIProvider>();
  const registerProvider = (provider: AIProvider) => providers.set(provider.id, provider);
  initial.forEach(registerProvider);
  return {
    registerProvider,
    get: (id: ProviderId) => providers.get(id),
    values: () => providers.values(),
  };
}
