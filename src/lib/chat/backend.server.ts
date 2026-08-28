import { ChatCoreResultSchema, type ChatCoreResult, type ChatInput } from "./input.ts";
import { logDiagnostic, withDiagnosticContext } from "./diagnostics.server.ts";

type EnvLike = Record<string, string | undefined>;

type LocalBackendModule = {
  handleIncoming: (input: ChatInput) => Promise<ChatCoreResult>;
};

export interface TpecBackendDependencies {
  // Kept as optional dependency-injection fields for server-function callers.
  // The standalone runtime never reads an external backend configuration.
  env?: EnvLike;
  fetchImpl?: typeof fetch;
  loadLocalBackend?: () => Promise<LocalBackendModule>;
  now?: () => number;
}

export interface BackendDispatchResult {
  status: number;
  body: unknown;
}

export class TpecBackendError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TpecBackendError";
    this.status = status;
    this.code = code;
  }
}

function traceContext(input: ChatInput) {
  return {
    traceId: (input.clientMessageId || input.conversationId || input.sessionId || "unknown").slice(
      0,
      128,
    ),
    conversationId: (input.conversationId || input.sessionId || "unknown").slice(0, 128),
  };
}

export async function executeLocalChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  return withDiagnosticContext(traceContext(input), async () => {
    const started = (deps.now ?? Date.now)();
    const load =
      deps.loadLocalBackend ?? (() => import("./core.server.ts") as Promise<LocalBackendModule>);
    logDiagnostic("info", "backend.standalone.start", {
      history_messages: input.history.length,
      text_chars: input.text.length,
    });
    const local = await load();
    try {
      const result = ChatCoreResultSchema.parse(await local.handleIncoming(input));
      logDiagnostic("info", "backend.standalone.finish", {
        status: 200,
        duration_ms: (deps.now ?? Date.now)() - started,
        reply_chars: result.reply.length,
      });
      return { status: 200, body: result };
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      logDiagnostic("error", "backend.standalone.error", {
        status: typeof status === "number" ? status : 500,
        error_name: error instanceof Error ? error.name : "unknown",
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: (deps.now ?? Date.now)() - started,
      });
      if (error instanceof Error && typeof status === "number") {
        return { status, body: { error: error.message } };
      }
      throw error;
    }
  });
}

/** Executes the complete TPEC-IA backend in the current Netlify runtime. */
export async function dispatchChat(
  input: ChatInput,
  deps: TpecBackendDependencies = {},
): Promise<BackendDispatchResult> {
  return executeLocalChat(input, deps);
}
