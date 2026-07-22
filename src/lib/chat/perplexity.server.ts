// Perplexity AI Service — the ONLY module that talks to the Perplexity API.
// Reads PERPLEXITY_API_KEY from process.env inside the call (never at module scope,
// never sent to the client, never logged).

import type { ChatMessage } from "./types";
import { TPEC_SYSTEM_PROMPT } from "./system-prompt";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar";
const TIMEOUT_MS = 30_000;

export class PerplexityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function askPerplexity(
  history: ChatMessage[],
  context?: string,
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    // Do not include the variable name in the client-facing error.
    throw new PerplexityError("Serviço de IA indisponível no momento.", 500);
  }

  const systemContent = context
    ? `${TPEC_SYSTEM_PROMPT}\n\n===== BASE DE CONHECIMENTO INTERNA =====\nUse PRIORITARIAMENTE os trechos abaixo (extraídos de documentos técnicos da propriedade) para responder. Se a resposta estiver neles, cite entre parênteses a fonte no formato (Fonte: <título>). Se os trechos não contiverem a resposta, diga isso explicitamente e complemente com conhecimento geral, deixando claro que é conhecimento externo.\n\n${context}\n===== FIM DA BASE =====`
    : TPEC_SYSTEM_PROMPT;

  const messages = [
    { role: "system" as const, content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new PerplexityError("A IA demorou demais para responder. Tente novamente.", 504);
    }
    throw new PerplexityError("Não foi possível contatar o serviço de IA.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401 && body.includes("insufficient_quota")) {
      throw new PerplexityError(
        "Os créditos da API da Perplexity estão esgotados. Adicione créditos em console.perplexity.ai.",
        402,
      );
    }
    if (response.status === 429) {
      throw new PerplexityError("Muitas requisições. Aguarde alguns segundos.", 429);
    }
    throw new PerplexityError("Falha ao consultar a IA.", response.status);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new PerplexityError("Resposta vazia da IA.", 502);
  return text;
}
