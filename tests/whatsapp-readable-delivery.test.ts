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

test("previsão normal chega como uma mensagem visualmente organizada", async () => {
  const messageId = "wamid.readable-weather";
  const reply = [
    "## Monte Aprazível — previsão",
    "• 27/08 — tempo com muitas nuvens; mínima ~16–17 °C, máxima ~29–33 °C; chuva fraca isolada (~1–1,5 mm); vento fraco a moderado.",
    "• 28–31/08 — sequência de dias quentes e secos; máximas entre ~34–37 °C; chance de chuva muito baixa.",
    "• 01/09 — maior chance de chuva; probabilidade até ~60%; acumulado moderado possível.",
    "",
    "**Pecuária**",
    "O ponto de atenção é o calor da tarde. Água disponível e sombra ajudam a reduzir o estresse térmico do rebanho.",
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
  assert.equal(sent.length, 1, "resposta normal não deve criar múltiplos envios na Graph API");
  const delivered = sent[0] ?? "";
  assert.ok(Array.from(delivered).length <= 3500);
  assert.equal(delivered.startsWith("*Monte Aprazível — previsão*"), true);
  assert.match(delivered, /• \*27\/08\*\n  tempo com muitas nuvens;\n  mínima/u);
  assert.match(delivered, /\n\n• \*28–31\/08\*/u);
  assert.match(delivered, /\n\n\*Pecuária\*\n/u);
  assert.match(delivered, /Fontes: INMET/u);
});
