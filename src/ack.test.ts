import { describe, it, expect } from "vitest";
import { classifyUserIntent, createConversationState, type ConversationState } from "./src/lib/chat/state";

const idle = () => createConversationState("c1");
const pending = (): ConversationState => ({
  ...createConversationState("c1"),
  pending_question: "Quer que eu calcule a quantidade?",
  pending_action: "calcular",
  awaiting_user_response: true,
  awaiting_confirmation: true,
  current_topic: "suplemento",
});

const ack = ["Hummmm, entendi.", "Ah sim.", "Legal.", "Obrigado.", "faz sentido", "agora entendi", "tá bom", "ok", "isso mesmo", "beleza", "hmm", "certo", "interessante", "valeu!", "show"];
const notAck = ["Entendi, mas qual dessas opções é mais barata?", "Ah sim, e quanto estava em Itapeva?", "não entendi", "como assim", "qual o preço da soja?"];

describe("acknowledgement", () => {
  it("classifies pure reactions as user_acknowledgement", () => {
    for (const m of ack) expect([m, classifyUserIntent(m, idle()).intent]).toEqual([m, "user_acknowledgement"]);
  });
  it("does not swallow new requests", () => {
    for (const m of notAck) expect([m, classifyUserIntent(m, idle()).intent]).not.toEqual([m, "user_acknowledgement"]);
  });
  it("pending question wins over acknowledgement", () => {
    expect(classifyUserIntent("Pode ser.", pending()).intent).toBe("resposta_a_confirmacao");
    expect(classifyUserIntent("ok", pending()).intent).toBe("resposta_a_confirmacao");
  });
  it("stops the pipeline", () => {
    const a = classifyUserIntent("entendi", idle());
    expect(a.shouldSearch).toBe(false);
    expect(a.shouldContinueTopic).toBe(false);
    expect(a.requiresInformationalAnswer).toBe(false);
  });
});
