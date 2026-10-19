import assert from "node:assert/strict";
import test from "node:test";
import { resetConversationMemory } from "../src/lib/whatsapp/reset.server.ts";
import { USER_MEMORY_EPOCH } from "../src/lib/chat/memory-reset.ts";

test("reset usa o número exato e a geração atual de memória", async () => {
  const result = await resetConversationMemory(
    {
      rpc: async (name, args) => {
        assert.equal(name, "reset_whatsapp_conversation");
        assert.deepEqual(args, { p_phone: "5500000000001", p_epoch: USER_MEMORY_EPOCH });
        return { data: "2026-10-19T14:10:00Z", error: null };
      },
    },
    "5500000000001",
  );
  assert.equal(result.resetAt, "2026-10-19T14:10:00Z");
});

test("reset rejeita número parcial ou inválido antes de acessar o banco", async () => {
  for (const phone of ["8921", "%8921", "+5516994118921", "", "1".repeat(21)]) {
    await assert.rejects(
      resetConversationMemory(
        {
          rpc: () => {
            throw new Error("DB called");
          },
        },
        phone,
      ),
      /Número inválido/,
    );
  }
});

test("reset informa processamento em andamento sem expor erro interno", async () => {
  await assert.rejects(
    resetConversationMemory(
      {
        rpc: async () => ({ data: null, error: { message: "conversation_busy" } }),
      },
      "5500000000001",
    ),
    /Aguarde a resposta/,
  );
  await assert.rejects(
    resetConversationMemory(
      {
        rpc: async () => ({ data: null, error: { message: "internal sensitive detail" } }),
      },
      "5500000000001",
    ),
    /^Error: Não foi possível resetar/,
  );
});

test("reset não confirma sucesso sem retorno válido do banco", async () => {
  await assert.rejects(
    resetConversationMemory(
      {
        rpc: async () => ({ data: null, error: null }),
      },
      "5500000000001",
    ),
    /não confirmou/,
  );
});
