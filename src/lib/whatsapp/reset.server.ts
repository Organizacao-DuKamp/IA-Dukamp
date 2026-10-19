import { USER_MEMORY_EPOCH } from "../chat/memory-reset.ts";

type ResetClient = {
  rpc: (
    name: "reset_whatsapp_conversation",
    args: { p_phone: string; p_epoch: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function resetConversationMemory(client: ResetClient, phone: string) {
  if (!/^\d{6,20}$/.test(phone)) throw new Error("Número inválido.");
  const { data, error } = await client.rpc("reset_whatsapp_conversation", {
    p_phone: phone,
    p_epoch: USER_MEMORY_EPOCH,
  });
  if (error) {
    if (error.message.includes("conversation_busy")) {
      throw new Error("Há uma mensagem em processamento. Aguarde a resposta e tente novamente.");
    }
    if (error.message.includes("conversation_not_found")) {
      throw new Error("Não foi encontrada uma conversa para esse número.");
    }
    throw new Error("Não foi possível resetar a conversa. Tente novamente.");
  }
  if (typeof data !== "string" || !Number.isFinite(Date.parse(data))) {
    throw new Error("O serviço não confirmou o reset da conversa.");
  }
  return { resetAt: data };
}
