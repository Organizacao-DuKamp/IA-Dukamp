import { z } from "zod";
import { guardianDb } from "./store.server.ts";
import { APP_COOKIE, hashToken, panelStore, type PanelIdentity } from "./panel.server.ts";
import { appReminderSnapshot } from "./app-reminders.server.ts";
import { appPushConfigured, sendAppPush } from "./app-fcm.server.ts";

export interface AppDevice {
  id: string;
  token_hash: string;
  session_hash: string;
  property_id: string;
  phone_number: string;
  fcm_token: string | null;
  mode: "notification" | "alarm";
}
export interface AppDeviceStore {
  authorize(hash: string): Promise<PanelIdentity | null>;
  find(hash: string): Promise<AppDevice | null>;
  register(device: Omit<AppDevice, "id">): Promise<void>;
  remove(hash: string): Promise<void>;
  updateToken(hash: string, fcmToken: string): Promise<void>;
}
export const appDeviceStore: AppDeviceStore = {
  authorize: (hash) => panelStore.authorize(hash, true),
  async find(hash) {
    const { data, error } = await (await guardianDb())
      .from("guardian_app_devices")
      .select("id,token_hash,session_hash,property_id,phone_number,fcm_token,mode")
      .eq("token_hash", hash)
      .eq("enabled", true)
      .abortSignal(AbortSignal.timeout(5000))
      .maybeSingle();
    if (error) throw Error("app_device_unavailable");
    return data as AppDevice | null;
  },
  async register(device) {
    const { error } = await (
      await guardianDb()
    )
      .rpc("guardian_app_register", {
        p_token_hash: device.token_hash,
        p_session_hash: device.session_hash,
        p_fcm_token: device.fcm_token,
        p_mode: device.mode,
      })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw Error("app_registration_failed");
  },
  async remove(hash) {
    const { error } = await (await guardianDb())
      .from("guardian_app_devices")
      .delete()
      .eq("token_hash", hash)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw Error("app_device_unavailable");
  },
  async updateToken(hash, fcmToken) {
    const { error } = await (await guardianDb())
      .from("guardian_app_devices")
      .update({ fcm_token: fcmToken })
      .eq("token_hash", hash)
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw Error("app_device_unavailable");
  },
};
const Registration = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    fcmToken: z.string().trim().min(20).max(4096).nullable(),
    mode: z.enum(["notification", "alarm"]),
  })
  .strict();
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
export async function handleAppDevices(
  request: Request,
  deps: { store?: AppDeviceStore; enabled?: boolean; now?: Date; pushConfigured?: boolean } = {},
) {
  if (!(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true"))
    return json({ error: "Indisponível." }, 503);
  const store = deps.store ?? appDeviceStore;
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const deviceHash = bearer ? hashToken(bearer) : null;
  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method))
    return json({ error: "Método não permitido." }, 405);
  try {
    if (request.method === "POST") {
      if (
        request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("x-tpec-panel") !== "1" ||
        request.headers.get("x-tpec-panel-mode") !== "installed" ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        return json({ error: "Solicitação não autorizada." }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "Envie JSON." }, 415);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8192) return json({ error: "Solicitação muito grande." }, 413);
      const parsed = Registration.safeParse(JSON.parse(raw));
      if (!parsed.success) return json({ error: "Confira os dados." }, 400);
      const session = request.headers
        .get("cookie")
        ?.split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(APP_COOKIE + "="))
        ?.slice(APP_COOKIE.length + 1);
      const identity =
        session && /^[a-f0-9]{64}$/.test(session)
          ? await store.authorize(hashToken(session))
          : null;
      if (!identity) return json({ error: "Acesso expirado." }, 401);
      await store.register({
        token_hash: hashToken(parsed.data.token),
        session_hash: hashToken(session!),
        property_id: identity.propertyId,
        phone_number: identity.phone,
        fcm_token: parsed.data.fcmToken,
        mode: parsed.data.mode,
      });
      return json({
        ...appReminderSnapshot(identity, deps.now),
        mode: parsed.data.mode,
        pushConfigured: deps.pushConfigured ?? appPushConfigured(),
      });
    }
    const device = deviceHash ? await store.find(deviceHash) : null;
    if (!device) return json({ error: "Acesso expirado." }, 401);
    if (request.method === "DELETE") {
      await store.remove(deviceHash!);
      return json({ ok: true });
    }
    const identity = await store.authorize(device.session_hash);
    if (
      !identity ||
      identity.propertyId !== device.property_id ||
      identity.phone !== device.phone_number
    ) {
      await store.remove(deviceHash!);
      return json({ error: "Acesso revogado." }, 401);
    }
    if (request.method === "PUT") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ error: "Envie JSON." }, 415);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8192) return json({ error: "Solicitação muito grande." }, 413);
      const parsed = z
        .object({ fcmToken: z.string().trim().min(20).max(4096) })
        .strict()
        .safeParse(JSON.parse(raw));
      if (!parsed.success) return json({ error: "Confira os dados." }, 400);
      await store.updateToken(deviceHash!, parsed.data.fcmToken);
      return json({ ok: true });
    }
    return json({
      ...appReminderSnapshot(identity, deps.now),
      mode: device.mode,
      pushConfigured: deps.pushConfigured ?? appPushConfigured(),
    });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "JSON inválido." }, 400);
    return json({ error: "Não foi possível sincronizar seus lembretes. Tente novamente." }, 503);
  }
}
export interface AppPushJob {
  id: string;
  lock_token: string;
  fcm_token: string;
  kind: "sync" | "reminder";
}
export async function runAppPushMaintenance(
  deps: {
    configured?: boolean;
    claim?: () => Promise<AppPushJob[]>;
    begin?: (job: AppPushJob) => Promise<boolean>;
    finish?: (job: AppPushJob, result: string) => Promise<void>;
    send?: typeof sendAppPush;
  } = {},
) {
  if (!(deps.configured ?? appPushConfigured())) return { configured: false, sent: 0 };
  const claim =
    deps.claim ??
    (async () => {
      const { data, error } = await (
        await guardianDb()
      ).rpc("guardian_app_claim_pushes", { p_limit: 12 });
      if (error) throw Error("app_push_claim_failed");
      return data as AppPushJob[];
    });
  const begin =
    deps.begin ??
    (async (job) => {
      const { data, error } = await (
        await guardianDb()
      ).rpc("guardian_app_begin_push", { p_id: job.id, p_lock: job.lock_token });
      if (error) throw Error("app_push_authorization_failed");
      return data === true;
    });
  const finish =
    deps.finish ??
    (async (job, result) => {
      const { error } = await (
        await guardianDb()
      ).rpc("guardian_app_finish_push", { p_id: job.id, p_lock: job.lock_token, p_result: result });
      if (error) throw Error("app_push_receipt_failed");
    });
  let sent = 0;
  const jobs = await claim();
  for (let i = 0; i < jobs.length; i += 3)
    await Promise.all(
      jobs.slice(i, i + 3).map(async (job) => {
        if (!(await begin(job))) return;
        const result = await (deps.send ?? sendAppPush)({ token: job.fcm_token, kind: job.kind });
        await finish(job, result);
        if (result === "sent") sent++;
      }),
    );
  return { configured: true, sent };
}
