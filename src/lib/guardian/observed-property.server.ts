import { z } from "zod";
import { guardianDb } from "./store.server.ts";
import {
  observedFields,
  extractPropertyObservation,
  type PropertyObservation,
} from "./observed-property.ts";
import type { NoteInput } from "../whatsapp/learned-notes.server.ts";
import { userStatement } from "../whatsapp/learned-notes.ts";
import { decodeNoteInbox } from "../whatsapp/learned-notes.ts";
import { currentMemoryInboxText } from "../chat/memory-reset.ts";

const timestamp = z.string().refine((v) => Number.isFinite(Date.parse(v)));
const field = z.enum(
  Object.keys(observedFields) as [
    keyof typeof observedFields,
    ...Array<keyof typeof observedFields>,
  ],
);
const summaryFact = z.object({
  value: z.union([z.string(), z.number()]),
  effectiveDate: z.iso.date(),
  sourceAt: timestamp,
});
export const ObservedSummarySchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  name: z.string(),
  updatedAt: timestamp,
  facts: z.record(z.string(), summaryFact),
});
const storedFact = z.object({
  id: z.uuid(),
  field,
  value: z.union([z.string(), z.number()]),
  source_message_id: z.string(),
  source_excerpt: z.string(),
  source_question: z.string().nullable(),
  source_at: timestamp,
  effective_date: z.iso.date(),
});
export const ObservedDetailSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  updatedAt: timestamp,
  current: z.array(storedFact),
  history: z.array(storedFact),
  partial: z.boolean(),
});
export type ObservedSummary = z.infer<typeof ObservedSummarySchema>;
export type ObservedDetail = z.infer<typeof ObservedDetailSchema>;
export type ProjectionOutcome = "saved" | "no_facts" | "ambiguous_property" | "reset";
export interface ProjectionResult {
  status: ProjectionOutcome;
  added: number;
  propertyId?: string;
}
export interface PendingPropertyNote {
  id: string;
  phone_number: string;
  source_message_id: string;
  value_text: string;
  last_seen_at: string;
  metadata: Record<string, unknown>;
}
export interface PropertyProjectionStore {
  commit(
    input: NoteInput,
    source: string,
    observation: PropertyObservation,
    at: string,
  ): Promise<ProjectionResult>;
  pending(limit: number): Promise<
    Array<{
      id: string;
      phone_number: string;
      source_message_id: string;
      value_text: string;
      last_seen_at: string;
      metadata: Record<string, unknown>;
    }>
  >;
  finish(id: string, outcome: ProjectionOutcome): Promise<void>;
  source(note: PendingPropertyNote): Promise<{
    text: string;
    at: string;
    history?: NoteInput["history"];
    mediaType?: string;
  } | null>;
}
export const propertyProjectionStore: PropertyProjectionStore = {
  async commit(input, source, observation, at) {
    const { data, error } = await (
      await guardianDb()
    )
      .rpc("guardian_observe_property", {
        p_phone: input.phone,
        p_message_id: input.messageId,
        p_source_at: at,
        p_source_text: source,
        p_name: observation.name,
        p_another: observation.another,
        p_facts: observation.facts,
      })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("property_projection_unavailable");
    return z
      .object({
        status: z.enum(["saved", "ambiguous_property", "reset"]),
        added: z.number().int().min(0),
        propertyId: z.uuid().optional(),
      })
      .parse(data);
  },
  async pending(limit) {
    const { data, error } = await (await guardianDb())
      .rpc("guardian_pending_property_notes", { p_limit: limit })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("property_projection_queue_unavailable");
    return z
      .array(
        z.object({
          id: z.uuid(),
          phone_number: z.string(),
          source_message_id: z.string(),
          value_text: z.string(),
          last_seen_at: timestamp,
          metadata: z.record(z.string(), z.unknown()),
        }),
      )
      .parse(data);
  },
  async finish(id, outcome) {
    const { error } = await (await guardianDb())
      .rpc("guardian_finish_property_note", { p_id: id, p_outcome: outcome })
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw new Error("property_projection_completion_unavailable");
  },
  async source(note) {
    const db = await guardianDb();
    const inbox = await db
      .from("whatsapp_memory_inbox")
      .select("user_text,created_at")
      .eq("phone_number", note.phone_number)
      .eq("message_id", note.source_message_id)
      .maybeSingle();
    if (inbox.error) throw new Error("property_original_source_unavailable");
    const raw = inbox.data ? currentMemoryInboxText(inbox.data.user_text) : null;
    if (raw !== null) {
      const decoded = decodeNoteInbox(raw);
      return { ...decoded, at: decoded.at ?? inbox.data!.created_at };
    }
    const turn = await db
      .from("ai_chat_turns")
      .select("user_text,created_at")
      .eq("channel", "whatsapp")
      .eq("phone_number", note.phone_number)
      .eq("client_message_id", note.source_message_id)
      .maybeSingle();
    if (turn.error) throw new Error("property_original_source_unavailable");
    return turn.data
      ? {
          text: turn.data.user_text,
          at: turn.data.created_at,
          ...(note.metadata.source === "audio_transcript" ? { mediaType: "audio" } : {}),
          ...(typeof note.metadata.question === "string"
            ? { history: [{ role: "assistant" as const, content: note.metadata.question }] }
            : {}),
        }
      : null;
  },
};
export async function projectObservedProperty(
  input: NoteInput,
  deps: { store?: PropertyProjectionStore; now?: Date; enabled?: boolean } = {},
): Promise<ProjectionResult> {
  if (
    !(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true") ||
    (!deps.store && process.env.CONTEXT && process.env.CONTEXT !== "production")
  )
    return { status: "no_facts", added: 0 };
  if (!/^\d{6,20}$/.test(input.phone) || !input.messageId || input.messageId.length > 128)
    throw new Error("invalid_projection_owner");
  const at = input.at ?? (deps.now ?? new Date()).toISOString();
  if (!Number.isFinite(Date.parse(at))) throw new Error("invalid_projection_time");
  const source = userStatement(input.text, input.mediaType);
  const observation = extractPropertyObservation({ ...input, at: new Date(at) });
  if (!observation.facts.length) return { status: "no_facts", added: 0 };
  return (deps.store ?? propertyProjectionStore).commit(input, source, observation, at);
}
export async function processObservedPropertyNotes(
  deps: { store?: PropertyProjectionStore; enabled?: boolean; limit?: number } = {},
) {
  if (
    !(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true") ||
    (!deps.store && process.env.CONTEXT && process.env.CONTEXT !== "production")
  )
    return { enabled: false as const };
  const store = deps.store ?? propertyProjectionStore;
  const notes = await store.pending(Math.max(1, Math.min(32, deps.limit ?? 8)));
  const result = { enabled: true as const, checked: notes.length, facts: 0, skipped: 0, failed: 0 };
  for (const note of notes) {
    try {
      // Re-read the whole original message: an isolated excerpt can lose which farm
      // the person was describing. Old AI labels confer no trust or ownership.
      const source = await store.source(note);
      if (!source) {
        if (Date.now() - Date.parse(note.last_seen_at) > 10 * 60000)
          await store.finish(note.id, "no_facts");
        result.skipped++;
        continue;
      }
      const projected = await projectObservedProperty(
        {
          phone: note.phone_number,
          messageId: note.source_message_id,
          ...source,
        },
        { store, enabled: true },
      );
      await store.finish(note.id, projected.status);
      result.facts += projected.added;
      if (!projected.added) result.skipped++;
    } catch {
      result.failed++;
    } // Never log a phone, quoted statement or provider payload.
  }
  return result;
}
export async function listObservedProperties() {
  const { data, error } = await (await guardianDb()).rpc("guardian_observed_profiles");
  if (error?.code === "PGRST202" || error?.code === "42883")
    return { profiles: [] as ObservedSummary[], partial: false, configured: false };
  if (error) throw new Error("Não foi possível carregar os perfis informados nas conversas.");
  return {
    ...z.object({ profiles: z.array(ObservedSummarySchema), partial: z.boolean() }).parse(data),
    configured: true,
  };
}
export async function getObservedProperty(id: string) {
  const { data, error } = await (
    await guardianDb()
  ).rpc("guardian_observed_profile", { p_id: z.uuid().parse(id) });
  if (error || !data) throw new Error("Perfil indisponível ou fora do histórico ativo.");
  return ObservedDetailSchema.parse(data);
}
