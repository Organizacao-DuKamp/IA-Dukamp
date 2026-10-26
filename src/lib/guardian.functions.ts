import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ActionSchema, TopicSchema } from "./guardian/schema.ts";
import { CalculationInput, calculate } from "./guardian/calculators.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FarmBook, GuardianSnapshot } from "./guardian/schema.ts";
import type { ObservedSummary } from "./guardian/observed-property.server.ts";
export type { ObservedDetail, ObservedSummary } from "./guardian/observed-property.server.ts";

type Context = { supabase: SupabaseClient; userId: string };
export interface PropertySummary {
  id: string;
  version: number;
  name: string;
  city: string;
  uf: string;
  updated_at: string;
}
export type GuardianJson =
  | null
  | string
  | number
  | boolean
  | GuardianJson[]
  | { [key: string]: GuardianJson };
export interface GuardianEventView {
  id: string;
  type: string;
  topic: string;
  status: string;
  message: string;
  not_before: string;
  expires_at: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  evidence: GuardianJson;
}
export interface GuardianAuditView {
  id: string;
  action: string;
  created_at: string;
  details: GuardianJson;
}
export interface GuardianEventHistoryView {
  id: number;
  event_id: string;
  status: string;
  reason: string | null;
  created_at: string;
}
export interface GuardianDetail {
  id: string;
  version: number;
  book: FarmBook;
  events: GuardianEventView[];
  audit: GuardianAuditView[];
  members: Array<{ phone_number: string; role: string; active: boolean }>;
}
export const guardianEventHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ eventId: z.uuid() }).strict().parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as Context;
    // Read with the authenticated caller. Both parent event and history use RLS;
    // a stale open panel cannot retain access after membership revocation.
    const event = await ctx.supabase
      .from("guardian_events")
      .select("id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (event.error || !event.data)
      throw new Error("Aviso indisponível ou sem permissão de acesso.");
    const { data: rows, error } = await ctx.supabase
      .from("guardian_event_history")
      .select("id,event_id,status,reason,created_at")
      .eq("event_id", data.eventId)
      .order("id", { ascending: false })
      .limit(201);
    if (error) throw new Error("Não foi possível consultar o histórico deste aviso.");
    return {
      entries: (rows ?? []).slice(0, 200).reverse() as GuardianEventHistoryView[],
      partial: (rows?.length ?? 0) > 200,
    };
  });
export const guardianOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Context;
    const [properties, account, role] = await Promise.all([
      ctx.supabase
        .from("guardian_properties")
        .select("id,version,name:book->>name,city:book->>city,uf:book->>uf,updated_at")
        .order("updated_at", { ascending: false })
        .limit(101),
      ctx.supabase
        .from("guardian_accounts")
        .select("phone_number,preferences")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ]);
    if (properties.error?.code === "42P01" || properties.error?.code === "PGRST205")
      return {
        configured: false,
        enabled: false,
        templateConfigured: false,
        isAdmin: false,
        properties: [] as PropertySummary[],
        partial: false,
        account: null,
        observedProfiles: [] as ObservedSummary[],
        observedPartial: false,
      };
    if (properties.error || account.error || role.error)
      throw new Error("Não foi possível consultar as propriedades autorizadas.");
    const observed =
      role.data === true
        ? await (await import("./guardian/observed-property.server.ts")).listObservedProperties()
        : { profiles: [] as ObservedSummary[], partial: false };
    return {
      configured: true,
      enabled: process.env.TPEC_GUARDIAN_ENABLED === "true",
      templateConfigured: Boolean(process.env.WHATSAPP_GUARDIAN_TEMPLATE_NAME),
      isAdmin: role.data === true,
      properties: (properties.data ?? []).slice(0, 100) as unknown as PropertySummary[],
      partial: (properties.data?.length ?? 0) > 100,
      account: account.data,
      observedProfiles: observed.profiles,
      observedPartial: observed.partial,
    };
  });
export const guardianObservedProperty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.uuid() }).strict().parse(data))
  .handler(async ({ context, data }) => {
    const ctx = context as Context;
    const { data: admin, error } = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (error || admin !== true) throw new Error("Acesso restrito a administradores.");
    return (await import("./guardian/observed-property.server.ts")).getObservedProperty(data.id);
  });
export const guardianPropertyDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as Context;
    // The caller's RLS decides access before any service-role operation. No identity from user_metadata.
    const property = await ctx.supabase
      .from("guardian_properties")
      .select("id,version,book")
      .eq("id", data.id)
      .maybeSingle();
    if (property.error || !property.data)
      throw new Error("Propriedade indisponível ou sem permissão de acesso.");
    const { guardianDb } = await import("./guardian/store.server.ts");
    const [events, audit, members] = await Promise.all([
      ctx.supabase
        .from("guardian_events")
        .select(
          "id,type,topic,status,message,not_before,expires_at,attempts,last_error,sent_at,created_at,evidence",
        )
        .eq("property_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      ctx.supabase
        .from("guardian_audit")
        .select("id,action,created_at,details")
        .eq("property_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      (await guardianDb())
        .from("guardian_members")
        .select("phone_number,role,active")
        .eq("property_id", data.id),
    ]);
    if (events.error || audit.error || members.error)
      throw new Error("Não foi possível carregar os eventos e a auditoria.");
    return {
      ...property.data,
      events: events.data ?? [],
      audit: audit.data ?? [],
      members: members.data ?? [],
    } as GuardianDetail;
  });
