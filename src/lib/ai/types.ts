import type { ChatMessage } from "../chat/types.ts";

export type ProviderId = "openai" | "gemini" | "deepseek" | "perplexity";
export type AIMode = "quick" | "base" | "deep_research";
export type RequestCategory =
  | "GENERAL"
  | "CALCULATION"
  | "WEB_SEARCH"
  | "DEEP_RESEARCH"
  | "IMAGE_ANALYSIS"
  | "DOCUMENT_ANALYSIS"
  | "LONG_CONTEXT"
  | "MULTI_STEP"
  | "FAST_SIMPLE";
export interface Citation {
  id: number;
  url: string;
  title: string;
  date?: string;
}
// Only server-owned, validated bytes. Never arbitrary URLs fetched on behalf of a client.
export interface AIAttachment {
  mimeType: string;
  base64?: string;
  text?: string;
  name?: string;
  sizeBytes?: number;
}
export interface AIRequest {
  messages: ChatMessage[];
  instructions: string;
  mode: AIMode;
  category: RequestCategory;
  attachments?: AIAttachment[];
  webRequired?: boolean;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}
export interface AIProviderResponse {
  text: string;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  cost?: number;
  citations: Citation[];
  latency: number;
  webSearchCalls?: number;
}
export interface ProviderRuntime {
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
}
export interface AIProvider {
  id: ProviderId;
  keyName: string;
  supports(request: AIRequest): boolean;
  generate(request: AIRequest, runtime: ProviderRuntime): Promise<AIProviderResponse>;
}
export class AIProviderError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 503) {
    super("Não foi possível concluir a solicitação da TPEC-IA. Tente novamente em instantes.");
    this.name = "AIProviderError";
    this.code = code;
    this.status = status;
  }
}
