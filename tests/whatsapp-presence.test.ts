import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleEnhancedWhatsAppWebhookRequest } from "../src/lib/whatsapp/enhanced-http.server.ts";
import {
  buildWhatsAppProgressPlan,
  friendlyWhatsAppError,
  humanizeWhatsAppReply,
} from "../src/lib/whatsapp/presence.ts";

const appSecret = "meta-app-secret-for-presence-tests";
const env = {
  TPEC_BACKEND_MODE: "proxy",
  WHATSAPP_APP_SECRET: appSecret,
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_GRAPH_API_VERSION: "v25.0",
};

function signature(body: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(body, "utf8").digest("hex")}`;
}

function webhook(text: string, messageId = "wamid.presence") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "1234567890" },
              messages: [
                {
                  from: "5517999999999",
                  id: messageId,
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

function requestFor(text: string): Request {
  const body = JSON.stringify(webhook(text));
  return new Request("https://tpecia.example/api/public/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature(body),
    },
    body,
  });
}

test("pergunta de mercado recebe uma conversa de progresso em vez de silêncio", () => {
  const plan = buildWhatsAppProgressPlan("Como está o mercado de carnes no Brasil hoje?");
  assert.equal(plan.length, 3);
  assert.equal(plan[0]?.delayMs, 0);
  assert.match(plan[0]?.text ?? "", /conferir os dados mais recentes/i);
  assert.equal(plan[1]?.delayMs, 8_000);
  assert.equal(plan[2]?.delayMs, 18_000);
});

test("cumprimento simples não dispara mensagens artificiais de pesquisa", () => {
  assert.deepEqual(buildWhatsAppProgressPlan("Oi"), []);
  assert.equal(
    humanizeWhatsAppReply(
      "Oi",
      "Oi! Sou a TPEC-IA, assistente da Dukamp. Como posso te ajudar hoje — dúvidas sobre produtos, manejo, vendedores ou preços?",
    ),
    "Oi! 👋 Tô por aqui. Pode mandar o que você quer saber.",
  );
});

test("timeout vira aviso útil para o usuário", () => {
  const error = Object.assign(new Error("whatsapp_proxy_timeout"), { status: 504 });
  assert.match(friendlyWhatsAppError(error), /demorou mais do que deveria/i);
});

test("webhook envia aviso imediato e depois a resposta final", async () => {
  const sent: string[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { text?: { body?: string } };
    sent.push(body.text?.body ?? "");
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 });
  }) as typeof fetch;

  const response = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Como está o mercado de carnes no Brasil hoje?"),
    {
      env,
      fetchImpl,
      dispatchChat: async () => ({
        reply: "O mercado está firme hoje.",
        shouldSend: true,
        duplicate: false,
      }),
      setTimeoutImpl: (() => 1 as unknown as ReturnType<typeof setTimeout>) as typeof setTimeout,
      clearTimeoutImpl: (() => undefined) as typeof clearTimeout,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(sent.length, 2);
  assert.match(sent[0] ?? "", /dados mais recentes/i);
  assert.equal(sent[1], "O mercado está firme hoje.");
});

test("falha do backend nunca deixa a pergunta sem resposta no WhatsApp", async () => {
  const sent: string[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { text?: { body?: string } };
    sent.push(body.text?.body ?? "");
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), { status: 200 });
  }) as typeof fetch;

  const timeout = Object.assign(new Error("whatsapp_proxy_timeout"), { status: 504 });
  const response = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Como está o mercado de carnes no Brasil hoje?"),
    {
      env,
      fetchImpl,
      dispatchChat: async () => {
        throw timeout;
      },
      setTimeoutImpl: (() => 1 as unknown as ReturnType<typeof setTimeout>) as typeof setTimeout,
      clearTimeoutImpl: (() => undefined) as typeof clearTimeout,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(sent.length, 2);
  assert.match(sent[0] ?? "", /dados mais recentes/i);
  assert.match(sent[1] ?? "", /não consegui concluir agora/i);
});
