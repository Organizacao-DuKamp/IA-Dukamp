type EnvLike = Record<string, string | undefined>;

let warnedMemoryOverride = false;
let warnedMissingDurableStore = false;

/**
 * Produção pode atender o mesmo webhook em instâncias diferentes. Quando a
 * service role está disponível, nunca permita que um override antigo para
 * `memory` desative a idempotência compartilhada do WhatsApp.
 *
 * Em desenvolvimento a memória continua válida para testes e execução local.
 */
export function enforceDurableWhatsAppStateStore(
  env: EnvLike = process.env,
): "memory" | "supabase" {
  const production = env.NODE_ENV?.trim().toLowerCase() === "production";
  const configured = env.WHATSAPP_STATE_STORE?.trim().toLowerCase();
  const hasServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  if (production && hasServiceRole) {
    if (configured === "memory" && !warnedMemoryOverride) {
      warnedMemoryOverride = true;
      console.warn(
        "[whatsapp] WHATSAPP_STATE_STORE=memory ignorado em produção; usando Supabase para idempotência distribuída",
      );
    }
    env.WHATSAPP_STATE_STORE = "supabase";
    return "supabase";
  }

  if (production && !hasServiceRole && !warnedMissingDurableStore) {
    warnedMissingDurableStore = true;
    console.error(
      "[whatsapp] SUPABASE_SERVICE_ROLE_KEY ausente em produção; idempotência fica limitada à instância atual",
    );
  }

  return configured === "supabase" ? "supabase" : "memory";
}
