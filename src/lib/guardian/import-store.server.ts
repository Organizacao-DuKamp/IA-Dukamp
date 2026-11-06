import { guardianDb, guardianStore } from "./store.server.ts";
import {
  type ImportBatch,
  type ImportRow,
  type ImportSource,
  type ImportProfile,
  importIssues,
} from "./imports.ts";
import { createHash } from "node:crypto";
export async function importRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (await guardianDb())
    .rpc(name, args)
    .abortSignal(AbortSignal.timeout(15000));
  if (error)
    throw Error(
      "Não consegui confirmar esta etapa da importação. A lista continua guardada para retomar.",
    );
  return data;
}
export async function currentImport(
  phone: string,
  propertyId?: string,
): Promise<ImportBatch | null> {
  let q = (await guardianDb())
    .from("guardian_import_batches")
    .select("*")
    .eq("phone_number", phone)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (propertyId) q = q.eq("property_id", propertyId);
  const { data, error } = await q.maybeSingle();
  if (error) throw Error("import_unavailable");
  return data;
}
export async function authorizeImport(phone: string, batchId: string) {
  const { data, error } = await (await guardianDb())
    .from("guardian_import_batches")
    .select("*")
    .eq("id", batchId)
    .eq("phone_number", phone)
    .maybeSingle();
  if (error || !data) throw Error("import_access_denied");
  const farm = await guardianStore.loadProperty!(phone, data.property_id);
  if (!farm || !["owner", "manager", "technician"].includes(farm.role))
    throw Error("import_access_denied");
  return { batch: data as ImportBatch, farm };
}
export async function importRows(batchId: string): Promise<ImportRow[]> {
  const all: ImportRow[] = [];
  for (let start = 0; start < 10000; start += 500) {
    const { data, error } = await (
      await guardianDb()
    )
      .from("guardian_import_rows")
      .select("*")
      .eq("batch_id", batchId)
      .order("source_id")
      .order("page")
      .order("ordinal")
      .range(start, start + 499);
    if (error) throw Error("import_rows_unavailable");
    all.push(...data);
    if (data.length < 500) return all;
  }
  throw Error("O lote ultrapassa 10.000 linhas. Divida a importação.");
}
export async function importSources(batchId: string, withBytes = false): Promise<ImportSource[]> {
  const columns = withBytes
    ? "*"
    : "id,batch_id,message_id,digest,filename,mime,status,pages,completed_pages,error,attempts,sent_at";
  const { data, error } = await (await guardianDb())
    .from("guardian_import_sources")
    .select(columns)
    .eq("batch_id", batchId)
    .order("sent_at")
    .order("created_at");
  if (error) throw Error("import_sources_unavailable");
  return data as unknown as ImportSource[];
}
export async function enqueueImport(input: {
  phone: string;
  propertyId: string;
  messageId: string;
  filename: string;
  mime: string;
  bytes?: Uint8Array;
  instruction: string;
  sentAt?: string;
}) {
  const { bytes } = input;
  return (await importRpc("guardian_import_enqueue", {
    p_phone: input.phone,
    p_property: input.propertyId,
    p_message: input.messageId,
    p_filename: input.filename,
    p_mime: input.mime,
    p_digest: createHash("sha256")
      .update(bytes ?? new Uint8Array())
      .digest("hex"),
    p_data: bytes ? Buffer.from(bytes).toString("base64") : "",
    p_instruction: input.instruction,
    p_sent_at: input.sentAt ?? null,
  })) as string;
}
export async function reviewImport(
  phone: string,
  batch: ImportBatch,
  kind: string,
  data: Record<string, unknown> = {},
) {
  const ok = await importRpc("guardian_import_review", {
    p_phone: phone,
    p_batch: batch.id,
    p_revision: batch.revision,
    p_kind: kind,
    p_data: data,
  });
  if (ok !== true)
    throw Error(
      "A lista mudou em outra mensagem ou sessão. Atualize e confira antes de confirmar.",
    );
}
export async function editImportRow(
  phone: string,
  batch: ImportBatch,
  row: ImportRow,
  profile: ImportProfile,
  updateFields: string[] = [],
) {
  const { farm } = await authorizeImport(phone, batch.id);
  await reviewImport(phone, batch, "edit", {
    id: row.id,
    profile,
    issues: importIssues(profile, farm.book),
    updateFields,
  });
}
