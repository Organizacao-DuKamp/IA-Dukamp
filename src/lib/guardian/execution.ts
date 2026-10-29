import { createHash } from "node:crypto";
import {
  ActionSchema,
  FarmBookSchema,
  type FarmBook,
  type GuardianAction,
  type GuardianEvent,
  type GuardianRole,
  type Provenance,
} from "./schema.ts";
import { applyFarmAction } from "./book.ts";

export function operationalId(phone: string, sourceMessageId: string) {
  return createHash("sha256")
    .update(phone + ":" + sourceMessageId)
    .digest("hex")
    .slice(0, 24);
}
/** Pure preparation only. Caller must CAS/commit the entire result once before
 * returning a success receipt. A failure cannot leak a partially modified book. */
export function prepareFarmBatch(input: {
  book: FarmBook;
  actions: GuardianAction[];
  role: GuardianRole;
  propertyId: string;
  source: Provenance;
  executedByMessageId: string;
}) {
  if (!input.actions.length || input.actions.length > 20)
    throw Error("Quantidade de operações inválida.");
  const id = operationalId(input.source.actor, input.source.messageId);
  let book = input.book;
  const events: GuardianEvent[] = [],
    resultIds: string[] = [];
  for (const [index, value] of input.actions.entries()) {
    const action = ActionSchema.parse(value);
    const resultId = createHash("sha256")
      .update(input.source.actor + ":" + input.source.messageId + ":semantic:" + index)
      .digest("hex")
      .slice(0, 20);
    const result = applyFarmAction(book, action, input.role, input.source, resultId);
    book = result.book;
    events.push(...result.events);
    resultIds.push(resultId);
  }
  book.lastOperation = {
    id,
    propertyId: input.propertyId,
    sourceMessageId: input.source.messageId,
    executedByMessageId: input.executedByMessageId,
    at: input.source.at,
    actions: input.actions,
    resultIds,
  };
  return { book: FarmBookSchema.parse(book), events, resultIds, operationId: id };
}
