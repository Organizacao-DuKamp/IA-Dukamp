import { z } from "zod";
import { OperationsActionSchemas, OperationsSchema, type Operations } from "./operations.ts";

export const TopicSchema = z.enum([
  "tasks",
  "weather",
  "health",
  "finance",
  "performance",
  "reports",
]);
export const RoleSchema = z.enum(["owner", "manager", "worker", "technician"]);
export type GuardianRole = z.infer<typeof RoleSchema>;
const label = z.string().trim().min(1).max(160);
const date = z.iso.date();
export const PreferencesSchema = z
  .object({
    enabled: z.boolean().default(false),
    consentAt: z.iso.datetime().nullable().default(null),
    consentMessageId: z.string().max(128).nullable().default(null),
    timeZone: z
      .string()
      .max(60)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      })
      .default("America/Sao_Paulo"),
    startHour: z.number().int().min(0).max(23).default(8),
    endHour: z.number().int().min(1).max(24).default(20),
    maxPerDay: z.number().int().min(1).max(10).default(2),
    minIntervalMinutes: z.number().int().min(30).max(1440).default(120),
    topics: z.array(TopicSchema).max(6).default(["tasks", "weather", "health", "performance"]),
    reportCadence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  })
  .strict()
  .refine((v) => v.startHour < v.endHour, "O horário inicial deve vir antes do final.");
