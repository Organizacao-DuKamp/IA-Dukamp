import { importPdf } from "./import-export.server.ts";
import { z } from "zod";
import { authorizePanelRequest, panelStore, hashToken, type PanelStore } from "./panel.server.ts";
import {
  currentImport,
  authorizeImport,
  importRows,
  importSources,
  enqueueImport,
  reviewImport,
  editImportRow,
} from "./import-store.server.ts";
import { filterImportRows, importCsv, importTotals, ImportProfileSchema } from "./imports.ts";
const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // Multipart uploads stay within the Netlify synchronous request limit. WhatsApp supports 25 MiB.
const Mutation = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("approve"),
      batchId: z.uuid(),
      revision: z.number().int(),
      ids: z.array(z.uuid()).max(10000).optional(),
      filter: z
        .object({
          query: z.string().max(160).optional(),
          sex: z.enum(["male", "female", ""]).optional(),
          year: z.string().max(4).optional(),
        })
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("edit"),
      batchId: z.uuid(),
      revision: z.number().int(),
      id: z.uuid(),
      profile: ImportProfileSchema,
      updateFields: z.array(z.string()).max(60).default([]),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["exclude", "cancel", "retry"]),
      batchId: z.uuid(),
      revision: z.number().int(),
      id: z.uuid().optional(),
    })
    .strict(),
]);
const response = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "Cookie, X-TPEC-Panel-Mode",
    },
  });
