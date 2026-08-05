import { AsyncLocalStorage } from "node:async_hooks";
import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

type PrivilegedClient = typeof SupabaseAdmin;

const requestClient = new AsyncLocalStorage<PrivilegedClient>();

export function hasServiceRole(): boolean {
  return Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export function getRequestPrivilegedClient(): PrivilegedClient | undefined {
  return requestClient.getStore();
}

export async function getPrivilegedClient(fallback: unknown): Promise<PrivilegedClient> {
  let client: PrivilegedClient;

  if (hasServiceRole()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      client = supabaseAdmin;
      requestClient.enterWith(client);
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
  requestClient.enterWith(client);
  return client;
}
