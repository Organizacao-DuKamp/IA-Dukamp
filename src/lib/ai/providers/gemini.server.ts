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
export const gemini: AIProvider = {
  id: "gemini",
  keyName: "GEMINI_API_KEY",
  supports: (r) =>
    !r.webRequired &&
    (r.attachments ?? []).reduce((n, a) => n + (a.base64?.length ?? 0), 0) < 19 * 1024 * 1024 &&
    (r.attachments ?? []).every(
      (a) =>
        !a.base64 ||
        /^(image\/(jpeg|png|webp)|video\/(mp4|webm)|application\/pdf)$/.test(a.mimeType),
    ),
  async generate(request, runtime) {
    const model = modelFor("gemini", request.mode, runtime.env),
      start = Date.now();
    const contents = messagesWithText(request).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }] as Record<string, unknown>[],
    }));
    const binary = (request.attachments ?? []).filter((a) => a.base64);
    if (binary.length)
      contents.push({
        role: "user",
        parts: binary.map((a) => ({ inlineData: { mimeType: a.mimeType, data: a.base64 } })),
      });
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": runtime.env.GEMINI_API_KEY! },
      {
        systemInstruction: { parts: [{ text: request.instructions }] },
        contents,
        generationConfig: { maxOutputTokens: request.maxOutputTokens ?? 4000 },
      },
      request,
      runtime,
    );
    const usage = record(data.usageMetadata),
      candidate = record(list(data.candidates)[0]);
    return {
      provider: "gemini",
      model: string(data.modelVersion) || model,
      text: checkedText(
        list(record(candidate.content).parts)
          .map((p) => string(record(p).text))
          .join("\n"),
      ),
      inputTokens: number(usage.promptTokenCount),
      outputTokens: number(usage.candidatesTokenCount) + number(usage.thoughtsTokenCount),
      cachedInputTokens: number(usage.cachedContentTokenCount),
      reasoningTokens: number(usage.thoughtsTokenCount),
      citations: [],
      latency: Date.now() - start,
    };
  },
};
