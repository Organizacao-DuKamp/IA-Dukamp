import {
  ChatInputSchema,
  MAX_CHAT_PROXY_BODY_BYTES,
  type ChatInput,
} from "./input";
import {
  TpecBackendError,
  dispatchChat,
  executeLocalChat,
  resolveTpecBackendMode,
  type TpecBackendDependencies,
} from "./backend.server";

type EnvLike = Record<string, string | undefined>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function parseInput(request: Request): Promise<ChatInput> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CHAT_PROXY_BODY_BYTES) {
    throw new TpecBackendError(
      "Requisição excedeu o limite permitido.",
      413,
      "request_too_large",
    );
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_CHAT_PROXY_BODY_BYTES) {
    throw new TpecBackendError(
      "Requisição excedeu o limite permitido.",
      413,
      "request_too_large",
    );
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

/** Rota pública usada pelo navegador. Não encaminha headers/cookies do usuário. */
export async function handlePublicChatRequest(
  request: Request,
  deps: TpecBackendDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // Uma requisição já marcada como salto interno não pode entrar novamente no proxy público.
  if (request.headers.has("x-tpec-proxy-hop")) {
    return json({ error: "proxy_loop_rejected" }, 508);
  }
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
      // Mantém o contrato já consumido pelo WebChatAdapter: estado opaco em string.
      return json(
        {
          reply: body.reply,
          state: JSON.stringify(body.state),
          conversationId: body.conversationId,
        },
        result.status,
      );
    }
    return json(result.body, result.status);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Endpoint protegido executado somente no Lovable em modo local. */
export async function handleInternalChatRequest(
  request: Request,
  deps: TpecBackendDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "not_found" }, 404);
  const env: EnvLike = deps.env ?? process.env;
  let mode;
  try {
    mode = resolveTpecBackendMode(env);
  } catch (error) {
    return errorResponse(error);
  }
  if (mode !== "local") return json({ error: "not_found" }, 404);

  const expected = env.TPEC_PROXY_SECRET?.trim() ?? "";
  const provided = request.headers.get("x-tpec-proxy-secret")?.trim() ?? "";
  const hop = request.headers.get("x-tpec-proxy-hop") ?? "";
  if (!expected || expected.length < 32 || !provided || !safeEqual(expected, provided)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (hop !== "1") return json({ error: "invalid_proxy_hop" }, 400);

  try {
    const input = await parseInput(request);
    const result = await executeLocalChat(input, deps);
    // Resposta interna mantém o ChatResult completo, inclusive diagnostics.
    return json(result.body, result.status);
  } catch (error) {
    return errorResponse(error);
  }
}
