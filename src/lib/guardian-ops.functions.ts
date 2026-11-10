/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guardianOpsReport, type GuardianOpsTurn } from "./guardian/ops-health";

const PAGE_SIZE = 500;
const MAX_TURNS = 5_000;

type AdminContext = { supabase: any; userId: string };

/**
 * Admin-only, read-only operational summary. No message bodies, phone numbers,
 * farm books or user keys are selected from the database or returned.
 * An explicit page cap is disclosed to prevent misleading aggregate totals.
 */
export const guardianOperationalHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as AdminContext;
    const role = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (role.error || role.data !== true)
      throw new Error("Acesso restrito a administradores.");

    const { getPrivilegedClient } = await import("@/lib/privileged.server");
    const db = (await getPrivilegedClient(ctx.supabase)) as any;
    const at = new Date();
    const since = new Date(at.getTime() - 48 * 3_600_000).toISOString();
    const rows: GuardianOpsTurn[] = [];

    for (let offset = 0; offset < MAX_TURNS; offset += PAGE_SIZE) {
      const result = await db
        .from("ai_chat_turns")
        .select(
          "created_at,channel,status,error_code,pricing_configured,input_tokens,total_tokens,duration_ms,estimated_cost_usd,metadata",
        )
        .eq("channel", "whatsapp")
        .gte("created_at", since)
        .lte("created_at", at.toISOString())
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (result.error)
        throw new Error("Não foi possível consultar os indicadores operacionais.");
      rows.push(...((result.data ?? []) as GuardianOpsTurn[]));
      if ((result.data ?? []).length < PAGE_SIZE) break;
    }

    return guardianOpsReport(rows, at, rows.length >= MAX_TURNS);
  });
