import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleEnhancedWhatsAppWebhookRequest } from "../src/lib/whatsapp/enhanced-http.server.ts";
import {
  buildWhatsAppProgressPlan,
  friendlyWhatsAppError,
} from "../src/lib/whatsapp/presence.ts";
import type {
  WhatsAppControlRequest,
  WhatsAppControlResult,
} from "../src/lib/whatsapp/types.ts";

const appSecret = "meta-app-secret-for-presence-tests";
const env = {
  TPEC_BACKEND_MODE: "proxy",
  WHATSAPP_VERIFY_TOKEN: "verify-token-presence",
  WHATSAPP_APP_SECRET: appSecret,
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_GRAPH_API_VERSION: "v25.0",
};

type Stage = "processing" | "ready" | "delivery" | "delivered";
interface FakeMessageState {
  stage: Stage;
  reply?: string;
}

function fakeLifecycle() {
  const states = new Map<string, FakeMessageState>();
  const control = async (request: WhatsAppControlRequest): Promise<WhatsAppControlResult> => {
    const current = states.get(request.messageId);
    switch (request.action) {
      case "claim":
        if (!current) {
          states.set(request.messageId, { stage: "processing" });
          return { kind: "claimed" };
        }
        if (current.stage === "ready" && current.reply) {
          return { kind: "completed", reply: current.reply };
        }
        if (current.stage === "delivered") return { kind: "delivered" };
        return { kind: "processing" };
      case "complete":
        states.set(request.messageId, { stage: "ready", reply: request.reply });
        return { kind: "ok" };
      case "release":
        if (current?.stage === "processing") states.delete(request.messageId);
        return { kind: "ok" };
      case "claim_delivery":
        if (!current) return { kind: "missing" };
        if (current.stage === "delivered") return { kind: "delivered" };
        if (current.stage !== "ready" || !current.reply) return { kind: "processing" };
        states.set(request.messageId, { stage: "delivery", reply: current.reply });
        return { kind: "claimed", reply: current.reply };
      case "delivered":
        if (current?.stage === "delivery" && current.reply === request.reply) {
          states.set(request.messageId, { stage: "delivered" });
        }
        return { kind: "ok" };
      case "release_delivery":
        if (current?.stage === "delivery" && current.reply === request.reply) {
          states.set(request.messageId, { stage: "ready", reply: request.reply });
        }
        return { kind: "ok" };
    }
  };
  return { states, control };
}

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

function requestFor(text: string, messageId = "wamid.presence"): Request {
  const body = JSON.stringify(webhook(text, messageId));
  return new Request("https://tpecia.example/api/public/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature(body),
    },
    body,
  });
}

function graphCapture(target: string[], statusForCall?: (call: number) => number) {
  let call = 0;
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    call += 1;
    const body = JSON.parse(String(init?.body)) as { text?: { body?: string } };
    target.push(body.text?.body ?? "");
    const status = statusForCall?.(call) ?? 200;
    return new Response(JSON.stringify({ messages: [{ id: `wamid.out-${call}` }] }), { status });
  }) as typeof fetch;
}

test("plano de progresso é limitado a duas mensagens e não começa imediatamente", () => {
  const plan = buildWhatsAppProgressPlan(
    "Como está o mercado de carnes no Brasil hoje?",
    "wamid.market",
  );
  assert.equal(plan.length, 2);
  assert.equal(plan[0]?.delayMs, 900);
  assert.equal(plan[1]?.delayMs, 10_000);
  assert.ok((plan[0]?.text.length ?? 0) > 20);
  assert.notEqual(plan[0]?.text, plan[1]?.text);
});

test("cumprimento simples não dispara mensagens artificiais de pesquisa", () => {
  assert.deepEqual(buildWhatsAppProgressPlan("Oi", "wamid.oi"), []);
  assert.deepEqual(buildWhatsAppProgressPlan("Valeu!", "wamid.valeu"), []);
});

test("timeout vira aviso útil sem inventar resultado", () => {
  const error = Object.assign(new Error("whatsapp_proxy_timeout"), { status: 504 });
  assert.match(friendlyWhatsAppError(error), /não vou inventar um resultado/i);
});

