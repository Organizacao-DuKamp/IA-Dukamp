import { withAIUsageContext } from "../chat/usage.server.ts";
import { recordAIChatTurn } from "../chat/analytics.server.ts";
import { modelImportPage } from "./import-extract.server.ts";
import { createHash } from "node:crypto";
import { guardianDb, guardianStore } from "./store.server.ts";
import { importRpc, importRows, importSources, authorizeImport } from "./import-store.server.ts";
import {
  identityKey,
  importIssues,
  importTotals,
  prepareImportRow,
  type ImportBatch,
  type ImportRow,
} from "./imports.ts";
import { extractImportPages } from "./import-extract.server.ts";
import { applyFarmAction } from "./book.ts";
import { FarmBookSchema } from "./schema.ts";

async function checked(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query;
  if (error) throw Error("import_persistence_failed");
}
async function renew(b: ImportBatch) {
  const { data, error } = await (
    await guardianDb()
  )
    .from("guardian_import_batches")
    .update({ lease_until: new Date(Date.now() + 600000).toISOString() })
    .eq("id", b.id)
    .eq("lease_token", b.lease_token)
    .select("id");
  if (error || !data?.length) throw Error("import_lease_lost");
}
async function readBatch(b: ImportBatch, deadline: number) {
  const { farm } = await authorizeImport(b.phone_number, b.id);
  for (const file of await importSources(b.id, true)) {
    if (Date.now() > deadline) return;
    if (!["queued", "reading"].includes(file.status)) continue;
    await renew(b);
    await checked(
      (await guardianDb())
        .from("guardian_import_sources")
        .update({ status: "reading", attempts: file.attempts + 1 })
        .eq("id", file.id),
    );
    let failedPage = false,
      lastPage = file.completed_pages;
    try {
      for await (const page of extractImportPages(
        Buffer.from(file.data_base64 ?? "", "base64"),
        file.filename,
        file.mime,
        file.completed_pages + 1,
        (attachment) =>
          withAIUsageContext(async (events) => {
            let success = false;
            const startedAt = new Date().toISOString(),
              start = Date.now();
            try {
              const raw = await modelImportPage(attachment);
              success = true;
              return raw;
            } finally {
              await recordAIChatTurn({
                channel: "whatsapp",
                sessionId: `wa:${b.phone_number}`,
                conversationId: `wa:${b.phone_number}`,
                clientMessageId:
                  `read:${file.id}:${file.attempts}:` +
                  createHash("sha256")
                    .update(attachment.name ?? "page")
                    .digest("hex")
                    .slice(0, 12),
                userText: "Leitura de página para lista de animais em preparação.",
                assistantText: "Extração para revisão; sem cadastro de animais nesta etapa.",
                status: success ? "completed" : "error",
                usageEvents: [...events],
                startedAt,
                durationMs: Date.now() - start,
              });
            }
          }),
      )) {
        await renew(b);
        lastPage = page.page;
        const { data: done, error: doneError } = await (await guardianDb())
          .from("guardian_import_pages")
          .select("issues")
          .eq("source_id", file.id)
          .eq("page", page.page)
          .maybeSingle();
        if (doneError) throw Error("import_page_unavailable");
        if (done && !done.issues.length) continue;
        if (page.failed) failedPage = true;
        const rows = page.profiles.map((profile, i) => ({
          batch_id: b.id,
          source_id: file.id,
          page: page.page,
          ordinal: i + 1,
          profile,
          issues: [...page.issues, ...importIssues(profile, farm.book)],
        }));
        if (rows.length)
          await checked(
            (await guardianDb())
              .from("guardian_import_rows")
              .upsert(rows, { onConflict: "source_id,page,ordinal", ignoreDuplicates: true }),
          );
        await checked(
          (await guardianDb())
            .from("guardian_import_pages")
            .upsert(
              { source_id: file.id, page: page.page, issues: page.issues },
              { onConflict: "source_id,page" },
            ),
        );
        await checked(
          (await guardianDb())
            .from("guardian_import_sources")
            .update({ completed_pages: page.page })
            .eq("id", file.id),
        );
        if (Date.now() > deadline) return;
      }
      await checked(
        (await guardianDb())
          .from("guardian_import_sources")
          .update({
            pages: lastPage,
            status: failedPage ? "error" : "complete",
            error: failedPage
              ? "Uma ou mais páginas falharam. As páginas lidas estão preservadas. Tente ler novamente ou envie só os trechos pendentes."
              : null,
          })
          .eq("id", file.id),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Leitura indisponível.";
      await checked(
        (await guardianDb())
          .from("guardian_import_sources")
          .update({
            status: "error",
            error: message.startsWith("Não foi possível")
              ? "O provedor de leitura falhou ou excedeu o tempo. A lista parcial foi preservada; peça para tentar novamente."
              : message.slice(0, 500),
          })
          .eq("id", file.id),
      );
    }
  }
  // Classify duplicate source rows without dropping either origin. Divergent duplicates require review.
  const rows = await importRows(b.id),
    seen = new Map<string, ImportRow>();
  for (const r of rows) {
    if (r.status !== "review") continue;
    const k = identityKey(r.profile);
    if (!k) continue;
    const previous = seen.get(k);
    if (previous) {
      const canonical = (p: unknown) => JSON.stringify(p, Object.keys(p as object).sort());
      const identical = canonical(previous.profile) === canonical(r.profile);
      if (!identical)
        await checked(
          (await guardianDb())
            .from("guardian_import_rows")
            .update({
              issues: [
                ...new Set([
                  ...previous.issues,
                  "Identificação repetida com dados divergentes; confira as duas linhas.",
                ]),
              ],
            })
            .eq("id", previous.id),
        );
      await checked(
        (await guardianDb())
          .from("guardian_import_rows")
          .update(
            identical
              ? { status: "duplicate", result: "Repetido na lista; origem preservada." }
              : {
                  issues: [
                    ...r.issues,
                    "Identificação repetida com dados divergentes; confira as duas linhas.",
                  ],
                },
          )
          .eq("id", r.id),
      );
    } else seen.set(k, r);
  }
}
async function commitBatch(b: ImportBatch, deadline: number) {
  for (let loop = 0; loop < 100; loop++) {
    if (Date.now() > deadline) return;
    await renew(b);
    const rows = (await importRows(b.id)).filter((r) => r.status === "approved").slice(0, 20);
    if (!rows.length) return;
    const snapshot = await guardianStore.load(b.phone_number),
      { farm } = await authorizeImport(b.phone_number, b.id);
    const id =
      "import:" +
      b.id +
      ":" +
      createHash("sha256")
        .update(rows.map((r) => r.id).join(":"))
        .digest("hex")
        .slice(0, 24);
    let book = farm.book;
    const results = [];
    for (const r of rows) {
      let prepared = prepareImportRow(r, book);
      if (prepared.action) {
        try {
          const applied = applyFarmAction(
            book,
            prepared.action,
            farm.role,
            { messageId: id, actor: b.phone_number, at: new Date().toISOString(), confirmed: true },
            r.id,
          );
          book = applied.book;
        } catch (e) {
          prepared = {
            status: "error",
            result: e instanceof Error ? e.message : "Registro precisa de revisão.",
          };
        }
      }
      results.push({ id: r.id, status: prepared.status, result: prepared.result });
    }
    const result = await importRpc("guardian_import_commit", {
      p_phone: b.phone_number,
      p_batch: b.id,
      p_revision: b.revision,
      p_account_version: snapshot.accountVersion,
      p_property_version: farm.version,
      p_message: id,
      p_book: FarmBookSchema.parse(book),
      p_results: results,
      p_reply: "Etapa de importação confirmada no banco.",
      p_pending: snapshot.pending,
    });
    if (result === "conflict") continue;
    if (result !== "committed" && !(typeof result === "string" && result.startsWith("replay:")))
      throw Error("import_commit_unconfirmed");
  }
  throw Error(
    "A importação continua na próxima execução; os registros concluídos foram preservados.",
  );
}
export async function runAnimalImports() {
  const deadline = Date.now() + 240000;
  const batches = (await importRpc("guardian_import_claim", {})) as ImportBatch[];
  const summary = { claimed: batches.length, finished: 0, failed: 0 };
  for (const b of batches) {
    try {
      if (b.status === "importing") await commitBatch(b, deadline);
      else await readBatch(b, deadline);
      const rows = await importRows(b.id),
        files = await importSources(b.id),
        report = {
          ...importTotals(rows),
          files: files.length,
          fileErrors: files.filter((f) => f.status === "error").length,
        };
      const reply =
        b.status === "importing"
          ? `Importação concluída: ${report.created} cadastrados, ${report.updated} atualizados, ${report.duplicates} repetidos e ${report.pending} pendentes de revisão. Confira o relatório em /painelfazenda.`
          : `Recebi ${report.files} arquivo(s). Identifiquei ${report.identified} registros; ${report.validated} passaram pela validação, ${report.duplicates} são repetições e ${report.fileErrors} arquivo(s) tiveram falha. A lista está em preparação, sem cadastrar animais. Você pode pedir “mostra a lista”, corrigir ou conferir em /painelfazenda antes de autorizar o cadastro.`;
      if (
        await importRpc("guardian_import_finish", {
          p_batch: b.id,
          p_token: b.lease_token,
          p_revision: b.revision,
          p_report: report,
          p_reply: reply,
        })
      )
        summary.finished++;
    } catch {
      summary.failed++;
      await importRpc("guardian_import_fail", { p_batch: b.id, p_token: b.lease_token });
    } finally {
      await checked(
        (await guardianDb())
          .from("guardian_import_batches")
          .update({ lease_until: null, ready_at: new Date(Date.now() + 12000).toISOString() })
          .eq("id", b.id)
          .eq("lease_token", b.lease_token),
      );
    }
  }
  // Raw uploads are temporary. Review records, page references and audit remain available.
  await checked(
    (await guardianDb())
      .from("guardian_import_sources")
      .update({ data_base64: "" })
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .neq("data_base64", ""),
  );
  return summary;
}
