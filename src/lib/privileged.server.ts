// Escolhe o cliente privilegiado disponível no ambiente atual.
//
// Em ambientes onde SUPABASE_SERVICE_ROLE_KEY está presente (Lovable Cloud),
// usamos o cliente admin (bypass de RLS). Em ambientes onde essa chave não é
// injetada (ex.: deploy na Netlify), caímos para o cliente autenticado do
// próprio administrador, que já passou pela verificação `has_role('admin')` e
// opera sob RLS — evitando o erro "Missing Supabase environment variable(s)".

type AnyClient = {
  from: (table: never) => unknown;
  rpc?: unknown;
};

export function hasServiceRole(): boolean {
  return Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export async function getPrivilegedClient<T extends AnyClient>(fallback: T): Promise<T> {
  if (!hasServiceRole()) return fallback;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin as unknown as T;
  } catch {
    return fallback;
  }
}
