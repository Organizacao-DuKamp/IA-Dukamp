import { namedProperty } from "./property-scope.ts";
import { guardianStore, type GuardianStore } from "./store.server.ts";
import { isAnimalImportPdf, isAnimalImportSpreadsheet } from "./import-extract.server.ts";
import {
  currentImport,
  authorizeImport,
  importRows,
  importSources,
  enqueueImport,
  reviewImport,
  editImportRow,
} from "./import-store.server.ts";
import {
  awaitImportBurst,
  preparationImportView,
  filterImportRows,
  importTotals,
  ImportProfileSchema,
  type ImportView,
} from "./imports.ts";
import { fold } from "./book.ts";
import { naturalConfirmation } from "./farm-dialogue.ts";
import { downloadWhatsAppMedia } from "../whatsapp/media.server.ts";
import type { WhatsAppChatInput, WhatsAppChatResult } from "../whatsapp/types.ts";
export function animalImportIntent(text: string) {
  const t = fold(text);
  // A generic "lista" may be financial or a task list. Never route these
  // business-domain instructions through the animal document importer.
  if (
    /\b(?:despesas?|receitas?|financeiro|combustivel|abastecimento|tarefas?|pagamentos?|contas a pagar)\b/.test(
      t,
    )
  )
    return false;
  // Ordinary herd events ("registre dois nascimentos no rebanho") belong to
  // Guardian, NOT to the bulk animal-document importer.
  const verb =
    /\b(?:cadastr\w*|registr\w*|import\w*|adicion\w*|conf[ei]r\w*|atualiz\w*|junt\w*|mont\w*|transform\w*)\b/.test(
      t,
    );
  const source =
    /\b(?:lista|relacao|planilha|arquivos?|anexos?|documentos?|imagens?|fotos?|pdf|relatorios?|abcz|certificados?|importacao)\b/.test(
      t,
    );
  const herd = /\b(?:animais|gados?|rebanho|individuos)\b/.test(t);
  const explicitBulk = /\b(?:todos|todas|varios|varias)\b|em lote/.test(t);
  return verb && (source || (herd && (/\bimport\w*\b/.test(t) || explicitBulk)));
}

/** A finished batch is history, never a pending WhatsApp operation. */
export function importFollowupIntent(text: string, status: string | undefined): boolean {
  if (!status || status === "completed" || status === "cancelled") return false;
  const t = fold(text).trim();
  // Questions about tasks, expenses or herd events stay with their owners.
  // Only an explicit animal-document reference can override that boundary.
  if (
    /\b(?:tarefas?|despesas?|receitas?|financeiro|combustivel|abastecimento|nascimentos?|nasceram|nasceu)\b/.test(
      t,
    ) &&
    !/\b(?:importac\w*|lista (?:de|dos) animais|lista de gados?|pdf|arquivo|abcz)\b/.test(t)
  )
    return false;
  // An active import may be filtered, corrected or approved, but it must not
  // capture a new finance, task, or herd operation merely because it says
  // "registre", "confirmar", "nasceram" or "salvar".
  const importSubject =
    /\b(?:lista|relacao|importac\w*|planilha|arquivos?|anexos?|pdf|abcz|certificad\w*|imagens?|fotos?|pagin\w*|duplicad\w*|repetid\w*|genealog\w*|rgn)\b/.test(
      t,
    );
  const restrictedFilter =
    /^(?:(?:somente|so|apenas|filtrar?|mostrar?|separar?|listar?)\s+)?(?:as?\s+)?(?:femeas?|machos?|nascid\w*|sem identificacao|proxima pagina)\b/.test(
      t,
    );
  const uploadEnd =
    /^(?:terminei(?: de enviar)?|pronto|pode analisar|analisa(?: os arquivos)?)\b/.test(t);
  const explicitApproval =
    /^(?:(?:pode|agora)\s+)?(?:confirmar?|aprovar?|autorizar?|cadastrar?|salvar?)\b.*\b(?:lista|importac\w*|animais da lista|arquivos?|fichas?)\b/.test(
      t,
    );
  return importSubject || restrictedFilter || uploadEnd || explicitApproval;
}
export interface ImportInboundDependencies {
  enabled?: boolean;
  current?: typeof currentImport;
  store?: Pick<GuardianStore, "load" | "loadProperty">;
  download?: typeof downloadWhatsAppMedia;
  enqueue?: typeof enqueueImport;
  classifyPdf?: typeof isAnimalImportPdf;
}