export const guardianCreateWebLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (process.env.TPEC_GUARDIAN_ENABLED !== "true")
      throw new Error("A Guardiã está aguardando ativação.");
    const { randomBytes, createHash } = await import("node:crypto");
    const { guardianDb } = await import("./guardian/store.server.ts");
    const token = randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + 10 * 60000).toISOString();
    const db = await guardianDb();
    // A signed-in account can hold at most five unconsumed pairing codes.
    const { count, error: countError } = await db
      .from("guardian_web_links")
      .select("token_hash", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString());
    if (countError) throw new Error("Não foi possível criar o código de vínculo.");
    if ((count ?? 0) >= 5)
      throw new Error("Use um código já gerado ou espere dez minutos antes de gerar outro.");
    const { error } = await db.from("guardian_web_links").insert({
      token_hash: createHash("sha256").update(token).digest("hex"),
      user_id: context.userId,
      expires_at: expires,
    });
    if (error) throw new Error("Não foi possível criar o código de vínculo.");
    return { command: `vincular painel ${token}`, expiresAt: expires };
  });
const SubmitInput = z
  .object({
    propertyId: z.uuid().optional(),
    requestId: z.uuid(),
    action: ActionSchema.optional(),
    command: z.enum(["confirm", "cancel"]).optional(),
    proposalId: z.string().max(128).optional(),
  })
  .strict()
  .refine((d) => !!d.action !== !!d.command);
export const guardianSubmitAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as Context;
    if (process.env.TPEC_GUARDIAN_ENABLED !== "true")
      throw new Error("A Guardiã está aguardando ativação.");
    const { data: account, error } = await ctx.supabase
      .from("guardian_accounts")
      .select("phone_number")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error || !account) throw new Error("Vincule seu WhatsApp antes de alterar os registros.");
    if (data.propertyId) {
      const p = await ctx.supabase
        .from("guardian_properties")
        .select("id")
        .eq("id", data.propertyId)
        .maybeSingle();
      if (p.error || !p.data) throw new Error("Propriedade sem permissão de acesso.");
    }
    const { guardianStore } = await import("./guardian/store.server.ts");
    const { handleGuardianMessage } = await import("./guardian/handler.server.ts");
    let snapshot = await guardianStore.load(account.phone_number);
    if (
      data.command &&
      (!snapshot.pending ||
        snapshot.pending.sourceMessageId !== data.proposalId ||
        snapshot.pending.propertyId !== (data.propertyId ?? null))
    )
      throw new Error("A proposta mudou ou expirou. Revise a proposta atual antes de confirmar.");
    if (data.propertyId && snapshot.active?.id !== data.propertyId) {
      await handleGuardianMessage({
        phone: account.phone_number,
        messageId: `web-select:${data.requestId}`,
        text: `usar fazenda ${data.propertyId}`,
      });
      snapshot = await guardianStore.load(account.phone_number);
      if (snapshot.active?.id !== data.propertyId)
        throw new Error("Não foi possível selecionar a propriedade.");
    }
    const result = await handleGuardianMessage(
      {
        phone: account.phone_number,
        messageId: `web:${data.requestId}`,
        text: data.command ?? "Proposta revisável no painel",
      },
      { request: data.action ? { kind: "action", action: data.action } : { kind: data.command! } },
    );
    if (!result?.reply) throw new Error("Não foi possível processar a operação.");
    if (result.persisted === false) throw new Error(result.reply);
    return { reply: result.reply, snapshot: await guardianStore.load(account.phone_number) } as {
      reply: string;
      snapshot: GuardianSnapshot;
    };
  });
export const guardianCalculate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => CalculationInput.parse(d))
  .handler(async ({ data }) => calculate(data));

export const guardianUpdatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        requestId: z.uuid(),
        enabled: z.boolean(),
        startHour: z.number().int().min(0).max(23),
        endHour: z.number().int().min(1).max(24),
        maxPerDay: z.number().int().min(1).max(10),
        topics: z.array(TopicSchema).max(6),
        reportCadence: z.enum(["none", "daily", "weekly", "monthly"]),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (process.env.TPEC_GUARDIAN_ENABLED !== "true")
      throw new Error("A Guardiã está aguardando ativação.");
    const ctx = context as Context;
    const { data: account, error } = await ctx.supabase
      .from("guardian_accounts")
      .select("phone_number")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error || !account) throw new Error("Vincule seu WhatsApp antes de configurar avisos.");
    const { requestId, ...preferences } = data;
    const { handleGuardianMessage } = await import("./guardian/handler.server.ts");
    const result = await handleGuardianMessage(
      {
        phone: account.phone_number,
        messageId: `web-prefs:${requestId}`,
        text: "Preferências revisadas e autorizadas no painel",
      },
      { request: { kind: "preferences", ...preferences } },
    );
    if (!result?.reply) throw new Error("Não foi possível salvar as preferências.");
    if (result.persisted === false) throw new Error(result.reply);
    return { reply: result.reply };
  });
