import { ChatInputSchema, MAX_CHAT_BODY_BYTES, type ChatInput } from "./input.ts";
import { TpecBackendError, dispatchChat, type TpecBackendDependencies } from "./backend.server.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function providerLabelFromDiagnostics(diagnostics: unknown): string | undefined {
  if (!diagnostics || typeof diagnostics !== "object") return undefined;

  const record = diagnostics as Record<string, unknown>;
  const model = typeof record.model === "string" ? record.model : "";
  const retrieved = Array.isArray(record.retrieved_blocks)
    ? record.retrieved_blocks.filter((value): value is string => typeof value === "string")
    : [];

  const directWithoutModel = new Set(["acknowledgement-stop", "small-talk", "sql-direto"]);
  const providers: string[] = [];

  if (model && !directWithoutModel.has(model)) providers.push("ChatGPT");
  if (retrieved.some((block) => block.startsWith("perplexity:"))) providers.push("Perplexity");
  if (retrieved.some((block) => block.startsWith("rag:"))) providers.push("RAG");

  return providers.length > 0 ? providers.join(" + ") : undefined;
}

async function parseInput(request: Request): Promise<ChatInput> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CHAT_BODY_BYTES) {
    throw new TpecBackendError("Requisição excedeu o limite permitido.", 413, "request_too_large");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_CHAT_BODY_BYTES) {
    throw new TpecBackendError("Requisição excedeu o limite permitido.", 413, "request_too_large");
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TpecBackendError("JSON inválido.", 400, "invalid_json");
  }
  const parsed = ChatInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new TpecBackendError("Dados do chat inválidos.", 400, "invalid_request");
  }
  return parsed.data;
}

function errorResponse(error: unknown): Response {
  if (error instanceof TpecBackendError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  console.error("[tpec-backend] unexpected failure");
  return json({ error: "Erro inesperado ao processar a mensagem." }, 500);
}

export async function handlePublicChatRequest(
  request: Request,
  deps: TpecBackendDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const input = await parseInput(request);
    const result = await dispatchChat(input, deps);
    if (result.status >= 200 && result.status < 300) {
      const body = result.body as {
        reply: string;
        state: unknown;
        conversationId: string;
        diagnostics?: unknown;
      };
      return json(
        {
          reply: body.reply,
          state: JSON.stringify(body.state),
          conversationId: body.conversationId,
          providerLabel: providerLabelFromDiagnostics(body.diagnostics),
        },
        result.status,
      );
    }
    return json(result.body, result.status);
  } catch (error) {
    return errorResponse(error);
  }
}
