import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { handleEnhancedWhatsAppWebhookRequest } from "../src/lib/whatsapp/enhanced-http.server.ts";
import type {
  WhatsAppControlRequest,
  WhatsAppControlResult,
} from "../src/lib/whatsapp/types.ts";

const appSecret = "meta-app-secret-readable-delivery";
const env = {
  TPEC_BACKEND_MODE: "proxy",
  WHATSAPP_APP_SECRET: appSecret,
  WHATSAPP_ACCESS_TOKEN: "test-access-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_GRAPH_API_VERSION: "v25.0",
};

function requestFor(text: string, messageId: string): Request {
  const payload = {
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
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", appSecret).update(body, "utf8").digest("hex")}`;
  return new Request("https://tpecia.example/api/public/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature,
    },
    body,
  });
}

test("entrega longa usa várias bolhas em limites semânticos", async () => {
  const messageId = "wamid.readable-weather";
  const reply = [
    "## Monte Aprazível — previsão",
    "",
    "**Hoje (27/08)**\nMáxima de 33 °C e mínima de 27 °C. Tempo seco na maior parte do dia, com baixa chance de chuva durante a tarde.",
    "",
    "**Amanhã (28/08)**\nO calor continua, com máxima perto de 34 °C. A chance de chuva segue baixa e não há indicação de volume significativo.",
    "",
    "**Próximos dias**\nEntre sábado e segunda, as máximas podem ficar entre 35 e 38 °C. A mudança mais provável aparece na terça, quando cresce a chance de chuva.",
    "",
    "**Chuva**\nOs modelos ainda divergem sobre o volume previsto. A leitura mais segura é de chuva fraca a moderada, sem cravar um único valor agora.",
    "",
    "**Pecuária**\nO ponto de atenção é o calor da tarde. Água disponível e sombra ajudam a reduzir o estresse térmico do rebanho durante os horários mais quentes.",
    "",
    "Atualizado em 27/08/2026, 14:11 (Brasília). Fontes: INMET, ECMWF, GFS e ICON.",
  ].join("\n");

  let stage: "empty" | "processing" | "ready" | "delivery" | "delivered" = "empty";
  let storedReply = "";
  const control = async (request: WhatsAppControlRequest): Promise<WhatsAppControlResult> => {
    switch (request.action) {
      case "claim":
        stage = "processing";
        return { kind: "claimed" };
      case "complete":
        storedReply = request.reply;
        stage = "ready";
        return { kind: "ok" };
      case "claim_presence":
        return { kind: "processing" };
      case "claim_delivery":
        if (stage !== "ready") return { kind: "processing" };
        stage = "delivery";
        return { kind: "claimed", reply: storedReply };
      case "delivered":
        stage = "delivered";
        return { kind: "ok" };
      case "release_delivery":
        stage = "ready";
        return { kind: "ok" };
      case "release":
        stage = "empty";
        return { kind: "ok" };
    }
  };

  const sent: string[] = [];
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { text?: { body?: string } };
    sent.push(body.text?.body ?? "");
    return new Response(JSON.stringify({ messages: [{ id: `wamid.out-${sent.length}` }] }), {
      status: 200,
    });
  }) as typeof fetch;

  const response = await handleEnhancedWhatsAppWebhookRequest(
    requestFor("Qual a previsão do tempo?", messageId),
    {
      env,
      fetchImpl,
      controlMessage: control,
      dispatchChat: async () => {
        await control({ action: "complete", messageId, reply });
        return { reply, shouldSend: true, duplicate: false };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(stage, "delivered");
  assert.ok(sent.length >= 2, `esperava várias bolhas, recebeu ${sent.length}`);
  assert.ok(sent.every((chunk) => chunk.length <= 3500));
  assert.equal(sent[0]?.startsWith("*Monte Aprazível — previsão*"), true);
  assert.ok(sent.some((chunk) => chunk.includes("*Pecuária*")));
  assert.ok(sent.some((chunk) => chunk.includes("Fontes: INMET")));
});
