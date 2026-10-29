import { z } from "zod";
export const GuardianTraceSchema = z
  .object({
    version: z.literal(1),
    operationId: z.string().max(128),
    propertyId: z.string().max(128).nullable(),
    status: z.enum(["completed", "pending", "rejected", "error", "cancelled", "replay"]),
    stage: z.enum(["interpretation", "validation", "commit", "receipt"]),
    sourceMessageId: z.string().max(128),
    receiptMessageId: z.string().max(128),
    actionKinds: z.array(z.string().max(40)).max(20),
    propertyVersionBefore: z.number().nullable(),
    reason: z.string().max(120).optional(),
  })
  .strict();
export type GuardianTrace = z.infer<typeof GuardianTraceSchema>;