export type GuardianPreferences = z.infer<typeof PreferencesSchema>;
export const ActionSchema = z.discriminatedUnion("kind", [
  ...OperationsActionSchemas,
  z
    .object({
      kind: z.literal("property_create"),
      name: label,
      city: label,
      uf: z
        .string()
        .regex(
          /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/,
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal("profile"),
      activity: label.optional(),
      species: z.array(label).max(10).optional(),
      breeds: z.array(label).max(20).optional(),
      feeding: label.optional(),
      pastures: label.optional(),
      goals: label.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("task_create"),
      title: label,
      dueAt: z.iso.datetime(),
      lot: label.optional(),
      responsiblePhone: z
        .string()
        .regex(/^\d{10,15}$/)
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("task_update"),
      task: label,
      status: z.enum(["done", "cancelled"]).optional(),
      dueAt: z.iso.datetime().optional(),
      title: label.optional(),
    })
    .strict()
    .refine((a) => !!a.status || !!a.dueAt || !!a.title, "Informe a alteração."),
  z
    .object({
      kind: z.literal("ledger"),
      direction: z.enum(["expense", "income"]),
      amountCents: z.number().int().positive().max(1e12),
      description: label,
      date,
      lot: label.optional(),
      category: label.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("record"),
      type: z.enum(["management", "birth", "health", "purchase", "movement"]),
      description: z.string().trim().min(3).max(1500),
      date,
      lot: label.optional(),
      count: z.number().int().positive().max(1e6).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("animal"),
      code: label,
      name: label.optional(),
      rgn: label.optional(),
      rgd: label.optional(),
      category: label.optional(),
      sire: label.optional(),
      dam: label.optional(),
      status: z.enum(["active", "sold", "dead", "transferred"]).optional(),
      sex: z.enum(["male", "female", "unknown"]).optional(),
      breed: label.optional(),
      birthDate: date.optional(),
      lot: label.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("weighing"),
      code: label,
      weightKg: z.number().finite().positive().max(2000),
      date,
      estimated: z.boolean().default(false),
      correction: z.boolean().default(false),
    })
    .strict(),
  z.object({ kind: z.literal("move"), code: label, lot: label }).strict(),
  z
    .object({ kind: z.literal("delete_record"), section: z.enum(["records", "ledger"]), id: label })
    .strict(),
  z
    .object({
      kind: z.literal("invite"),
      phone: z.string().regex(/^\d{10,15}$/),
      role: RoleSchema.exclude(["owner"]),
    })
    .strict(),
  z.object({ kind: z.literal("revoke"), phone: z.string().regex(/^\d{10,15}$/) }).strict(),
  z.object({ kind: z.literal("property_delete"), name: label }).strict(),
]);
export type GuardianAction = z.infer<typeof ActionSchema>;
export interface Provenance {
  messageId: string;
  actor: string;
  at: string;
  confirmed: true;
  sourceAt?: string;
}
export interface Weighing extends Provenance {
  date: string;
  weightKg: number;
  estimated: boolean;
  corrections: Array<{
    weightKg: number;
    at: string;
    messageId: string;
    estimated?: boolean;
    previousSource?: Provenance;
  }>;
}
export interface GuardianAnimal {
  code: string;
  name?: string;
  rgn?: string;
  rgd?: string;
  category?: string;
  sire?: string;
  dam?: string;
  status?: "active" | "sold" | "dead" | "transferred";
  sex: "male" | "female" | "unknown";
  breed?: string;
  birthDate?: string;
  lot?: string;
  weights: Weighing[];
  source: Provenance;
}
export interface GuardianTask {
  id: string;
  title: string;
  dueAt: string;
  status: "open" | "done" | "cancelled";
  lot?: string;
  responsiblePhone?: string;
  source: Provenance;
  updatedAt: string;
}
export interface LedgerEntry {
  id: string;
  direction: "expense" | "income";
  amountCents: number;
  description: string;
  date: string;
  lot?: string;
  category?: string;
  source: Provenance;
}
export interface FieldRecord {
  id: string;
  type: "management" | "birth" | "health" | "purchase" | "movement";
  description: string;
  date: string;
  lot?: string;
  count?: number;
  source: Provenance;
}
export interface FarmBook {
  schema: 1;
  name: string | null;
  city: string | null;
  uf: string | null;
  operations?: Operations;
  profile: {
    activity?: string;
    species?: string[];
    breeds?: string[];
    feeding?: string;
    pastures?: string;
    goals?: string;
  };
  animals: GuardianAnimal[];
  tasks: GuardianTask[];
  ledger: LedgerEntry[];
  records: FieldRecord[];
}
export interface PendingAction {
  action: GuardianAction;
  propertyId: string | null;
  createdAt: string;
  expiresAt: string;
  sourceMessageId: string;
}
export interface GuardianSnapshot {
  lastCalculation?: import("./calculators.ts").Calculation | null;
  accountVersion: number;
  preferences: GuardianPreferences;
  pending: PendingAction | null;
  properties: Array<{ id: string; name: string; role: GuardianRole }>;
  active: { id: string; version: number; role: GuardianRole; book: FarmBook } | null;
  lastNotification?: { id: string; taskId: string | null; sentAt: string } | null;
}
export interface GuardianEvent {
  type:
    | "task_due"
    | "weather_alert"
    | "health_followup"
    | "performance_change"
    | "financial_record"
    | "report";
  topic: z.infer<typeof TopicSchema>;
  key: string;
  recipient: string;
  notBefore: string;
  expiresAt: string;
  priority: number;
  evidence: Record<string, unknown>;
  message: string;
}
export function emptyFarm(name: string, city: string, uf: string): FarmBook {
  return {
    schema: 1,
    name,
    city,
    uf,
    profile: {},
    animals: [],
    tasks: [],
    ledger: [],
    records: [],
  };
}
export function canEdit(role: GuardianRole, action: GuardianAction): boolean {
  if (role === "owner") return true;
  if (action.kind === "property_delete" || action.kind === "revoke") return false;
  if (role === "manager") return true;
  return ["record", "animal", "weighing", "move", "task_create", "task_update"].includes(
    action.kind,
  );
}

const ProvenanceSchema = z
  .object({
    messageId: z.string().min(1).max(128),
    actor: z.string().regex(/^\d{6,20}$/),
    at: z.iso.datetime(),
    confirmed: z.literal(true),
    sourceAt: z.iso.datetime().optional(),
  })
  .strict();
const WeighingSchema = ProvenanceSchema.extend({
  date,
  weightKg: z.number().finite().positive().max(2000),
  estimated: z.boolean(),
  corrections: z
    .array(
      z
        .object({
          weightKg: z.number().finite().positive().max(2000),
          at: z.iso.datetime(),
          messageId: z.string().max(128),
          estimated: z.boolean().optional(),
          previousSource: ProvenanceSchema.optional(),
        })
        .strict(),
    )
    .max(5000),
});
export const FarmBookSchema = z
  .object({
    schema: z.literal(1),
    name: label.nullable(),
    city: label.nullable(),
    uf: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable(),
    operations: OperationsSchema.optional(),
    profile: z
      .object({
        activity: label.optional(),
        species: z.array(label).max(10).optional(),
        breeds: z.array(label).max(20).optional(),
        feeding: label.optional(),
        pastures: label.optional(),
        goals: label.optional(),
      })
      .strict(),
    animals: z
      .array(
        z
          .object({
            code: label,
            name: label.optional(),
            rgn: label.optional(),
            rgd: label.optional(),
            category: label.optional(),
            sire: label.optional(),
            dam: label.optional(),
            status: z.enum(["active", "sold", "dead", "transferred"]).optional(),
            sex: z.enum(["male", "female", "unknown"]),
            breed: label.optional(),
            birthDate: date.optional(),
            lot: label.optional(),
            weights: z.array(WeighingSchema).max(5000),
            source: ProvenanceSchema,
          })
          .strict(),
      )
      .max(2000),
    tasks: z
      .array(
        z
          .object({
            id: label,
            title: label,
            dueAt: z.iso.datetime(),
            status: z.enum(["open", "done", "cancelled"]),
            lot: label.optional(),
            responsiblePhone: z
              .string()
              .regex(/^\d{6,20}$/)
              .optional(),
            source: ProvenanceSchema,
            updatedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(5000),
    ledger: z
      .array(
        z
          .object({
            id: label,
            direction: z.enum(["expense", "income"]),
            amountCents: z.number().int().positive().max(1e12),
            description: label,
            date,
            lot: label.optional(),
            category: label.optional(),
            source: ProvenanceSchema,
          })
          .strict(),
      )
      .max(20000),
    records: z
      .array(
        z
          .object({
            id: label,
            type: z.enum(["management", "birth", "health", "purchase", "movement"]),
            description: z.string().min(3).max(1500),
            date,
            lot: label.optional(),
            count: z.number().int().positive().max(1e6).optional(),
            source: ProvenanceSchema,
          })
          .strict(),
      )
      .max(20000),
  })
  .strict();

export function farmName(book: Pick<FarmBook, "name" | "city">): string {
  return book.name ?? `Propriedade sem nome${book.city ? ` — ${book.city}` : ""}`;
}