const answer = (reply: string): WhatsAppChatResult => ({
  reply,
  shouldSend: true,
  duplicate: false,
});
const received = () =>
  answer(
    "Entendido! Já estou preparando os animais no painel. Pode aguardar — aviso quando terminar.",
  );
async function processAnimalImportInbound(
  input: WhatsAppChatInput,
  dependencies: ImportInboundDependencies = {},
): Promise<WhatsAppChatResult | null> {
  if (!(dependencies.enabled ?? process.env.TPEC_GUARDIAN_ENABLED === "true")) return null;
  const loadCurrent = dependencies.current ?? currentImport,
    store = dependencies.store ?? guardianStore,
    download = dependencies.download ?? downloadWhatsAppMedia,
    enqueue = dependencies.enqueue ?? enqueueImport;
  let downloaded: Awaited<ReturnType<typeof downloadWhatsAppMedia>> | undefined;
  const fileContent = async () => (downloaded ??= await download(input.media!, {}));
  const text = input.media?.caption || input.text,
    t = fold(text);
  if (input.media && !["image", "document"].includes(input.media.type)) return null;
  const intent =
    /(?:pega|extrai|transcrev).*(?:dados|lista).*(?:foto|imagem)/.test(t) ||
    animalImportIntent(text) ||
    (!!input.media &&
      /\b(?:cadastr\w*|registr\w*|import\w*|atualiz\w*)\b/.test(t) &&
      /\b(?:animal|animais|bovinos?|bezerros?|matrizes|novilhas?|touros?|fichas?)\b/.test(t)) ||
    /\b(?:vou (?:te )?(?:mandar|enviar).*(?:fotos|imagens|pdf|lista|dados dos? (?:gados?|animais))|(?:esses|sao os) animais)\b/.test(
      t,
    );
  // Most conversations aren't imports. Do not even query the import tables
  // for normal financial, herd, task or confirmation messages.
  if (!input.media && !intent && !importFollowupIntent(text, "review")) return null;
  let batch = await loadCurrent(input.phone);
  if (
    input.media?.type === "image" &&
    !intent &&
    (!batch || batch.status === "completed") &&
    !input.media.caption?.trim()
  ) {
    const arriving = await awaitImportBurst(async () => {
      const found = await loadCurrent(input.phone);
      return found && found.status !== "completed" ? found : null;
    });
    if (arriving) batch = arriving;
  }
  const continuation = !!batch && !["completed", "cancelled"].includes(batch.status);
  let candidate =
    !!input.media &&
    (intent ||
      (continuation && batch?.status !== "completed") ||
      /abcz|rebanho|gado|genealog|certificad/i.test(input.media.filename ?? ""));
  // Filenames and captions are optional hints, never the source of truth. Inspect
  // digital ABCZ reports before generic summarization can redirect them to web search.
  if (
    !candidate &&
    input.media?.type === "document" &&
    (input.media.mimeType === "application/pdf" || /\.pdf$/i.test(input.media.filename ?? ""))
  ) {
    const file = await fileContent();
    candidate = await (dependencies.classifyPdf ?? isAnimalImportPdf)(new Uint8Array(file.bytes));
  }
  if (
    !candidate &&
    input.media?.type === "document" &&
    (/\.(?:xlsx?|csv|tsv)$/i.test(input.media.filename ?? "") ||
      [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
        "text/tab-separated-values",
      ].includes(input.media.mimeType ?? ""))
  ) {
    const file = await fileContent();
    candidate = await isAnimalImportSpreadsheet(new Uint8Array(file.bytes));
  }
  if (input.media && !candidate) return null;
  // A finished batch is immutable. Only a new upload/import request starts
  // another one; "confirm this list" cannot approve an already finished job.
  if (
    batch?.status === "completed" &&
    !input.media &&
    !/\b(?:nov[oa]|outra|enviar|mandar|import\w*|cadastr\w*|registr\w*)\b/.test(t)
  )
    return null;
  // Confirmation without an explicit import reference belongs to the latest
  // conversational proposal; the importer must not steal it from Guardian.
  // This also excludes every completed import from unrelated future messages.
  if (!candidate && !intent && !importFollowupIntent(text, batch?.status)) return null;
  if (!candidate && !intent && batch?.status === "completed") return null;
  const snapshot = await store.load(input.phone);
  if (intent) {
    const requested = namedProperty(text, snapshot);
    if (requested && requested.id !== snapshot.active?.id)
      snapshot.active = await store.loadProperty!(input.phone, requested.id);
  }
  if (!snapshot.active)
    return answer(
      "Para preparar esta importação, primeiro selecione ou cadastre a fazenda de destino. O documento não escolhe a fazenda por você.",
    );
  if (!["owner", "manager", "technician"].includes(snapshot.active.role))
    return answer(
      "Seu acesso não permite importar animais. Peça ao proprietário, gerente ou técnico autorizado.",
    );
  if (batch && batch.property_id !== snapshot.active.id) {
    if (!intent) {
      if (candidate && input.media) {
        await authorizeImport(input.phone, batch.id);
        const file = await fileContent();
        await enqueue({
          phone: input.phone,
          propertyId: batch.property_id,
          messageId: input.messageId,
          filename: file.filename,
          mime: file.mimeType,
          bytes: new Uint8Array(file.bytes),
          instruction: "",
          sentAt: input.sentAt,
        });
        return received();
      }
      return answer(
        "A lista em preparação pertence a outra fazenda. Selecione aquela fazenda para retomar, sem misturar os dados.",
      );
    }
    batch = null;
  }
  if (candidate && input.media) {
    if (!batch || batch.status === "completed")
      await enqueue({
        phone: input.phone,
        propertyId: snapshot.active.id,
        messageId: "prepare:" + input.messageId.slice(0, 118),
        filename: "",
        mime: "",
        instruction: text,
        sentAt: input.sentAt,
      });
    const file = await fileContent();
    await enqueue({
      phone: input.phone,
      propertyId: snapshot.active.id,
      messageId: input.messageId,
      filename: file.filename,
      mime: file.mimeType,
      bytes: new Uint8Array(file.bytes),
      instruction: intent ? text : "",
      sentAt: input.sentAt,
    });
    return received();
  }
  if (!batch || batch.status === "completed" || batch.status === "cancelled") {
    if (!intent) return null;
    await enqueue({
      phone: input.phone,
      propertyId: snapshot.active.id,
      messageId: input.messageId,
      filename: "",
      mime: "",
      instruction: text,
    });
    return answer(
      `Certo. Envie os arquivos dos animais de ${snapshot.active.book.name}. Vou juntar as páginas numa lista para você conferir antes de cadastrar. Quando terminar, pode dizer “terminei de enviar”.`,
    );
  }
  await authorizeImport(input.phone, batch.id);
  const files = await importSources(batch.id);
  if (
    /^(?:terminei|pronto|pode analisar|analisa(?: os arquivos)?)/.test(t) &&
    !/cadastr|salvar/.test(t)
  ) {
    if (!files.length)
      return answer(
        "A preparação está guardada, mas ainda não há arquivo pronto para leitura neste lote. Se você já enviou, o recebimento ou a leitura pode ter falhado. Tente anexar as fotos ou o PDF novamente para continuar.",
      );
    if (["collecting", "review"].includes(batch.status))
      await reviewImport(input.phone, batch, "finish");
    return answer(
      `Recebi ${files.length} arquivo(s). Vou concluir a leitura do conjunto e enviar uma resposta consolidada. Nenhum animal será cadastrado sem sua confirmação.`,
    );
  }
  if (/tenta.*(?:nov|outra)|reprocess|tentar novamente/.test(t)) {
    await reviewImport(input.phone, batch, "retry");
    return answer(
      "Vou retomar a leitura dos arquivos com erro. Os dados já conferidos continuam guardados.",
    );
  }
  if (["collecting", "reading", "importing"].includes(batch.status)) {
    if (batch.status !== "importing" && (intent || /femea|macho|nascid/.test(t))) {
      await enqueue({
        phone: input.phone,
        propertyId: batch.property_id,
        messageId: input.messageId,
        filename: "",
        mime: "",
        instruction: text,
      });
      const current = await authorizeImport(input.phone, batch.id);
      await reviewImport(
        input.phone,
        current.batch,
        "view",
        preparationImportView(text, batch.view_state) as Record<string, unknown>,
      );
    }
    return answer(
      batch.status === "importing"
        ? "O cadastro autorizado está em andamento. As etapas concluídas ficam registradas para não repetir animais."
        : `Recebi ${files.length} arquivo(s) para a lista. A leitura do conjunto ainda está em andamento; os arquivos recebidos estão guardados.`,
    );
  }
  if (/atualiz.*genealog|genealog.*atualiz/.test(t) && batch.status === "review") {
    await reviewImport(input.phone, batch, "fields", { fields: ["pedigree", "sire", "dam"] });
    return answer(
      "Na lista em preparação, selecionei somente pai, mãe e genealogia para atualizar animais já existentes. Confira os dados e confirme quando estiver de acordo; pesos, lotes e outros campos serão preservados.",
    );
  }
  const rows = await importRows(batch.id);
  let view: ImportView = { ...batch.view_state };
  const target = (ref: string) =>
    rows.filter(
      (r) =>
        fold(r.profile.code ?? "") === fold(ref) ||
        (r.profile.code ?? "").match(/\d+$/)?.[0] === ref ||
        r.id === ref,
    );
  const change = text.match(
    /(?:corrig\w*|corrij\w*|alter\w*)\s+(?:o\s+)?nome\s+(?:d[oa]\s+)?(?:animal\s+)?([\w -]+?)\s+(?:para|pra|[ée])\s+(.+)$/i,
  );
  if (change) {
    const selected = target(change[1].trim());
    if (selected.length !== 1)
      return answer(
        "Qual é a identificação completa do animal? Não consegui escolher uma única linha.",
      );
    await editImportRow(
      input.phone,
      batch,
      selected[0],
      ImportProfileSchema.parse({ ...selected[0].profile, name: change[2].trim() }),
      selected[0].update_fields,
    );
    return answer(
      "Corrigi o nome na lista em preparação. O cadastro da fazenda ainda não foi alterado.",
    );
  }
  const remove = text.match(
    /(?:exclu\w*|remov\w*|tira)\s+(?:o\s+)?(?:animal|registro)?\s*([\w -]+?)\s*(?:da (?:lista|importacao))?[.! ]*$/i,
  );
  if (remove) {
    const selected = target(remove[1].trim());
    if (selected.length !== 1)
      return answer(
        "Informe a identificação completa de uma única linha para eu retirar da importação.",
      );
    await reviewImport(input.phone, batch, "exclude", { id: selected[0].id });
    return answer("Retirei essa linha da importação. Nenhum animal já cadastrado foi excluído.");
  }
  if (/cancelar.*(?:lista|import)|descart.*(?:lista|lote)/.test(t)) {
    await reviewImport(input.phone, batch, "cancel");
    return answer("A preparação foi cancelada. Os animais da fazenda foram preservados.");
  }
  if (/femea/.test(t)) view.sex = "female";
  else if (/machos?/.test(t)) view.sex = "male";
  if (/(?:lista geral|todos|todas|completa)/.test(t)) view = {};
  const year = t.match(/nascid\w* (?:em|no ano de) (20\d{2})/);
  if (year) view.year = year[1];
  if (/repetid|duplicad/.test(t)) view.duplicates = true;
  if (/sem identific/.test(t)) view.unidentified = true;
  if (/orden|separ/.test(t)) view.sort = /rgn/.test(t) ? "rgn" : /nome/.test(t) ? "name" : "code";
  const page = t.match(/(?:pagina|página) (\d+)/);
  if (page) view.page = Math.max(1, Number(page[1]));
  else if (/proxim/.test(t)) view.page = (view.page ?? 1) + 1;
  const shown = filterImportRows(rows, view);
  if (
    (/(?:pode |agora |confirma|autoriza|cadastre|cadastrar|importar|salvar)/.test(t) &&
      !/antes|primeiro|mostr|confere|ver |quero.*lista/.test(t)) ||
    naturalConfirmation(text)
  ) {
    const ready = shown.filter((r) => r.status === "review" && !r.issues.length);
    if (!ready.length)
      return answer(
        "Nenhuma linha desta seleção está pronta para cadastrar. Confira as pendências no painel.",
      );
    const requested = t.match(/(?:cadastr\w*|aprova\w*)\s+(?:os |as )?(\d+)/)?.[1];
    if (requested && Number(requested) !== ready.length)
      return answer(
        `Esta seleção contém ${ready.length} linhas aprováveis, diferente das ${requested} informadas. Confira a lista antes de confirmar.`,
      );
    await reviewImport(input.phone, batch, "approve", { ids: ready.map((r) => r.id) });
    return answer(
      `Autorizei o processamento de ${ready.length} registros conferidos para ${snapshot.active.book.name}. Vou confirmar os totais cadastrados somente depois da gravação no banco.`,
    );
  }
  await reviewImport(input.phone, batch, "view", view as Record<string, unknown>);
  if (/planilha|export|xlsx|csv|pdf/.test(t))
    return answer(
      "A lista completa está disponível em Importação de animais no painel da fazenda. Use Exportar CSV, Excel ou Imprimir para baixar todas as linhas, incluindo a origem.",
    );
  const totals = importTotals(rows),
    current = Math.min(view.page ?? 1, Math.max(1, Math.ceil(shown.length / 15)));
  return answer(
    `${batch.status === "completed" ? "Lista importada" : "Lista em preparação"}: ${totals.identified} registros no conjunto, ${totals.duplicates} repetidos. Nenhum cadastro é confirmado por esta lista.\nSeleção: ${shown.length} registros. Página ${current}/${Math.max(1, Math.ceil(shown.length / 15))}.\n` +
      shown
        .slice((current - 1) * 15, current * 15)
        .map(
          (r) =>
            `${r.profile.code ?? "Sem identificação"} — ${r.profile.name ?? "Sem nome"}, ${r.profile.sex === "female" ? "fêmea" : r.profile.sex === "male" ? "macho" : "sexo não informado"}${r.issues.length ? " (precisa de revisão)" : ""}`,
        )
        .join("\n") +
      "\nPode pedir a próxima página, filtrar, corrigir ou conferir a lista completa no painel antes de autorizar.",
  );
}

/** Import failures must always produce a useful response, never swallow an attachment. */
export async function handleAnimalImportInbound(
  input: WhatsAppChatInput,
  dependencies: ImportInboundDependencies = {},
): Promise<WhatsAppChatResult | null> {
  try {
    return await processAnimalImportInbound(input, dependencies);
  } catch {
    return answer(
      "Não consegui concluir a preparação da importação agora. Nenhum novo cadastro está confirmado. Confira a lista em Importação de animais no painel e tente enviar novamente o PDF ou Excel; os registros já salvos são preservados.",
    );
  }
}