export async function handleImportPanel(
  request: Request,
  deps: { store?: PanelStore; enabled?: boolean } = {},
) {
  if (!(deps.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true"))
    return response({ error: "A importação está aguardando ativação." }, 503);
  const method = request.method;
  if (!["GET", "POST"].includes(method)) return response({ error: "Método não permitido." }, 405);
  if (
    method !== "GET" &&
    (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("x-tpec-panel") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return response({ error: "Solicitação não autorizada." }, 403);
  try {
    const identity = await authorizePanelRequest(request, deps.store);
    if (!identity)
      return response({ error: "Acesso expirado. Peça um novo código pelo WhatsApp." }, 401);
    if (!["owner", "manager", "technician"].includes(identity.role))
      return response({ error: "Seu perfil não permite importar animais." }, 403);
    if (method === "POST") {
      if (!(await (deps.store ?? panelStore).attempt(hashToken("import:" + identity.phone))))
        return response({ error: "Muitas solicitações. Aguarde um minuto." }, 429);
      const type = request.headers.get("content-type") ?? "";
      if (type.startsWith("multipart/form-data")) {
        const size = Number(request.headers.get("content-length"));
        if (!Number.isFinite(size) || size > MAX_IMPORT_BYTES + 16384)
          return response({ error: "O envio deve ter até 4 MB." }, 413);
        const form = await request.formData(),
          file = form.get("file");
        if (!(file instanceof File) || file.size > MAX_IMPORT_BYTES)
          return response({ error: "Escolha um PDF, imagem ou planilha de até 4 MB." }, 400);
        const id = await enqueueImport({
          phone: identity.phone,
          propertyId: identity.propertyId,
          messageId: "panel:" + crypto.randomUUID(),
          filename: file.name,
          mime: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
          instruction: "Preparar lista dos animais para revisão no painel.",
        });
        return response({
          ok: true,
          batchId: id,
          message: "Arquivo recebido. Vou juntar as páginas para conferência.",
        });
      }
      if (Number(request.headers.get("content-length")) > 100000)
        return response({ error: "Solicitação muito grande." }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 100000)
        return response({ error: "Solicitação muito grande." }, 413);
      const input = Mutation.parse(JSON.parse(raw));
      const { batch } = await authorizeImport(identity.phone, input.batchId);
      if (batch.property_id !== identity.propertyId)
        return response(
          {
            error:
              "Esta lista pertence a outra fazenda. Abra o painel daquela fazenda para continuar.",
          },
          403,
        );
      if (batch.revision !== input.revision)
        return response({ error: "A lista mudou. Atualize e confira novamente." }, 409);
      if (input.kind === "edit") {
        const row = (await importRows(batch.id)).find((r) => r.id === input.id);
        if (!row) return response({ error: "Linha não encontrada." }, 404);
        const allowed = new Set(Object.keys(ImportProfileSchema.shape));
        if (input.updateFields.some((k) => !allowed.has(k) || k === "code"))
          return response({ error: "Campos de atualização inválidos." }, 400);
        await editImportRow(identity.phone, batch, row, input.profile, input.updateFields);
      } else
        await reviewImport(
          identity.phone,
          batch,
          input.kind,
          input.kind === "approve"
            ? {
                ids:
                  input.ids ??
                  (input.filter
                    ? filterImportRows(await importRows(batch.id), {
                        ...input.filter,
                        sex: input.filter.sex || undefined,
                      }).map((r) => r.id)
                    : null),
              }
            : { id: input.id },
        );
      return response({
        ok: true,
        message:
          input.kind === "approve"
            ? "Autorização registrada. Confira o relatório após a gravação."
            : "Lista em preparação atualizada.",
      });
    }
    const url = new URL(request.url),
      id = url.searchParams.get("batch");
    const batch = id
      ? (await authorizeImport(identity.phone, id)).batch
      : await currentImport(identity.phone, identity.propertyId);
    if (!batch) return response({ batch: null, rows: [], files: [], total: 0 });
    if (batch.property_id !== identity.propertyId)
      return response({ error: "Lista de outra fazenda." }, 403);
    const rows = await importRows(batch.id),
      files = await importSources(batch.id);
    const view = {
      query: url.searchParams.get("q") ?? undefined,
      sex: (["male", "female"].includes(url.searchParams.get("sex") ?? "")
        ? url.searchParams.get("sex")
        : undefined) as "male" | "female" | undefined,
      year: url.searchParams.get("year") ?? undefined,
      sort: (["code", "rgn", "name"].includes(url.searchParams.get("sort") ?? "")
        ? url.searchParams.get("sort")
        : "code") as "code" | "rgn" | "name",
    };
    const selected = filterImportRows(rows, view),
      format = url.searchParams.get("export");
    if (format) {
      const headers = {
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        "content-disposition": `attachment; filename="animais-${batch.id}.${format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}"`,
      };
      if (format === "pdf")
        return new Response(await importPdf(selected, identity.book.name ?? "Fazenda"), {
          headers: { ...headers, "content-type": "application/pdf" },
        });
      if (format === "xlsx") {
        const XLSX = await import("xlsx");
        const sheet = XLSX.utils.json_to_sheet(
          selected.map((r) => ({
            ...r.profile,
            pedigree: r.profile.pedigree ? JSON.stringify(r.profile.pedigree) : undefined,
            pagina: r.page,
            situacao: r.status,
            pendencias: r.issues.join("; "),
          })),
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Animais");
        return new Response(new Uint8Array(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })), {
          headers: {
            ...headers,
            "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        });
      }
      return new Response(importCsv(selected), {
        headers: { ...headers, "content-type": "text/csv; charset=utf-8" },
      });
    }
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
    return response({
      batch: {
        id: batch.id,
        revision: batch.revision,
        status: batch.status,
        property_id: batch.property_id,
        report: batch.report,
        last_error: (batch as unknown as { last_error: string | null }).last_error,
      },
      rows: selected.slice((page - 1) * 25, page * 25),
      files,
      total: selected.length,
      totals: importTotals(rows),
      page,
    });
  } catch (e) {
    return response(
      {
        error:
          e instanceof z.ZodError
            ? "Confira os dados informados."
            : e instanceof Error && e.message === "import_access_denied"
              ? "Lista indisponível para esta sessão."
              : "Não foi possível confirmar esta etapa. A lista permanece guardada; atualize e tente novamente.",
      },
      e instanceof z.ZodError ? 400 : 503,
    );
  }
}
