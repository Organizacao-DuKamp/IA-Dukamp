import assert from "node:assert/strict";
import test from "node:test";
import {
  answerWhatsAppEmergency,
  emergencyFallback,
} from "../src/lib/whatsapp/emergency-answer.server.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { persistWhatsAppRetryPayload } from "../src/lib/whatsapp/retry-store.server.ts";
import { recordAIChatTurn } from "../src/lib/chat/analytics.server.ts";
import { repairMarketAnswer } from "../src/lib/chat/market-response.server.ts";
import { recoverStaleWhatsAppMessages } from "../src/lib/whatsapp/recovery.server.ts";

const question = "Gostaria de saber a perpectiva do mercado de boi para 2027";

test("validação reutiliza pesquisa inicial sem exigir outra pesquisa e recupera timeout", async () => {
  let recovered = false;
  const reply = await repairMarketAnswer(
    [{ role: "user", content: question }],
    { channel: "whatsapp", context: "Evidência recuperada" },
    "Resposta com preço sem data",
    ["market_price_without_explicit_date"],
    {
      askAI: async (_history, options) => {
        assert.equal(options.researchDepth, "none");
        assert.match(options.context ?? "", /Evidência recuperada/);
        assert.match(options.context ?? "", /Resposta com preço sem data/);
        throw new Error("timeout");
      },
      emergencyAnswer: async (text) => {
        recovered = true;
        return emergencyFallback(text);
      },
    },
  );
  assert.ok(recovered);
  assert.match(reply, /cenários condicionais/);
});

test("watcher envia resposta pronta sem gastar outra chamada de IA", async () => {
  const row = {
    messageId: "wamid.ready",
    phoneNumber: "5517999999999",
    reply: "Resposta já pesquisada",
  };
  let sent = 0,
    acknowledged = 0,
    released = 0;
  const env = { WHATSAPP_ACCESS_TOKEN: "fake", WHATSAPP_PHONE_NUMBER_ID: "fake" };
  const deps = {
    env,
    claimPending: async () => [row],
    claimStale: async () => [],
    markDelivered: async () => {
      acknowledged++;
    },
    releaseDelivery: async () => {
      released++;
    },
  };
  const success = await recoverStaleWhatsAppMessages({
    ...deps,
    fetchImpl: async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).text.body, row.reply);
      sent++;
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(success.recovered, 1);
  assert.equal(sent, 1);
  assert.equal(acknowledged, 1);
  const failure = await recoverStaleWhatsAppMessages({
    ...deps,
    fetchImpl: async () => new Response("{}", { status: 503 }),
  });
  assert.equal(failure.failed, 1);
  assert.equal(released, 1);
  await recoverStaleWhatsAppMessages({
    ...deps,
    fetchImpl: async () => new Response("{}", { status: 200 }),
    markDelivered: async () => {
      throw new Error("ack_failed");
    },
  });
  assert.equal(released, 1, "aceite da Graph sem ACK não libera reenvio imediato");
});

test("perspectiva do boi, incluindo erro de digitação, pesquisa no mesmo turno", () => {
  for (const text of [
    question,
    "Qual a perspectiva do boi para 2027?",
    "Cotação do boi gordo hoje",
  ]) {
    assert.equal(classifyDomainIntent(text).needs_web_search, true);
  }
  assert.equal(classifyDomainIntent("Cotação do boi gordo hoje").intent, "market_quote");
});

test("falha, vazio e provedor travado retornam cenários sem inventar cotação de 2027", async () => {
  for (const askAI of [
    async () => {
      throw new Error("network_or_format");
    },
    async () => "",
    () => new Promise<string>(() => {}),
  ]) {
    const reply = await answerWhatsAppEmergency(question, undefined, { askAI, timeoutMs: 10 });
    assert.match(reply, /2027/);
    assert.match(reply, /cenários condicionais/);
    assert.match(reply, /oferta|demanda/);
    assert.doesNotMatch(reply, /R\$|US\$|envie.*novamente/);
  }
});

test("falha de pesquisa salva pergunta e resposta alternativa no histórico e conclui entrega", async () => {
  const input = { phone: "5517999999999", messageId: "wamid.outlook-failure", text: question };
  let saved: { history: Array<{ role: string; content: string }> } | undefined;
  let completed: string | undefined;
  const previous = {
    conversationId: `wa:${input.phone}`,
    history: [{ role: "user" as const, content: "Meu gado é de corte" }],
  };
  const result = await processClaimedWhatsAppChat(input, {
    loadConversation: async () => previous,
    executeChat: async () => ({ status: 503, body: { error: "research_unavailable" } }),
    emergencyAnswer: async (text) => emergencyFallback(text),
    saveConversation: async (_phone, snapshot) => {
      saved = snapshot;
    },
    completeMessage: async (_id, reply) => {
      completed = reply;
    },
  });
  assert.equal(result.shouldSend, true);
  assert.equal(result.reply, completed);
  assert.deepEqual(
    saved?.history.map((m) => m.content),
    ["Meu gado é de corte", question, result.reply],
  );
});

test("falha ao salvar histórico não descarta uma resposta válida", async () => {
  const result = await processClaimedWhatsAppChat(
    { phone: "5517999999999", messageId: "wamid.save-failure", text: question },
    {
      loadConversation: async () => null,
      executeChat: async () => ({
        status: 200,
        body: {
          reply: "Resposta com dados confirmados.",
          conversationId: "wa:test",
          state: {},
          diagnostics: {},
        },
      }),
      saveConversation: async () => {
        throw new Error("database_unavailable");
      },
      completeMessage: async () => {},
      emergencyAnswer: async () => {
        throw new Error("não deve recalcular resposta válida");
      },
    },
  );
  assert.equal(result.reply, "Resposta com dados confirmados.");
  assert.equal(result.shouldSend, true);
});

test("entrada é registrada antes da análise e finalização atualiza o mesmo turno", async () => {
  const originalFetch = globalThis.fetch;
  const previousURL = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://tpec-tests.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  const calls: Array<{ url: string; body: Record<string, unknown>; prefer: string | null }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body)),
      prefer: new Headers(init?.headers).get("prefer"),
    });
    return new Response(null, { status: 204 });
  };
  try {
    const input = { phone: "5517999999999", messageId: "wamid.pending-test", text: question };
    await persistWhatsAppRetryPayload(input);
    assert.equal(calls[0].body.status, "pending");
    assert.equal(calls[0].body.user_text, question);
    assert.match(calls[0].prefer ?? "", /ignore-duplicates/);
    assert.match(calls[1].url, /whatsapp_processed_messages/);
    await recordAIChatTurn({
      channel: "whatsapp",
      sessionId: `wa:${input.phone}`,
      conversationId: `wa:${input.phone}`,
      clientMessageId: input.messageId,
      userText: question,
      assistantText: "Resposta recuperada",
      status: "completed",
      startedAt: new Date().toISOString(),
      durationMs: 1,
    });
    assert.equal(calls[2].body.id, calls[0].body.id);
    assert.equal(calls[2].body.assistant_text, "Resposta recuperada");
    assert.match(calls[2].prefer ?? "", /merge-duplicates/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousURL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousURL;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
