import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../integrations/supabase/types";

/** Same database and credentials as the existing server client. Only bulk admin I/O gets a longer deadline. */
export async function duKampIngestionClient(fallback: unknown) {
  const url = process.env.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const { getPrivilegedClient } = await import("../privileged.server");
    return getPrivilegedClient(fallback);
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (
          /^sb_(?:publishable|secret)_/.test(key) &&
          headers.get("authorization") === `Bearer ${key}`
        )
          headers.delete("authorization");
        headers.set("apikey", key);
        return fetch(input, {
          ...init,
          headers,
          signal: AbortSignal.any([
            AbortSignal.timeout(20_000),
            ...(init?.signal ? [init.signal] : []),
          ]),
        });
      },
    },
  });
}
