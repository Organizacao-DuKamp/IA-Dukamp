import { isAbsolute } from "node:path";

type Env = Record<string, string | undefined>;
export function configurationErrors(env: Env, build = false): string[] {
  const required = build
    ? ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PROJECT_ID"]
    : [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_PUBLISHABLE_KEY",
        "OPENAI_API_KEY",
        "WHATSAPP_APP_SECRET",
        "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "PUBLIC_ORIGIN",
        "TPEC_WORKER_TOKEN",
        "TPEC_DATA_DIR",
      ];
  if (!build && env.TPEC_MULTIMODEL_ENABLED === "true")
    required.push("GEMINI_API_KEY", "DEEPSEEK_API_KEY", "PERPLEXITY_API_KEY");
  const errors = required.filter((key) => !env[key]?.trim());
  const checkUrl = (key: string) => {
    if (!env[key]) return;
    try {
      const u = new URL(env[key]!);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash
      )
        errors.push(`${key}:https_origin_required`);
    } catch {
      errors.push(`${key}:invalid_url`);
    }
  };
  checkUrl(build ? "VITE_SUPABASE_URL" : "SUPABASE_URL");
  if (build && /^(sb_secret_|eyJ)/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")) {
    // Legacy anon JWTs are allowed only when their decoded role is anon.
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    try {
      if (
        key.startsWith("sb_secret_") ||
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role !== "anon"
      )
        errors.push("VITE_SUPABASE_PUBLISHABLE_KEY:public_key_required");
    } catch {
      errors.push("VITE_SUPABASE_PUBLISHABLE_KEY:public_key_required");
    }
  }
  if (!build) {
    checkUrl("PUBLIC_ORIGIN");
    if (env.TPEC_WORKER_TOKEN && env.TPEC_WORKER_TOKEN.length < 32)
      errors.push("TPEC_WORKER_TOKEN:min_32_characters");
    if (env.TPEC_DATA_DIR && !isAbsolute(env.TPEC_DATA_DIR))
      errors.push("TPEC_DATA_DIR:absolute_path_required");
    if (env.WHATSAPP_STATE_STORE === "memory") errors.push("WHATSAPP_STATE_STORE:durable_required");
    const fcm = ["TPEC_FCM_PROJECT_ID", "TPEC_FCM_CLIENT_EMAIL", "TPEC_FCM_PRIVATE_KEY"];
    if (fcm.some((key) => env[key]?.trim())) errors.push(...fcm.filter((key) => !env[key]?.trim()));
    if (env.TPEC_GUARDIAN_ENABLED === "true") {
      if (
        !env.TPEC_ANDROID_SHA256_CERT_FINGERPRINTS?.split(",").every((v) =>
          /^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(v.trim()),
        )
      )
        errors.push("TPEC_ANDROID_SHA256_CERT_FINGERPRINTS:required_for_android");
    }
  }
  return errors;
}

export function assertConfiguration(env: Env = process.env, build = false) {
  const errors = configurationErrors(env, build);
  if (errors.length) throw new Error(`Invalid configuration: ${errors.join(", ")}`);
}

export function selfHosted(env: Env = process.env) {
  return env.TPEC_RUNTIME === "node";
}
