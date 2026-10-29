import { fuelObservation, fuelTopic } from "./fuel-language.ts";
import { cardinal, foldHerd, herdStatement } from "./herd-language.ts";
import { hasEventVerb, eventDay } from "./herd-event-language.ts";
import { localDay } from "../chat/context/recall.ts";
import { recordDialogue, recordActions, missingRecordSlot } from "./record-dialogue.ts";
import {
  managementDialogue,
  managementActions,
  managementQuestion,
} from "./management-dialogue.ts";
import type { GuardianAction, GuardianSnapshot } from "./schema.ts";

/** Intent families are additive: finding a herd event must not suppress a payment,
 * note or an edit in the same message. All returned actions still use domain validation.
 */
export function complementaryFarmGoals(
  text: string,
  known: GuardianAction[],
  s: GuardianSnapshot,
  phone: string,
  at: Date,
) {
  const actions = [...known];
  let question: string | undefined;
  const add = (items: GuardianAction[]) => {
    for (const a of items)
      if (!actions.some((existing) => JSON.stringify(existing) === JSON.stringify(a)))
        actions.push(a);
  };
  const fuel = fuelTopic(text) ? fuelObservation(text, at) : null;
  const dialogue = recordDialogue(fuel?.status === "actions" ? fuel.residual : text, at);
  if (dialogue.kind === "slots") {
    const records = recordActions(dialogue.slots);
    if (records) add(records.filter((a) => !actions.some((existing) => existing.kind === a.kind)));
    else question = missingRecordSlot(dialogue.slots)?.question;
  }
  const management = managementDialogue({ text, phone, at }, s);
  if (management) {
    const edits = managementActions(management);
    if (edits) add(edits);
    else question = managementQuestion(management, s);
  }
  // Notebook commands are independent of a purchase/payment earlier in the utterance.
  for (const m of text.matchAll(
    /\b(?:anote|anota|registre|registra)\s+(?:no caderno(?: de campo)?\s+)?(?:que\s+)?[^;.!?]+/gi,
  )) {
    const note = recordDialogue(m[0], at);
    if (note.kind !== "slots" || note.slots.section !== "field") continue;
    const records = recordActions(note.slots);
    if (records) add(records);
    else question = missingRecordSlot(note.slots)?.question;
  }
  return { actions, question };
}

/** Fill a missing record slot without asking the producer to repeat the reminder. */
export function compoundRestAnswer(original: string, answer: string, at: Date) {
  const statement = herdStatement(original),
    t = foldHerd(answer).replace(/[.!?]+$/g, "");
  if (hasEventVerb(answer) || /\b(?:paguei|recebi|despesa|receita)\b/.test(t)) return answer;
  if (
    /^(?:(?:sim|sao|e)\s*[, ]*|(?:os animais sao|sao todos)\s+)*(?:bovinos|gados?|bois|bezerros)[.! ]*$/.test(
      t,
    )
  ) {
    const count = [...statement.matchAll(/\b(\d+)\s+(?:animais|animal|gados?|bovinos?)\b/gi)];
    const verbs = [
      ...statement.matchAll(
        /\b(comprei|compramos|vendi|vendemos|nasceram|nasceu|morreram|morreu)\b/gi,
      ),
    ];
    const day = eventDay(statement, at);
    if (count.length === 1 && verbs.length === 1 && !day.invalid && !day.ambiguous)
      return `${verbs[0][1]} ${count[0][1]} bovinos em ${day.day ?? localDay(at)}`;
  }
  const n = cardinal(t.replace(/\s+(?:animais|bezerros|bovinos)$/, ""));
  if (n && !/\b\d+\s+(?:animais|bezerros|bovinos|gados)\b/.test(statement))
    return statement.replace(
      /\b(nasceram|nasceu|morreram|morreu|comprei|compramos|vendi|vendemos)\s+/i,
      `$1 ${n} `,
    );
  return `${original} ${answer}`;
}
