import { automaticFarmEvent } from "./automatic.ts";
import { recordActions, recordDialogue } from "./record-dialogue.ts";
import { foldHerd } from "./herd-language.ts";
import type { GuardianSnapshot } from "./schema.ts";
import type { ChatMessage } from "../chat/types.ts";

export type FarmSelectionRequest =
  | { kind: "choose" }
  | { kind: "named"; name: string };

/**
 * Selection is a server-side membership operation. The model must never
 * invent an ID, pick a printed farm name, or select by a vague approximation.
 */
export function farmSelectionRequest(text: string): FarmSelectionRequest | null {
  const phrase = foldHerd(text).trim().replace(/[.!]+$/, "").trim();
  const selected = phrase.match(
    /^(?:selecionar|selecione|usar|use|abrir|abra|trocar para|mudar para)\s+(?:a\s+)?fazenda(?:\s+(.+))?$/,
  );
  if (!selected) return null;
  const name = selected[1]?.trim();
  return name ? { kind: "named", name } : { kind: "choose" };
}

/**
 * Run only literal, unambiguous operations through the existing transactional
 * executor. No new write path or bypass of permissions/deduplication is added.
 */
export function canExecuteWithoutSemanticAI(
  input: { text: string; mediaType?: string; at: Date; history?: ChatMessage[] },
  snapshot: GuardianSnapshot,
): boolean {
  if (!snapshot.active || snapshot.pending || (input.mediaType && input.mediaType !== "audio"))
    return false;
  const statement = foldHerd(input.text);
  // A future budget or hypothetical is not a verified monthly expense.
  if (
    /\b(?:previsao|previst\w*|planej\w*|orcamento|pretendo|projet\w*|quero gastar|se eu)\b/.test(
      statement,
    )
  )
    return false;
  const record = recordDialogue(input.text, input.at, input.mediaType);
  if (record.kind === "slots" && record.slots.section === "finance") {
    const actions = recordActions(record.slots);
    if (actions?.length && actions.every((action) => action.kind === "ledger")) return true;
  }
  const observation = automaticFarmEvent(input, snapshot);
  if (observation.status !== "action" && observation.status !== "batch") return false;
  const actions =
    observation.status === "action" ? [observation.action] : observation.actions;
  return (
    actions.length > 0 &&
    actions.every((action) => action.kind === "ledger" || action.kind === "herd_event")
  );
}

/**
 * A failed "why did it fail?" explanation must not keep a subsequent independent
 * birth/expense trapped in that clarification. Only narrow diagnostic drafts
 * are released; genuine proposals, herd follow-ups and confirmations are kept.
 */
export function isFreshActionAfterErrorQuestion(
  input: { text: string; at: Date; mediaType?: string; history?: ChatMessage[] },
  snapshot: GuardianSnapshot,
): boolean {
  const pending = snapshot.pending;
  if (pending?.kind !== "semantic_draft" || !snapshot.active) return false;
  const question = foldHerd(pending.question ?? "");
  if (!/^qual problema voce quer verificar\b/.test(question)) return false;
  const withoutDiagnosticDraft = { ...snapshot, pending: null };
  return canExecuteWithoutSemanticAI(input, withoutDiagnosticDraft);
}

export function explainPreviousFarmFailure(
  text: string,
  history: ChatMessage[] = [],
): string | null {
  const question = foldHerd(text).replace(/[.!?]+$/, "").trim();
  if (
    !/^(?:por ?que (?:deu|aconteceu|esta dando|ocorreu) (?:esse |o )?(?:erro|problema)|por ?que (?:nao|n) (?:funcionou|salvou|registrou)|o que (?:houve|deu errado|aconteceu)|qual foi (?:o erro|o problema))$/.test(
      question,
    )
  )
    return null;
  const last = history.at(-1);
  if (last?.role !== "assistant") return null;
  const answer = foldHerd(last.content);
  const priorUser = history.at(-2)?.role === "user" ? foldHerd(history.at(-2)!.content) : "";
  if (/nenhuma linha desta selecao esta pronta|na lista em preparacao/.test(answer)) {
    if (
      /\b(?:confirmar|confirme|nascimentos?|bezerros?)\b/.test(priorUser) &&
      history.slice(-6).some((m) => m.role === "user" && /\b(?:nasceu|nasceram|bezerros?)\b/.test(foldHerd(m.content)))
    )
      return "A confirmação anterior foi direcionada para a lista de importação de animais, não para o registro dos bezerros. Não tenho recibo de novos nascimentos dessa confirmação; é preciso conferir o rebanho antes de tentar de novo.";
    return "O módulo de importação não encontrou registros preparados para aprovação. Nenhuma alteração nova está confirmada. Se o pedido era de outra área da fazenda, ele não deveria ter sido tratado como importação.";
  }
  if (/nao consegui confirmar esta etapa da importacao/.test(answer))
    return "A tentativa anterior falhou no módulo de importação. Não existe confirmação de gravação desse pedido. O erro é técnico; antes de repetir, precisamos consultar os recibos para não duplicar registros.";
  if (
    /nao consegui (?:acessar|salvar|confirmar|concluir)|deu um problema|falha(?: na| ao)|nenhuma nova operacao esta confirmada/.test(
      answer,
    )
  )
    return "Houve uma falha técnica na tentativa anterior e o sistema não confirmou a gravação. Esta conversa não traz a causa interna exata, então não vou inventá-la nem dizer que foi salvo. O registro deve ser conferido antes de uma nova tentativa.";
  return null;
}
