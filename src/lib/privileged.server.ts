import { AsyncLocalStorage } from "node:async_hooks";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

type PrivilegedClient = typeof SupabaseAdmin;

const requestClient = new AsyncLocalStorage<PrivilegedClient>();
let asyncContextUnavailableLogged = false;

function isUnsupportedAsyncContextError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not implemented/i.test(message);
}

function rememberRequestClient(client: PrivilegedClient): void {
  try {
    requestClient.enterWith(client);
  } catch (error) {
    // Alguns runtimes edge/Cloud expõem AsyncLocalStorage como stub e lançam
    // "enterWith() is not implemented". O cache é apenas uma otimização;
    // sem ele, os chamadores continuam podendo usar o cliente retornado.
    if (!isUnsupportedAsyncContextError(error)) throw error;
    if (!asyncContextUnavailableLogged) {
      asyncContextUnavailableLogged = true;
      console.warn(
        "[privileged] runtime sem suporte a AsyncLocalStorage.enterWith; seguindo sem cache por requisição",
      );
    }
  }
}

export function hasServiceRole(): boolean {
  return Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export function getRequestPrivilegedClient(): PrivilegedClient | undefined {
  try {
    return requestClient.getStore();
  } catch (error) {
    if (isUnsupportedAsyncContextError(error)) return undefined;
    throw error;
  }
}

export async function getPrivilegedClient(fallback: unknown): Promise<PrivilegedClient> {
  let client: PrivilegedClient;

  if (hasServiceRole()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      client = supabaseAdmin;
      rememberRequestClient(client);
      return client;
    } catch (err) {
      console.warn("[privileged] cliente de serviço indisponível; usando sessão autenticada", err);
    }
  }

  if (!fallback) {
    throw new Error(
      "Cliente privilegiado indisponível. Configure a chave de serviço ou execute a operação em uma sessão administrativa autenticada.",
    );
  }

  client = fallback as PrivilegedClient;
  rememberRequestClient(client);
  return client;
}
