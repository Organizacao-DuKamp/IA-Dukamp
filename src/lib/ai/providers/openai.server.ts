import type { AIProvider } from "../types.ts";
import { modelFor } from "../config.server.ts";
import {
  post,
  record,
  list,
  string,
  number,
  checkedText,
  normalizeCitations,
  messagesWithText,
} from "./shared.server.ts";
export const openai: AIProvider = {
  id: "openai",
  keyName: "OPENAI_API_KEY",
  supports: (r) =>
    (r.attachments ?? []).every(
      (a) => !a.base64 || /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(a.mimeType),
    ),
  async generate(request, runtime) {
    const model = modelFor("openai", request.mode, runtime.env),
      start = Date.now();
    const input: Record<string, unknown>[] = messagesWithText(request);
    const binary = (request.attachments ?? []).filter((a) => a.base64);
    if (binary.length)
      input.push({
        role: "user",
        content: binary.map((a) =>
          a.mimeType === "application/pdf"
            ? {
                type: "input_file",
                filename: a.name ?? "document.pdf",
                file_data: `data:${a.mimeType};base64,${a.base64}`,
              }
            : {
                type: "input_image",
                image_url: `data:${a.mimeType};base64,${a.base64}`,
                detail: "auto",
              },
        ),
      });
    const body: Record<string, unknown> = {
      model,
      instructions: request.instructions,
      input,
      store: false,
      max_output_tokens: request.maxOutputTokens ?? 4000,
    };
    if (request.webRequired) {
      body.tools = [{ type: "web_search" }];
      body.tool_choice = "required";
      body.max_tool_calls = 2;
      body.include = ["web_search_call.action.sources"];
    }
    const data = await post(
      "https://api.openai.com/v1/responses",
      { authorization: `Bearer ${runtime.env.OPENAI_API_KEY}` },
      body,
      request,
      runtime,
    );
    const output = list(data.output).map(record),
      parts = output.flatMap((o) => list(o.content).map(record));
    const annotations = parts
      .flatMap((p) => list(p.annotations).map(record))
      .filter((a) => a.type === "url_citation");
    const usage = record(data.usage);
    return {
      provider: "openai",
      model: string(data.model) || model,
      text: checkedText(
        data.output_text ||
          parts
            .filter((p) => p.type === "output_text")
            .map((p) => string(p.text))
            .join("\n"),
      ),
      inputTokens: number(usage.input_tokens),
      outputTokens: number(usage.output_tokens),
      cachedInputTokens: number(record(usage.input_tokens_details).cached_tokens),
      reasoningTokens: number(record(usage.output_tokens_details).reasoning_tokens),
      citations: normalizeCitations(
        annotations.map((a) => a.url),
        annotations,
      ),
      latency: Date.now() - start,
      webSearchCalls: output.filter((o) => o.type === "web_search_call").length,
    };
  },
};
