import { persistAndroidSession } from "./android-session.ts";
import { installedPanel } from "./app-mode.ts";

/** Every panel response can change the HttpOnly cookie. Preserve request order so
 * a delayed refresh cannot restore an old cookie after logout or a fresh link. */
export function createPanelClient(
  fetchImpl: typeof fetch = fetch,
  installed: () => boolean = installedPanel,
  persistSession: (loggedOut?: boolean) => Promise<void> = persistAndroidSession,
) {
  let tail: Promise<unknown> = Promise.resolve();
  let mode: "installed" | "browser" | undefined;
  const exchanges = new Map<string, ReturnType<Response["json"]>>();
  return function api(method = "GET", body?: unknown) {
    const token =
      method === "POST" &&
      body &&
      typeof body === "object" &&
      "kind" in body &&
      body.kind === "link_exchange" &&
      "token" in body &&
      typeof body.token === "string"
        ? body.token
        : null;
    const existing = token ? exchanges.get(token) : null;
    if (existing) return existing;
    const task = tail.then(async () => {
      // Resolve lazily in the browser and keep exchange/read/logout in the same
      // session mode even if native bridge detection changes during startup.
      mode ??= installed() ? "installed" : "browser";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const result = await fetchImpl("/api/public/farm-panel", {
          method,
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-tpec-panel": "1",
            "x-tpec-panel-mode": mode,
            ...(body && typeof body === "object" && "kind" in body && body.kind === "logout_all"
              ? { "x-tpec-panel-all": "1" }
              : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await result.json();
        if (!result.ok)
          throw Object.assign(new Error(data.error ?? "Não foi possível acessar o painel."), {
            status: result.status,
          });
        clearTimeout(timer);
        if (token || method === "DELETE") await persistSession(method === "DELETE");
        return data;
      } catch (error) {
        if (controller.signal.aborted)
          throw new Error(
            "A conexão demorou para responder. Confira sua internet e tente novamente.",
          );
        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
    tail = task.then(
      () => undefined,
      () => undefined,
    );
    if (token) {
      exchanges.set(token, task);
      const forget = () => {
        exchanges.delete(token);
      };
      void task.then(forget, forget);
    }
    return task;
  };
}
