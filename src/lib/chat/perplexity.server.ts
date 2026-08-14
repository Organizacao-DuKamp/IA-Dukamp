// Perplexity AI Service — the ONLY module that talks to the Perplexity API.
// Reads PERPLEXITY_API_KEY from process.env inside the call (never at module scope,
// never sent to the client, never logged).

import type { ChatMessage } from "./types";
import { TPEC_SYSTEM_PROMPT } from "./system-prompt";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const TIMEOUT_MS = 30_000;
export function perplexityModel(): string {
  return process.env.PERPLEXITY_MODEL || "sonar";
}

export class PerplexityError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AskOptions {
  /** Resumo estruturado acumulado (JSON) — camada 4. */
  summary?: string | null;
  /** Estado atual da conversa (JSON) — camada 2. */
  state?: string | null;
  /** Como interpretar a mensagem atual (confirmação, correção, seleção…). */
  directive?: string | null;
  /** Ordem de fontes determinada pelo orquestrador após consultar os bancos. */
  sourcePolicy?: string | null;
  /** Trechos recuperados (RAG, site, mercado) — camada de menor prioridade. */
  context?: string | null;
  /** Força resultados recentes do Sonar quando a base não tem cotação corrente. */
  currentMarketSearch?: boolean;
}

export async function askPerplexity(
  history: ChatMessage[],
  options: AskOptions = {},
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    // Do not include the variable name in the client-facing error.
    console.error(
      `[tpec-ai] missing_ai_key: chave do provedor de IA ausente no ambiente deste servidor (${perplexityModel()}).`,
    );
    throw new PerplexityError("Serviço de IA indisponível no momento.", 500);
  }

  // Camadas de contexto, em ordem de prioridade decrescente. Cada camada é uma
  // mensagem `system` própria — nunca embutida em uma fala de usuário.
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: TPEC_SYSTEM_PROMPT },
  ];

  if (options.summary) {
    messages.push({
      role: "system",
      content: `RESUMO ESTRUTURADO DA CONVERSA (uso interno, nunca cite nem exiba este JSON):\n${options.summary}`,
    });
  }
  if (options.state) {
    messages.push({
      role: "system",
      content: `ESTADO ATUAL DA CONVERSA (uso interno, nunca cite nem exiba este JSON). Trate confirmed_data como fatos já informados pelo usuário; nunca peça novamente esses dados. Se awaiting_confirmation for true, a próxima mensagem curta do usuário responde a pending_question:\n${options.state}`,
    });
  }
  if (options.directive) {
    messages.push({
      role: "system",
      content: `INTERPRETAÇÃO OBRIGATÓRIA DA MENSAGEM ATUAL (uso interno, não cite):\n${options.directive}`,
    });
  }
  if (options.sourcePolicy) {
    messages.push({
      role: "system",
      content: options.sourcePolicy,
    });
  }
  if (options.context) {
    messages.push({
      role: "system",
      content: `===== INFORMAÇÕES RECUPERADAS (apoio, menor prioridade que o pedido atual e o estado da conversa) =====\nUse estes dados apenas quando forem relevantes para o pedido atual. Eles NÃO substituem o histórico, os dados confirmados nem a ação pendente; nunca resuma estes documentos por conta própria e nunca cite nomes de arquivos ou fontes internas.\n\n${options.context}\n===== FIM =====`,
    });
  }

  // Histórico recente, em ordem cronológica e com os papéis originais.
  for (const m of history) {
    if (!m?.content) continue;
    messages.push({ role: m.role === "system" ? "user" : m.role, content: m.content });
  }

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
        model: perplexityModel(),
        messages,
        temperature: 0.3,
        max_tokens: 900,
        ...(options.currentMarketSearch
          ? { search_mode: "web", search_recency_filter: "week" }
          : {}),
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
