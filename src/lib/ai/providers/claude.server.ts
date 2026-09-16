import type { AIProvider } from "../types.ts";
import { modelFor } from "../config.server.ts";
import {
  post,
  record,
  list,
  string,
  number,
  checkedText,
  messagesWithText,
} from "./shared.server.ts";
export const claude: AIProvider = {
  id: "claude",
  keyName: "ANTHROPIC_API_KEY",
  supports: (r) =>
    !r.webRequired &&
    (r.attachments ?? []).every(
      (a) => !a.base64 || /^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(a.mimeType),
    ),
  async generate(request, runtime) {
    const model = modelFor("claude", request.mode, runtime.env),
      start = Date.now();
    const messages = messagesWithText(request).map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }] as Record<string, unknown>[],
    }));
    const binary = (request.attachments ?? []).filter((a) => a.base64);
    if (binary.length)
      messages.push({
        role: "user",
        content: binary.map((a) => ({
          type: a.mimeType === "application/pdf" ? "document" : "image",
          source: { type: "base64", media_type: a.mimeType, data: a.base64 },
        })),
      });
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": runtime.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      {
        model,
        system: request.instructions,
        messages,
        max_tokens: request.maxOutputTokens ?? 4000,
      },
      request,
      runtime,
    );
    const usage = record(data.usage);
    return {
      provider: "claude",
      model: string(data.model) || model,
      text: checkedText(
        list(data.content)
          .filter((p) => record(p).type === "text")
          .map((p) => string(record(p).text))
          .join("\n"),
      ),
      inputTokens:
        number(usage.input_tokens) +
        number(usage.cache_read_input_tokens) +
        number(usage.cache_creation_input_tokens),
      outputTokens: number(usage.output_tokens),
      cachedInputTokens: number(usage.cache_read_input_tokens),
      citations: [],
      latency: Date.now() - start,
    };
  },
};
