import assert from "node:assert/strict";
import test from "node:test";

import { processWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import type { ChatCoreResult, ChatInput } from "../src/lib/chat/input.ts";

test("WhatsApp usa memória quando SUPABASE_SERVICE_ROLE_KEY não está configurada", async () => {
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousStore = process.env.WHATSAPP_STATE_STORE;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.WHATSAPP_STATE_STORE;

  const phone = `551799999${Date.now().toString().slice(-4)}`;
  const seen: ChatInput[] = [];
  let turn = 0;

  const executeChat = async (input: ChatInput) => {
    seen.push(input);
    turn += 1;
    const result: ChatCoreResult = {
      reply: turn === 1 ? "Claro, vou verificar." : "Continuando a conversa.",
      state: { current_topic: "teste", turn_count: turn },
      conversationId: `wa:${phone}`,
      diagnostics: { model: "test" },
    };
    return { status: 200, body: result };
  };

  try {
    const first = await processWhatsAppChat(
      {
        phone,
        messageId: `wamid.memory-${Date.now()}-1`,
        text: "Quero saber sobre suplementos para bezerros",
      },
      { executeChat },
    );
    assert.equal(first.reply, "Claro, vou verificar.");
    assert.deepEqual(seen[0]?.history, []);

    const second = await processWhatsAppChat(
      { phone, messageId: `wamid.memory-${Date.now()}-2`, text: "E agora?" },
      { executeChat },
    );
    assert.equal(second.reply, "Continuando a conversa.");
    assert.deepEqual(seen[1]?.history, [
      { role: "user", content: "Quero saber sobre suplementos para bezerros" },
      { role: "assistant", content: "Claro, vou verificar." },
    ]);
  } finally {
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousStore === undefined) delete process.env.WHATSAPP_STATE_STORE;
    else process.env.WHATSAPP_STATE_STORE = previousStore;
  }
});
