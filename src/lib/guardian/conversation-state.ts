import { normalizeState, type ConversationState } from "../chat/state.ts";
import { userStatement } from "../whatsapp/learned-notes.ts";
import type { GuardianTrace } from "./trace.ts";
/** Only the executor's commit receipt can advance operational conversation state. */
export function guardianConversationState(
  raw: unknown,
  conversationId: string,
  input: string,
  reply: string,
  trace?: GuardianTrace,
) {
  const state = normalizeState(raw as Partial<ConversationState>, conversationId);
  state.current_topic = "gestão da fazenda";
  state.user_goal = userStatement(input).slice(0, 300);
  state.conversation_summary = {
    ...state.conversation_summary,
    current_topic: state.current_topic,
    user_goal: state.user_goal,
  };
  // Generic NLP counters/registry guesses cannot override the selected property's book.
  delete state.confirmed_data.animal_registry_codes;
  delete state.confirmed_data.numero_animais;
  state.conversation_summary.known_facts = state.conversation_summary.known_facts.filter(
    (s) => !/^animal_registry_codes=|^numero_animais=|^correção: numero_animais/.test(s),
  );
  const pending = trace?.status === "pending" || trace?.status === "error";
  state.pending_question = pending ? reply.slice(0, 400) : null;
  state.pending_action = pending ? "guardian_pending" : null;
  state.pending_payload = null;
  state.awaiting_confirmation = false;
  state.awaiting_user_response = pending;
  state.expected_response_type = pending ? "free" : null;
  state.conversation_summary.pending_questions = pending ? [reply.slice(0, 300)] : [];
  state.conversation_summary.next_expected_action = pending
    ? "retomar a operação na Guardiã"
    : "aguardar novo pedido do produtor";
  if (trace?.status === "completed")
    state.conversation_summary.last_completed_action = trace.operationId;
  state.guardian = trace
    ? {
        propertyId: trace.propertyId,
        operationId: trace.operationId,
        status: trace.status,
        receiptMessageId: trace.receiptMessageId,
      }
    : state.guardian;
  state.version++;
  state.turn_count++;
  state.updated_at = new Date().toISOString();
  return state;
}
