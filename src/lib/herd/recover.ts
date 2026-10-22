import { emptyBook, reduceHerdTurn, type HerdBook } from "./book.ts";
export interface HerdSourceTurn {
  id: string;
  user_text: string;
}
/** Replay only original authenticated user inputs. Assistant summaries are never facts. */
export function recoverHerdSources(sources: HerdSourceTurn[], day: string): HerdBook {
  let book = emptyBook();
  let warnings = 0;
  for (const source of sources) {
    if (
      /^\[Mensagem recebida por (?:imagem|documento|vídeo)/i.test(source.user_text) ||
      /\|.*\||^##/m.test(source.user_text)
    ) {
      warnings++;
      continue;
    }
    const turn = reduceHerdTurn(book, source.user_text, `recovered:${source.id}`, day);
    if (turn) {
      if (
        /Não consegui identificar|Confirme|Qual campo|Já existe|sem substituição|Peso inválido/i.test(
          turn.reply,
        )
      )
        warnings++;
      book = turn.book;
    }
  }
  // A recovered list is always a draft requiring human reconciliation, never a verified close.
  book.recoveryWarnings = Math.max(1, warnings);
  book.pending = null;
  return book;
}