test("resposta rápida é enviada sem mensagem de espera desnecessária", async () => {
  const sent: string[] = [];
  const lifecycle = fakeLifecycle();
  const messageId = "wamid.fast";
  const reply = "A resposta já ficou pronta.";

  const response = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Me explique o manejo de pasto", messageId),
    {
      env,
      fetchImpl: graphCapture(sent),
      controlMessage: lifecycle.control,
      dispatchChat: async () => {
        await lifecycle.control({ action: "complete", messageId, reply });
        return { reply, shouldSend: true, duplicate: false };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(sent, [reply]);
  assert.equal(lifecycle.states.get(messageId)?.stage, "delivered");
});

test("retry do mesmo webhook durante processamento não cria um segundo fluxo de progresso", async () => {
  const sent: string[] = [];
  const lifecycle = fakeLifecycle();
  const messageId = "wamid.loop-proof";
  const question = "Como está o mercado de carnes no Brasil hoje?";
  const finalReply = "O panorama atual foi confirmado com fontes recentes.";
  let dispatchCalls = 0;
  let finishDispatch!: () => Promise<void>;
  let markDispatchStarted!: () => void;
  const dispatchStarted = new Promise<void>((resolve) => {
    markDispatchStarted = resolve;
  });

  const dispatchChat = async () => {
    dispatchCalls += 1;
    markDispatchStarted();
    return new Promise<{ reply: string; shouldSend: true; duplicate: false }>((resolve) => {
      finishDispatch = async () => {
        await lifecycle.control({ action: "complete", messageId, reply: finalReply });
        resolve({ reply: finalReply, shouldSend: true, duplicate: false });
      };
    });
  };

  const first = handleEnhancedWhatsAppWebhookRequest(requestFor(question, messageId), {
    env,
    fetchImpl: graphCapture(sent),
    controlMessage: lifecycle.control,
    dispatchChat,
    sleepImpl: async () => undefined,
  });
  await dispatchStarted;
  await Promise.resolve();
  await Promise.resolve();

  const beforeRetry = sent.length;
  const retry = await handleEnhancedWhatsAppWebhookRequest(requestFor(question, messageId), {
    env,
    fetchImpl: graphCapture(sent),
    controlMessage: lifecycle.control,
    dispatchChat,
    sleepImpl: async () => undefined,
  });
  assert.equal(retry.status, 200);
  assert.equal(sent.length, beforeRetry);
  assert.equal(dispatchCalls, 1);

  await finishDispatch();
  const firstResponse = await first;
  assert.equal(firstResponse.status, 200);
  assert.equal(dispatchCalls, 1);
  assert.equal(sent.length, 3);
  assert.equal(sent.at(-1), finalReply);
  assert.equal(lifecycle.states.get(messageId)?.stage, "delivered");
});

test("falha na Graph API preserva a resposta pronta e retry não recalcula a IA", async () => {
  const attempted: string[] = [];
  const lifecycle = fakeLifecycle();
  const messageId = "wamid.delivery-retry";
  const reply = "Resposta calculada uma única vez.";
  let dispatchCalls = 0;
  const fetchImpl = graphCapture(attempted, (call) => (call === 1 ? 500 : 200));

  const first = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Pergunta simples sem pesquisa demorada", messageId),
    {
      env,
      fetchImpl,
      controlMessage: lifecycle.control,
      dispatchChat: async () => {
        dispatchCalls += 1;
        await lifecycle.control({ action: "complete", messageId, reply });
        return { reply, shouldSend: true, duplicate: false };
      },
    },
  );
  assert.equal(first.status, 200);
  assert.equal(lifecycle.states.get(messageId)?.stage, "ready");
  assert.equal(dispatchCalls, 1);

  const retry = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Pergunta simples sem pesquisa demorada", messageId),
    {
      env,
      fetchImpl,
      controlMessage: lifecycle.control,
      dispatchChat: async () => {
        dispatchCalls += 1;
        return { reply: "não deveria recalcular", shouldSend: true, duplicate: false };
      },
    },
  );
  assert.equal(retry.status, 200);
  assert.equal(dispatchCalls, 1);
  assert.deepEqual(attempted, [reply, reply]);
  assert.equal(lifecycle.states.get(messageId)?.stage, "delivered");
});

test("falha do backend vira uma única resposta visível e concluída", async () => {
  const sent: string[] = [];
  const lifecycle = fakeLifecycle();
  const messageId = "wamid.failure";
  const timeout = Object.assign(new Error("whatsapp_proxy_timeout"), { status: 504 });

  const response = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Como está o mercado hoje?", messageId),
    {
      env,
      fetchImpl: graphCapture(sent),
      controlMessage: lifecycle.control,
      dispatchChat: async () => {
        throw timeout;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /não vou inventar um resultado/i);
  assert.equal(lifecycle.states.get(messageId)?.stage, "delivered");
});
