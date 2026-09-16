import { createClient } from "@supabase/supabase-js";
import { TpecBackendError } from "../chat/backend.server.ts";
export async function authenticatedChatUser(request: Request): Promise<string> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new TpecBackendError("Autenticação necessária.", 401, "unauthorized");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new TpecBackendError("Autenticação indisponível.", 503, "auth_not_configured");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new TpecBackendError("Sessão inválida.", 401, "unauthorized");
  return data.user.id;
}
