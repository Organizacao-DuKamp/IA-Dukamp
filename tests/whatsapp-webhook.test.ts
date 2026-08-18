import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  processWhatsAppChat,
  WHATSAPP_CHANNEL_INSTRUCTION,
} from "../src/lib/whatsapp/conversation.server.ts";
import { buildWhatsAppProgressPlan } from "../src/lib/whatsapp/experience.ts";
import {
  handleInternalWhatsAppChatRequest,
  handleWhatsAppWebhookRequest,
} from "../src/lib/whatsapp/http.server.ts";
import type { ChatCoreResult, ChatInput } from "../src/lib/chat/input.ts";

const appSecret = "meta-app-secret-for-tests";
const proxySecret = "tpec-test-secret-" + "x".repeat(40);
const env = {
  TPEC_BACKEND_MODE: "proxy",
  WHATSAPP_VERIFY_TOKEN: "verify-token-123456789",
  WHATSAPP_APP_SECRET: appSecret,
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_GRAPH_API_VERSION: "v25.0",
};

function signature(body: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(body, "utf8").digest("hex")}`;
}

function textWebhook(text = "Oi, TPEC", messageId = "wamid.test-1") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+15550000000", phone_number_id: "1234567890" },
              messages: [
                {
                  from: "5517999999999",
                  id: messageId,
                  timestamp: "1786530000",
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function graphCapture(target: string[]) {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { text?: { body?: string } };
    target.push(payload.text?.body ?? "");
    return new Response(JSON.stringify({ messages: [{ id: "wamid.reply" }] }), { status: 200 });
  }) as typeof fetch;
}

test("verificação GET devolve hub.challenge com token correto", async () => {
  const response = await handleWhatsAppWebhookRequest(
    new Request(
      "https://tpecia.netlify.app/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token-123456789&hub.challenge=987654",
    ),
    { env },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "987654");
});

test("verificação GET rejeita token incorreto", async () => {
  const response = await handleWhatsAppWebhookRequest(
    new Request(
      "https://tpecia.netlify.app/api/public/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=987654",
    ),
    { env },
  );
  assert.equal(response.status, 403);
});

test("POST rejeita webhook sem assinatura válida", async () => {
  const body = JSON.stringify(textWebhook());
  let dispatched = false;
  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=bad" },
      body,
    }),
    {
      env,
      dispatchChat: async () => {
        dispatched = true;
        return { reply: "não deveria", shouldSend: true, duplicate: false };
      },
    },
  );
  assert.equal(response.status, 401);
  assert.equal(dispatched, false);
});

test("evento de status é reconhecido sem chamar a IA", async () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "1234567890" },
              statuses: [{ id: "wamid.outbound", status: "delivered" }],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(payload);
  let dispatched = false;
  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(body) },
      body,
    }),
    {
      env,
      dispatchChat: async () => {
        dispatched = true;
        return { reply: "não deveria", shouldSend: true, duplicate: false };
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(dispatched, false);
});

test("mensagem de texto entra na TPEC-IA e resposta volta pela Graph API", async () => {
  const body = JSON.stringify(textWebhook("Qual o preço do produto?"));
  let receivedInput: unknown;
  let graphUrl = "";
  let graphAuth = "";
  let graphBody: unknown;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    graphUrl = String(input);
    graphAuth = new Headers(init?.headers).get("authorization") ?? "";
    graphBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messages: [{ id: "wamid.reply" }] }), { status: 200 });
  }) as typeof fetch;

  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(body) },
      body,
    }),
    {
      env,
      fetchImpl,
      dispatchChat: async (input) => {
        receivedInput = input;
        return { reply: "Resposta da TPEC-IA", shouldSend: true, duplicate: false };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(receivedInput, {
    phone: "5517999999999",
    messageId: "wamid.test-1",
    text: "Qual o preço do produto?",
  });
  assert.equal(graphUrl, "https://graph.facebook.com/v25.0/1234567890/messages");
  assert.equal(graphAuth, "Bearer test-access-token");
  assert.deepEqual(graphBody, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "5517999999999",
    type: "text",
    text: { preview_url: false, body: "Resposta da TPEC-IA" },
  });
});

test("consulta lenta conversa com o usuário antes da resposta final", async () => {
  const question = "Como está o mercado de carnes no Brasil hoje?";
  const messageId = "wamid.slow-market";
  const body = JSON.stringify(textWebhook(question, messageId));
  const outbound: string[] = [];

  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(body) },
      body,
    }),
    {
      env,
      fetchImpl: graphCapture(outbound),
      sleepImpl: async () => undefined,
      progressDelaysMs: [1, 1, 1],
      dispatchChat: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          reply: "O mercado está firme, com exportações sustentando parte da demanda.",
          shouldSend: true,
          duplicate: false,
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(outbound.slice(0, 3), [...buildWhatsAppProgressPlan(question, messageId)]);
  assert.equal(
    outbound.at(-1),
    "O mercado está firme, com exportações sustentando parte da demanda.",
  );
});

test("timeout do backend vira mensagem para o usuário em vez de silêncio", async () => {
  const body = JSON.stringify(textWebhook("Como está o mercado de carnes no Brasil hoje?"));
  const outbound: string[] = [];
  const timeout = Object.assign(new Error("O backend demorou para responder"), {
    code: "whatsapp_proxy_timeout",
    status: 504,
  });

  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(body) },
      body,
    }),
    {
      env,
      fetchImpl: graphCapture(outbound),
      dispatchChat: async () => {
        throw timeout;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(outbound.length, 1);
  assert.match(outbound[0], /n[aã]o quero te deixar no v[aá]cuo/i);
});

test("resposta vazia recebe fallback visível no WhatsApp", async () => {
  const body = JSON.stringify(textWebhook("Me explique a situação do mercado"));
  const outbound: string[] = [];

  const response = await handleWhatsAppWebhookRequest(
    new Request("https://tpecia.netlify.app/api/public/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature(body) },
      body,
    }),
    {
      env,
      fetchImpl: graphCapture(outbound),
      dispatchChat: async () => ({ reply: "", shouldSend: true, duplicate: false }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(outbound.length, 1);
  assert.match(outbound[0], /resposta voltou vazia/i);
});

test("ponte local preserva histórico, estado e idempotência", async () => {
  const previous = {
    conversationId: "wa:5517999999999",
    history: [
      { role: "user" as const, content: "Oi" },
      { role: "assistant" as const, content: "Olá!" },
    ],
    state: { current_topic: "produto" },
  };
  let sentToCore: ChatInput | undefined;
  let saved: unknown;
  let completed: unknown;
  const core: ChatCoreResult = {
    reply: "Claro, qual produto?",
    state: { current_topic: "produto", turn_count: 2 },
    conversationId: "wa:5517999999999",
    diagnostics: { model: "sonar" },
  };

  const result = await processWhatsAppChat(
    { phone: "5517999999999", messageId: "wamid.local-1", text: "Quero saber o preço" },
    {
      claimMessage: async () => ({ kind: "claimed" }),
      loadConversation: async () => previous,
      executeChat: async (input) => {
        sentToCore = input;
        return { status: 200, body: core };
      },
      saveConversation: async (_phone, snapshot) => {
        saved = snapshot;
      },
      completeMessage: async (messageId, reply) => {
        completed = { messageId, reply };
      },
      releaseMessage: async () => undefined,
    },
  );

  assert.equal(result.reply, "Claro, qual produto?");
  assert.deepEqual(sentToCore, {
    sessionId: "wa:5517999999999",
    conversationId: "wa:5517999999999",
    clientMessageId: "wamid.local-1",
    text: "Quero saber o preço",
    history: [
      ...previous.history,
      { role: "system", content: WHATSAPP_CHANNEL_INSTRUCTION },
    ],
    state: previous.state,
  });
  assert.deepEqual(saved, {
    conversationId: "wa:5517999999999",
    state: { current_topic: "produto", turn_count: 2 },
    history: [
      ...previous.history,
      { role: "user", content: "Quero saber o preço" },
      { role: "assistant", content: "Claro, qual produto?" },
    ],
  });
  assert.deepEqual(completed, {
    messageId: "wamid.local-1",
    reply: "Claro, qual produto?",
  });
});

test("novo oi em conversa existente não reapresenta a TPEC-IA", async () => {
  const previous = {
    conversationId: "wa:5517999999999",
    history: [
      { role: "user" as const, content: "Qual o preço do boi China?" },
      { role: "assistant" as const, content: "A referência mais recente é R$ 350/@." },
    ],
    state: { current_topic: "cotações" },
  };
  let executed = false;
  let saved: unknown;

  const result = await processWhatsAppChat(
    { phone: "5517999999999", messageId: "wamid.returning-hi", text: "Oi" },
    {
      claimMessage: async () => ({ kind: "claimed" }),
      loadConversation: async () => previous,
      executeChat: async () => {
        executed = true;
        return { status: 500, body: {} };
      },
      saveConversation: async (_phone, snapshot) => {
        saved = snapshot;
      },
      completeMessage: async () => undefined,
      releaseMessage: async () => undefined,
    },
  );

  assert.equal(executed, false);
  assert.match(result.reply ?? "", /t[oô] por aqui/i);
  assert.doesNotMatch(result.reply ?? "", /sou a TPEC-IA/i);
  assert.deepEqual((saved as { state?: unknown }).state, previous.state);
});

test("mensagem já concluída reutiliza resposta sem chamar o modelo", async () => {
  let executed = false;
  const result = await processWhatsAppChat(
    { phone: "5517999999999", messageId: "wamid.duplicate", text: "Oi" },
    {
      claimMessage: async () => ({ kind: "completed", reply: "Resposta já pronta" }),
      executeChat: async () => {
        executed = true;
        return { status: 500, body: {} };
      },
    },
  );
  assert.equal(executed, false);
  assert.deepEqual(result, { reply: "Resposta já pronta", duplicate: true, shouldSend: true });
});

test("endpoint interno exige segredo e só funciona no backend local", async () => {
  const body = JSON.stringify({
    phone: "5517999999999",
    messageId: "wamid.internal",
    text: "Olá",
  });
  const localEnv = { TPEC_BACKEND_MODE: "local", TPEC_PROXY_SECRET: proxySecret };

  const unauthorized = await handleInternalWhatsAppChatRequest(
    new Request("https://lovable.example/api/internal/whatsapp-chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tpec-proxy-hop": "1" },
      body,
    }),
    { env: localEnv },
  );
  assert.equal(unauthorized.status, 401);

  const authorized = await handleInternalWhatsAppChatRequest(
    new Request("https://lovable.example/api/internal/whatsapp-chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-hop": "1",
        "x-tpec-proxy-secret": proxySecret,
      },
      body,
    }),
    {
      env: localEnv,
      processLocal: async () => ({
        reply: "Olá pelo WhatsApp",
        duplicate: false,
        shouldSend: true,
      }),
    },
  );
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    reply: "Olá pelo WhatsApp",
    duplicate: false,
    shouldSend: true,
  });
});