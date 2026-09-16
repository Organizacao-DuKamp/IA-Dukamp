import { askOpenAI, type OpenAIOptions } from "../chat/openai.server";
import type { ChatMessage } from "../chat/types.ts";
import { multimodelEnabled } from "./config.server.ts";
import { orchestrateAI } from "./orchestrator.server.ts";
import { selectAdaptiveModelRoute } from "../chat/model-router.ts";
export async function askTpecAI(
  history: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  if (!multimodelEnabled()) return askOpenAI(history, options);
  const tier = selectAdaptiveModelRoute(history, options).tier;
  const result = await orchestrateAI(
    {
      message: [...history].reverse().find((m) => m.role === "user")?.content ?? "",
      messages: history,
      conversationContext: options.context ?? "",
      context: options.context,
      summary: options.summary,
      state: options.state,
      directive: options.directive,
      sourcePolicy: options.sourcePolicy,
      mode:
        options.researchDepth === "high"
          ? "deep_research"
          : options.model === "fast" || options.model === "luna" || tier === "luna"
            ? "quick"
            : "base",
      webRequired: options.researchDepth === "medium" || options.researchDepth === "high",
      prohibitWeb: options.researchDepth === "none",
      stage: options.stage,
    },
    { fetchImpl: options.fetchImpl },
  );
  return result.text;
}
