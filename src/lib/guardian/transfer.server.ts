import { z } from "zod";
import { guardianDb } from "./store.server.ts";
import { FarmBookSchema, type FarmBook, type GuardianRole, type Provenance } from "./schema.ts";
import { applyFarmAction } from "./book.ts";
import { stockAt, type OperationsAction } from "./operations.ts";

export type FarmTransferAction = Extract<OperationsAction, { kind: "property_transfer" }>;
export interface TransferTarget {
  id: string;
  version: number;
  role: GuardianRole;
  book: FarmBook;
}
export interface TransferCommit {
  phone: string;
  messageId: string;
  proposalId: string;
  accountVersion: number;
  from: TransferTarget;
  to: TransferTarget;
  action: FarmTransferAction;
  reply: string;
}
export interface FarmTransferStore {
  target(phone: string, id: string): Promise<TransferTarget | null>;
  commit(input: TransferCommit): Promise<string>;
}
export function preparePropertyTransfer(
  from: TransferTarget,
  to: TransferTarget,
  action: FarmTransferAction,
  source: Provenance,
  id: string,
) {
  if (
    from.id === to.id ||
    ![from.role, to.role].every((role) => ["owner", "manager"].includes(role))
  )
    throw new Error("Seu perfil precisa permitir a gestão das duas fazendas.");
  for (const [target, lot] of [
    [from, action.fromLot],
    [to, action.toLot],
  ] as const) {
    const baseline =
      target.book.operations && stockAt(target.book.operations, action.date, lot).baseline;
    const total = target.book.operations && stockAt(target.book.operations, action.date).baseline;
    if (!baseline || !total || baseline.date >= action.date || total.date >= action.date)
      throw new Error(
        "Informe contagens das duas fazendas no fim de um dia anterior à transferência; não presumo saldo zero no destino.",
      );
  }
  const out = applyFarmAction(
    from.book,
    {
      kind: "herd_event",
      type: "transfer_out",
      count: action.count,
      date: action.date,
      description: "Transferência entre propriedades autorizadas",
      ...(action.fromLot ? { lot: action.fromLot } : {}),
    },
    from.role,
    source,
    id + "-out",
  );
  const incoming = applyFarmAction(
    to.book,
    {
      kind: "herd_event",
      type: "transfer_in",
      count: action.count,
      date: action.date,
      description: "Transferência entre propriedades autorizadas",
      ...(action.toLot ? { lot: action.toLot } : {}),
    },
    to.role,
    source,
    id + "-in",
  );
  FarmBookSchema.parse(out.book);
  FarmBookSchema.parse(incoming.book);
  return { from: { ...from, book: out.book }, to: { ...to, book: incoming.book } };
}
export const farmTransferStore: FarmTransferStore = {
  async target(phone, id) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_transfer_target", { p_phone: phone, p_id: id })
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw new Error("guardian_transfer_unavailable");
    if (!data) return null;
    const value = z
      .object({
        id: z.uuid(),
        version: z.number().int().min(0),
        role: z.enum(["owner", "manager", "worker", "technician"]),
        book: FarmBookSchema,
      })
      .parse(data);
    return value;
  },
  async commit(input) {
    const db = await guardianDb();
    const { data, error } = await db
      .rpc("guardian_transfer_commit", {
        p_phone: input.phone,
        p_message: input.messageId,
        p_proposal: input.proposalId,
        p_account_version: input.accountVersion,
        p_from: input.from.id,
        p_to: input.to.id,
        p_from_version: input.from.version,
        p_to_version: input.to.version,
        p_from_book: input.from.book,
        p_to_book: input.to.book,
        p_details: input.action,
        p_reply: input.reply,
      })
      .abortSignal(AbortSignal.timeout(8000));
    if (error) throw new Error("guardian_transfer_unavailable");
    return data;
  },
};
