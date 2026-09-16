import type { AIProvider } from "../types.ts";
import { modelFor } from "../config.server.ts";
import {
  post,
  record,
  list,
  number,
  string,
  checkedText,
  textOnly,
  messagesWithText,
} from "./shared.server.ts";
export const deepseek: AIProvider = {
  id: "deepseek",
  keyName: "DEEPSEEK_API_KEY",
  supports: textOnly,
  async generate(request, runtime) {
    const model = modelFor("deepseek", request.mode, runtime.env),
      start = Date.now();
    const data = await post(
      "https://api.deepseek.com/chat/completions",
      { authorization: `Bearer ${runtime.env.DEEPSEEK_API_KEY}` },
      {
        model,
        messages: [{ role: "system", content: request.instructions }, ...messagesWithText(request)],
        max_tokens: request.maxOutputTokens ?? 4000,
        stream: false,
      },
      request,
      runtime,
    );
    const usage = record(data.usage);
    return {
      provider: "deepseek",
      model: string(data.model) || model,
      text: checkedText(record(record(list(data.choices)[0]).message).content),
      inputTokens: number(usage.prompt_tokens),
      outputTokens: number(usage.completion_tokens),
      cachedInputTokens: number(usage.prompt_cache_hit_tokens),
      citations: [],
      latency: Date.now() - start,
    };
  },
};
