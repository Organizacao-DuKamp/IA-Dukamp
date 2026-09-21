import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  userId: string;
};

const PhoneInput = z.object({
  phone: z.string().regex(/^\d{6,20}$/),
});

const ToggleInput = PhoneInput.extend({
  enabled: z.boolean(),
});

async function assertAdmin(ctx: AdminContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

export const whatsappFollowupDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const proactive = await import("./proactive.server.ts");
    return proactive.getWhatsAppFollowupDetail(data.phone);
  });

export const forceWhatsAppFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const proactive = await import("./proactive.server.ts");
    return proactive.forceWhatsAppFollowup(data.phone);
  });

export const setWhatsAppFollowupEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ToggleInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as AdminContext);
    const proactive = await import("./proactive.server.ts");
    return proactive.setWhatsAppFollowupsEnabled(data.phone, data.enabled);
  });

export type {
  ManualFollowupResult,
  WhatsAppFollowupDetail,
  WhatsAppFollowupProfile,
  WhatsAppMemoryFact,
  WhatsAppProactiveQueueItem,
} from "./proactive.server.ts";
