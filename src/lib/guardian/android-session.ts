import { androidCommand, nativeAndroid } from "./android-bridge.ts";

/** Persist only the WebView's HttpOnly cookies. Never copy a credential to JS or
 * storage. Older APKs flush cookies in onPageFinished: one automatic navigation
 * after entry/logout reaches that existing native hook, without another link. */
export async function persistAndroidSession(loggedOut = false): Promise<void> {
  if (!nativeAndroid()) return;
  if (loggedOut) androidCommand({ type: "disconnect" });
  const requestId = crypto.randomUUID();
  const persisted = await new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      window.removeEventListener("tpec:session-persisted", acknowledged);
      resolve(ok);
    };
    const acknowledged = (event: Event) => {
      if ((event as CustomEvent<{ requestId?: string }>).detail?.requestId === requestId)
        finish(true);
    };
    const timer = setTimeout(() => finish(false), 500);
    window.addEventListener("tpec:session-persisted", acknowledged);
    try {
      androidCommand({ type: "persist_session", requestId });
    } catch {
      finish(false);
    }
  });
  if (persisted) return;
  // No token in the URL. This does not re-exchange a consumed login link.
  window.location.replace(window.location.pathname + window.location.search);
  await new Promise<never>(() => {}); // The next document restores the cookie.
}
