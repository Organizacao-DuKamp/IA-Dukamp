import type { AIProvider } from "../types.ts";
import { modelFor } from "../config.server.ts";
import {
  post,
  record,
  list,
  number,
  string,
  checkedText,
  normalizeCitations,
} from "./shared.server.ts";
export const perplexity: AIProvider = {
  id: "perplexity",
  keyName: "PERPLEXITY_API_KEY",
  supports: (r) => !r.attachments?.length,
  async generate(request, runtime) {
    const model = modelFor("perplexity", request.mode, runtime.env),
      start = Date.now();
    const data = await post(
      "https://api.perplexity.ai/chat/completions",
      { authorization: `Bearer ${runtime.env.PERPLEXITY_API_KEY}` },
      {
        model,
        messages: [
          { role: "system", content: request.instructions },
          ...request.messages.filter((m) => m.role !== "system"),
        ],
        max_tokens: request.maxOutputTokens ?? 4000,
        stream: false,
      },
      request,
      runtime,
    );
    const usage = record(data.usage),
      cost = record(usage.cost).total_cost;
    return {
      provider: "perplexity",
      model: string(data.model) || model,
      text: checkedText(record(record(list(data.choices)[0]).message).content),
      inputTokens: number(usage.prompt_tokens),
      outputTokens: number(usage.completion_tokens),
      reasoningTokens: number(usage.reasoning_tokens),
      cost: typeof cost === "number" ? number(cost) : undefined,
      citations: normalizeCitations(list(data.citations), list(data.search_results)),
      latency: Date.now() - start,
      webSearchCalls: Math.max(1, number(usage.num_search_queries)),
    };
  },
};
