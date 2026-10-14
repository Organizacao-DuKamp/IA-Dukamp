import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USER_MEMORY_EPOCH, MEMORY_INBOX_PREFIX, prepareWebMemory } from "./chat/memory-reset.ts";

export const auditUserMemoryReset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || role.data !== true) throw new Error("Acesso restrito a administradores.");
    const { getPrivilegedClient } = await import("./privileged.server");
    const db = await getPrivilegedClient(context.supabase);
    // Existing application tables; no personal values are returned.
    const tables = db as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const results = await Promise.all([
      tables.from("whatsapp_conversations").select("phone_number", { count: "exact", head: true }),
      tables
        .from("whatsapp_conversations")
        .select("phone_number", { count: "exact", head: true })
        .contains("state", { memory_reset: { epoch: USER_MEMORY_EPOCH } }),
      tables
        .from("whatsapp_user_memory_facts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      tables
        .from("whatsapp_user_memory_facts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .contains("metadata", { memory_epoch: USER_MEMORY_EPOCH }),
      tables
        .from("whatsapp_memory_inbox")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]),
      tables
        .from("whatsapp_memory_inbox")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"])
        .like("user_text", MEMORY_INBOX_PREFIX + "%"),
      tables
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("category", "dukamp_controlado")
        .not("embedding", "is", null),
    ]);
    for (const result of results)
      if (result.error)
        throw new Error(
          "Conferência de memória indisponível: " + (result.error.code ?? "database_error"),
        );
    const counts = results.map((r) => r.count ?? 0);
    const probe = prepareWebMemory({
      sessionId: "memory-reset-audit",
      text: "Olá",
      history: [{ role: "user", content: "lembrança anterior" }],
      state: { confirmed_data: { old: true } },
    });
    return JSON.stringify({
      checked_at: new Date().toISOString(),
      memory_epoch: USER_MEMORY_EPOCH,
      previous_conversations_excluded: counts[0] - counts[1],
      new_generation_conversations: counts[1],
      previous_active_facts_excluded: counts[2] - counts[3],
      new_generation_active_facts: counts[3],
      previous_pending_extractions_ignored: counts[4] - counts[5],
      new_generation_pending_extractions: counts[5],
      legacy_browser_history_reused: probe.history.length !== 0,
      legacy_browser_state_reused: probe.state !== undefined,
      dukamp_embeddings_preserved: counts[6],
      permanent_deletion_performed: false,
    });
  });
