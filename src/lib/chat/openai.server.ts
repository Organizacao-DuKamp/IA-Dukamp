import type { ChatMessage } from "./types";
import { TPEC_SYSTEM_PROMPT } from "./system-prompt";
const ENDPOINT = "https://api.openai.com/v1/responses";
export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export interface OpenAIOptions {
  model?: "fast" | "capable";
  context?: string | null;
  timeoutMs?: number;
}
export function openAIModel(kind: "fast" | "capable" = "capable"): string {
  return kind === "fast"
    ? process.env.OPENAI_FAST_MODEL || "gpt-5-mini"
    : process.env.OPENAI_CAPABLE_MODEL || "gpt-5";
}
export async function askOpenAI(
  history: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAIError("Serviço de IA indisponível no momento.", 500);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: openAIModel(options.model),
        instructions: `${TPEC_SYSTEM_PROMPT}\n\n${options.context ?? ""}`,
        input: history
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: [{ type: "input_text", text: m.content }] })),
        max_output_tokens: 1200,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new OpenAIError("Falha ao consultar a IA.", response.status);
    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text =
      data.output_text?.trim() ||
      data.output
        ?.flatMap((o) => o.content ?? [])
        .find((c) => c.type === "output_text")
        ?.text?.trim();
    if (!text) throw new OpenAIError("Resposta vazia da IA.", 502);
    return text;
  } catch (error) {
    if (error instanceof OpenAIError) throw error;
    if ((error as Error).name === "AbortError")
      throw new OpenAIError("A IA demorou demais para responder.", 504);
    throw new OpenAIError("Não foi possível contatar o serviço de IA.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
