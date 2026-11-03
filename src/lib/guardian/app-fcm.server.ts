import { createHash, createSign } from "node:crypto";

type Env = Record<string, string | undefined>;
export function appPushConfigured(env: Env = process.env) {
  return ["TPEC_FCM_PROJECT_ID", "TPEC_FCM_CLIENT_EMAIL", "TPEC_FCM_PRIVATE_KEY"].every((key) =>
    Boolean(env[key]?.trim()),
  );
}
let cached: { key: string; token: string; until: number } | undefined;
export type AppPushResult = "sent" | "unregistered" | "retry";
export async function sendAppPush(
  input: { token: string; kind: "sync" | "reminder" },
  deps: { env?: Env; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<AppPushResult> {
  const env = deps.env ?? process.env;
  if (!appPushConfigured(env)) return "retry";
  const fetchImpl = deps.fetchImpl ?? fetch,
    now = deps.now ?? Date.now();
  const project = env.TPEC_FCM_PROJECT_ID!.trim();
  if (!/^[a-z0-9][a-z0-9-]{3,100}$/.test(project)) return "retry";
  const email = env.TPEC_FCM_CLIENT_EMAIL!.trim();
  const privateKey = env.TPEC_FCM_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const cacheKey = createHash("sha256")
    .update(project + email + privateKey)
    .digest("hex");
  try {
    let token = cached?.key === cacheKey && cached.until > now ? cached.token : null;
    if (!token) {
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const seconds = Math.floor(now / 1000);
      const unsigned =
        encode({ alg: "RS256", typ: "JWT" }) +
        "." +
        encode({
          iss: email,
          scope: "https://www.googleapis.com/auth/firebase.messaging",
          aud: "https://oauth2.googleapis.com/token",
          iat: seconds,
          exp: seconds + 3600,
        });
      const assertion =
        unsigned + "." + createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
      const auth = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      if (!auth.ok) return "retry";
      const data = await auth.json();
      if (typeof data.access_token !== "string" || !data.access_token) return "retry";
      token = data.access_token;
      cached = {
        key: cacheKey,
        token: token!,
        until: now + Math.min(Number(data.expires_in) || 300, 3500) * 1000,
      };
    }
    const response = await fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${project}/messages:send`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        // Push contains no farm data; the device fetches only after fresh authorization.
        body: JSON.stringify({
          message: {
            token: input.token,
            data: { kind: input.kind, app: "tpec-farm" },
            android: {
              priority: input.kind === "reminder" ? "HIGH" : "NORMAL",
              ttl: "300s",
              ...(input.kind === "sync" ? { collapse_key: "farm-reminders" } : {}),
            },
          },
        }),
      },
    );
    if (response.ok) return "sent";
    if (response.status === 401) cached = undefined;
    const error = await response.json().catch(() => null);
    return error?.error?.details?.some(
      (item: { errorCode?: string }) => item.errorCode === "UNREGISTERED",
    )
      ? "unregistered"
      : "retry";
  } catch {
    return "retry";
  }
}
