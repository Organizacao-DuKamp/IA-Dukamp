import { userStatement } from "../whatsapp/learned-notes.ts";
import { foldHerd } from "./herd-language.ts";
import type { GuardianSnapshot } from "./schema.ts";
import type { ChatMessage } from "../chat/types.ts";

// Recognize the intent, independently of the verb conjugation or the medium.
const taskSource = String.raw`(?:me\s+(?:lembr[ae]|avis[ae]r?|record[ae]|mand[ae](?:\s+uma)?\s+mensagem)|lembr[ae]-me|(?:cri[ae]r?|adicion[ae]r?|coloc[ae]r?|registr[ae]r?)\s+(?:(?:um[ao]?|duas?|tr[eê]s|quatro|\d+)\s+)?(?:tarefas?|lembretes?)|agend[ae]r?)`;
export function taskMarkers(text: string) {
  return [...text.matchAll(new RegExp(`\\b${taskSource}\\b`, "gi"))];
}
export function hasTaskIntent(text: string) {
  return taskMarkers(userStatement(text)).length > 0;
}
export function taskReference(text: string) {
  const t = foldHerd(userStatement(text));
  return /\b(?:a tarefa|o lembrete|essa tarefa|esse lembrete|voce me manda mensagem|voce me avisa|registre.*painel|registra.*painel)\b/.test(
    t,
  );
}

/** A conversational continuation may use only a producer turn tied to persisted evidence.
 * Assistant promises alone never authorize a write or prove an earlier operation.
 */
export function recoverTaskContext(
  text: string,
  history: ChatMessage[] | undefined,
  s: GuardianSnapshot,
  now: Date,
) {
  if ((!taskReference(text) && !hasTaskIntent(text)) || !s.active || !history) return null;
  const movements = (s.active.book.operations?.movements ?? []).filter(
    (m) =>
      ["birth", "purchase"].includes(m.type) &&
      now.getTime() - Date.parse(m.source.at) <= 30 * 60000 &&
      now.getTime() >= Date.parse(m.source.at),
  );
  for (const turn of [...history].reverse().slice(0, 16)) {
    if (turn.role !== "user") continue;
    const original = userStatement(turn.content),
      markers = taskMarkers(original);
    if (!markers.length) continue;
    const literal = foldHerd(original).replace(/[.!? ]+$/, "");
    if (!taskReference(text) && foldHerd(userStatement(text)).replace(/[.!? ]+$/, "") !== literal)
      continue;
    const related = movements.filter((m) => {
      const quote = foldHerd(m.description).replace(/[.!? ]+$/, "");
      return quote.length >= 20 && (literal.startsWith(quote) || quote === literal);
    });
    const sources = new Set(related.map((m) => m.source.messageId));
    if (sources.size !== 1) continue;
    const entry = related[0];
    return {
      text: original,
      sourceMessageId: entry.source.messageId,
      sourceAt: entry.source.sourceAt ?? entry.source.at,
    };
  }
  return null;
}
