import { guardianStore } from "./store.server.ts";
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
  return /\b(?:cadastr\w*|import\w*|adicion\w*|conf[ei]r\w*|atualiz\w*|junt\w*|mont\w*|transform\w*)\b.*\b(?:animais|gados?|rebanho|abcz|individuos|lista|relacao|imagens|fotos|pdf)\b/.test(
    fold(text),
  );
}
const answer = (reply: string): WhatsAppChatResult => ({
  reply,
  shouldSend: true,
  duplicate: false,
});
const quiet = (): WhatsAppChatResult => ({ shouldSend: false, duplicate: false });
export async function handleAnimalImportInbound(
  input: WhatsAppChatInput,
): Promise<WhatsAppChatResult | null> {
  if (process.env.TPEC_GUARDIAN_ENABLED !== "true") return null;
  const text = input.media?.caption || input.text,
    t = fold(text);
  if (input.media && !["image", "document"].includes(input.media.type)) return null;
  let batch = await currentImport(input.phone);
  const intent =
    /(?:pega|extrai|transcrev).*(?:dados|lista).*(?:foto|imagem)/.test(t) ||
    animalImportIntent(text) ||
    /\b(?:vou (?:te )?(?:mandar|enviar).*(?:fotos|imagens|pdf|lista)|(?:esses|sao os) animais)\b/.test(
      t,
    );
  const continuation = !!batch;
  const candidate =
    !!input.media &&
    (intent ||
      continuation ||
      /abcz|rebanho|gado|genealog|certificad/i.test(input.media.filename ?? ""));
  if (
    !candidate &&
    !intent &&
    !(continuation && naturalConfirmation(text)) &&
    !(
      continuation &&
      /lista|animais|gados?|lote|registro|rgn|femeas?|machos?|nascid|termin|pronto|analis|pode|salv|confirm|isso|sim|corrig|corrij|exclu|remov|repetid|identific|planilha|export|orden|tenta|arquivo|pdf|imagem|fotos/.test(
        t,
      )
    )
  )
    return null;
  const snapshot = await guardianStore.load(input.phone);
  if (!snapshot.active)
    return answer(
      "Para preparar esta importação, primeiro selecione ou cadastre a fazenda de destino. O documento não escolhe a fazenda por você.",
    );
  if (!["owner", "manager", "technician"].includes(snapshot.active.role))
    return answer(
      "Seu acesso não permite importar animais. Peça ao proprietário, gerente ou técnico autorizado.",
    );
  if (batch && batch.property_id !== snapshot.active.id) {
    if (!intent && !candidate)
      return answer(
        "A lista em preparação pertence a outra fazenda. Selecione aquela fazenda para retomar, sem misturar os dados.",
      );
    batch = null;
  }
  if (candidate && input.media) {
    const file = await downloadWhatsAppMedia(input.media, {});
    await enqueueImport({
      phone: input.phone,
      propertyId: snapshot.active.id,
      messageId: input.messageId,
      filename: file.filename,
      mime: file.mimeType,
      bytes: new Uint8Array(file.bytes),
      instruction: intent ? text : "",
      sentAt: input.sentAt,
    });
    return quiet();
  }
  if (!batch || (batch.status === "completed" && intent && /\bnov[oa]\b/.test(t))) {
    if (!intent) return null;
    await enqueueImport({
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
  if (/termin|^pronto|pode analisar|analisa/.test(t) && !/cadastr|salvar/.test(t)) {
    if (!files.length)
      return answer(
        "A preparação está guardada, mas nenhum arquivo chegou a este lote. Anexe as fotos ou o PDF para continuar.",
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
      await enqueueImport({
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
