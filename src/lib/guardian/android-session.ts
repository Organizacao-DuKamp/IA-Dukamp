import { androidCommand, nativeAndroid } from "./android-bridge.ts";

/** The APK copies its HttpOnly cookie into encrypted native storage, then ACKs.
 * No credential crosses JS. Older APKs only flush the WebView cookie store;
 * their navigation fallback cannot guarantee persistence after process death. */
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
    const timer = setTimeout(() => finish(false), 5000);
    window.addEventListener("tpec:session-persisted", acknowledged);
    try {
      androidCommand({ type: "persist_session", requestId, loggedOut });
    } catch {
      finish(false);
    }
  });
  if (persisted) return;
  // No token in the URL. This does not re-exchange a consumed login link.
  window.location.replace(window.location.pathname + window.location.search);
  await new Promise<never>(() => {}); // The next document restores the cookie.
}
