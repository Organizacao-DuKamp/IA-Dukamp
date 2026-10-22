import { recallPeriod, localDay } from "../chat/context/recall.ts";
import { recoverHerdSources } from "./recover.ts";
import {
  emptyBook,
  fold,
  herdSessionStart,
  isExplicitAnimalLookup,
  isHerdReport,
  isHerdSummary,
  reduceHerdTurn,
  parseHerdEntry,
  entryLine,
} from "./book.ts";
import { durableHerdStore, type HerdStore } from "./store.server.ts";

const unavailable =
  "Não consegui confirmar a gravação dos registros agora. Não confirmei inclusão, correção nem fechamento de totais. Seus registros anteriores permanecem preservados; tente novamente em instantes.";
export interface HerdHandled {
  reply: string;
  day: string;
}
export function herdDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (s: string) => parts.find((p) => p.type === s)!.value;
  return `${read("year")}-${read("month")}-${read("day")}`;
}
export function herdCandidate(text: string): boolean {
  return (
    /importacao/.test(fold(text)) ||
    herdSessionStart(text) ||
    isHerdReport(text) ||
    /\b[A-Za-z]{2,6}\s*\d{1,5}\b/.test(text) ||
    /\b(kg|kilos?|quilos?|femea|macho|sexo|corrij\w*|corrig\w*|registr\w*|insemin\w*|ensemin\w*|vacin\w*|vermifugo|lote|salv\w*|guard\w*)\b/.test(
      fold(text),
    ) ||
    /^(sim|nao|ok|peso|\d|todas?|todos?|ignore|continuar)/.test(fold(text))
  );
}
export async function handleHerdMessage(
  input: {
    phone: string;
    messageId: string;
    text: string;
    mediaType?: string;
    requestText?: string;
    previousDay?: string;
  },
  deps: { store?: HerdStore; now?: Date } = {},
): Promise<HerdHandled | null> {
  if (
    !herdCandidate(input.text) ||
    isExplicitAnimalLookup(
      input.mediaType && input.mediaType !== "audio" ? (input.requestText ?? "") : input.text,
    )
  )
    return null;
  const now = deps.now ?? new Date();
  const currentDay = localDay(now);
  const readAnimal = /\b(historico|evolucao|compare|comparar|qual.*peso|peso d[ao])\b/.test(
    fold(input.text),
  );
  const reads = isHerdReport(input.text) || readAnimal || /importacao/.test(fold(input.text));
  const period = reads ? recallPeriod(input.text, now) : null;
  // Historical selection is read-only; new entries always go to today's book.
  const followup =
    reads &&
    !period &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.previousDay ?? "") &&
    /\b(dess[ea]|ess[ea]|mesm[ao]|em pdf|em excel|confirmar importacao|cancelar importacao)\b/.test(
      fold(input.text),
    );
  const day = period?.startDay ?? (followup ? input.previousDay! : currentDay);
  if (period && Date.parse(period.endDay) - Date.parse(period.startDay) > 86400000) return null;
  if (!/^\d{6,20}$/.test(input.phone)) throw new Error("invalid_herd_owner");
  const store = deps.store ?? durableHerdStore;
  try {
    const previousReceipt = await store.receipt(input.phone, input.messageId);
    if (previousReceipt) return { reply: previousReceipt, day };
    for (let attempt = 0; attempt < 4; attempt++) {
      const saved = await store.load(input.phone, day);
      const book = saved?.data ?? emptyBook();
      const herdSubject =
        isHerdSummary(input.text) ||
        /\b(gado|rebanho|animais|animal|bovin\w*|pesag\w*|pesad\w*|brincos?|lote|vacas?)\b/.test(
          fold(input.text),
        );
      const genericHerdReport =
        /^(?:(?:faca|mostre|mande|envie) (?:a |o )?)?(?:lista geral|listagem|relatorio geral|resumo geral)(?: de \d{1,2}\/\d{1,2}(?:\/20\d{2})?)?[.!? ]*$/.test(
          fold(input.text),
        );
      if (
        !input.mediaType &&
        isHerdReport(input.text) &&
        !herdSubject &&
        !followup &&
        !genericHerdReport
      )
        return null;
      if (readAnimal && store.animalHistory && !input.mediaType) {
        const target = parseHerdEntry(input.text, book, input.messageId);
        if (target) {
          const history = await store.animalHistory(input.phone, target.code, day);
          return {
            reply: history.length
              ? `Histórico salvo de ${target.code} (até 1.000 datas):\n` +
                history
                  .map(
                    (item) =>
                      `${item.day.split("-").reverse().join("/")}: ${entryLine(item.entry)}`,
                  )
                  .join("\n")
              : `Não encontrei registros estruturados de ${target.code} até esta data. Não vou deduzir dados de outro animal nem pesquisar genealogia.`,
            day,
          };
        }
      }
      if (isHerdReport(input.text) && book.importDraft)
        return {
          reply:
            `Há uma prévia pendente de conferência com ${book.importDraft.length} animais. Eles ainda não foram incluídos.\n` +
            book.importDraft.map(entryLine).join("\n") +
            "\nConfirme com CONFIRMAR IMPORTACAO DE " +
            day.split("-").reverse().join("/") +
            " ou cancele a importação.",
          day,
        };
      if ((input.mediaType && input.mediaType !== "audio") || /\|/.test(input.text)) {
        const draft = input.text.split(/\n/).flatMap((line, index) => {
          const cleaned = line
            .replace(/^\s*\|?\s*\d+\s*[.|]\s*/, "")
            .replace(/\|/g, " ")
            .trim();
          const e = parseHerdEntry(cleaned, book, `${input.messageId}:${index}`);
          return e && e.weight !== null && /\d/.test(cleaned) ? [e] : [];
        });
        if (!book.active && !herdSessionStart(input.text) && !draft.length) return null;
        if (!draft.length)
          return {
            reply:
              "Recebi a mídia, mas não extraí linhas individuais com segurança. Nenhum animal foi alterado. Envie uma imagem mais legível ou os códigos e pesos em texto/áudio.",
            day,
          };
        if (draft.length > 1000)
          return {
            reply:
              "Divida a tabela em arquivos de até 1.000 animais. Nenhum registro foi alterado.",
            day,
          };
        const preview = { ...book, importDraft: draft };
        const reply =
          `Prévia para conferência: ${draft.length} linhas extraídas da mídia; ainda não incluídas nos registros. Confira códigos, pesos e possíveis linhas ausentes.\n` +
          draft.map(entryLine).join("\n") +
          "\nPara incluir somente essas linhas, responda CONFIRMAR IMPORTACAO. Para descartar, CANCELAR IMPORTACAO. Códigos existentes serão preservados.";
        if (reply.length > 110000)
          return {
            reply:
              "A prévia é muito grande. Divida a tabela em partes menores. Nenhum animal foi alterado.",
            day,
          };
        const committed = await store.commit({
          phone: input.phone,
          day,
          version: saved?.version ?? 0,
          messageId: input.messageId,
          book: preview,
          reply,
          sourceText: input.text,
        });
        if (committed === "conflict") continue;
        if (committed === "committed") return { reply, day };
        if (committed.startsWith("replay:")) return { reply: committed.slice(7), day };
        throw new Error("herd_commit_unconfirmed");
      }
      if (!saved && isHerdReport(input.text) && store.sources) {
        const sourceBook = recoverHerdSources(await store.sources(input.phone, day), day);
        if (sourceBook.entries.length) {
          const draft = {
            ...book,
            active: true,
            importDraft: sourceBook.entries,
            recoveryWarnings: sourceBook.recoveryWarnings,
          };
          const reply =
            `Recuperei as mensagens originais desta data. Esta é uma reconstrução PARCIAL para conferência: ${sourceBook.entries.length} animais identificados, com ${sourceBook.recoveryWarnings} ou mais pontos a revisar. Não use os totais antigos como fechamento validado.\n` +
            sourceBook.entries.map(entryLine).join("\n") +
            "\nConfira os lançamentos, fotos, correções e possíveis ausências. Para incluir esses registros estruturados, responda CONFIRMAR IMPORTACAO DE " +
            day.split("-").reverse().join("/") +
            ". Códigos existentes não serão substituídos.";
          if (reply.length > 110000)
            return {
              reply:
                "O histórico desta data é grande demais para uma única prévia. Solicite a recuperação por lotes menores. Nenhum animal foi alterado.",
              day,
            };
          const committed = await store.commit({
            phone: input.phone,
            day,
            version: 0,
            messageId: input.messageId,
            book: draft,
            reply,
            sourceText: input.text,
          });
          if (committed === "conflict") continue;
          if (committed === "committed") return { reply, day };
          if (committed.startsWith("replay:")) return { reply: committed.slice(7), day };
          throw new Error("herd_commit_unconfirmed");
        }
      }
      // The general recall layer may find narrative notes or documents that the strict parser cannot read.
      if (!saved && isHerdReport(input.text)) return null;
      const turn = reduceHerdTurn(
        book,
        input.text.replace(
          /(confirmar|cancelar) importacao de \d{2}\/\d{2}\/20\d{2}/i,
          "$1 importacao",
        ),
        input.messageId,
        day,
      );
      if (!turn) return null;
      const latest = turn.book.entries.find((e) => e.key === turn.book.lastKey);
      if (
        latest &&
        latest.weight !== null &&
        store.animalHistory &&
        turn.reply.startsWith("Registrado:")
      ) {
        const history = await store.animalHistory(input.phone, latest.code, day);
        const prior = history.find((h) => h.day < day && h.entry.weight !== null);
        if (prior) {
          const delta = latest.weight - prior.entry.weight!;
          turn.reply += `\nPesagem anterior de ${latest.code}: ${prior.entry.weight} kg em ${prior.day.split("-").reverse().join("/")}${prior.entry.estimated ? " (estimado)" : ""}; diferença ${delta.toLocaleString("pt-BR")} kg.`;
        }
      }
      const committed = await store.commit({
        phone: input.phone,
        day,
        version: saved?.version ?? 0,
        messageId: input.messageId,
        book: turn.book,
        reply: turn.reply,
        sourceText: input.text,
      });
      if (committed === "conflict") continue;
      if (committed === "committed") return { reply: turn.reply, day };
      // A duplicate request returns the response atomically saved by the first worker.
      if (committed.startsWith("replay:")) return { reply: committed.slice(7), day };
      throw new Error("herd_commit_unconfirmed");
    }
  } catch {
    return { reply: unavailable, day };
  }
  return { reply: unavailable, day };
}
