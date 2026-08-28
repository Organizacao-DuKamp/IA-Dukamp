import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { dispatchClaimedWhatsAppChat } from "../src/lib/whatsapp/backend.server.ts";
import { resolveWhatsAppUserText, WhatsAppMediaError } from "../src/lib/whatsapp/media.server.ts";
import type { WhatsAppChatInput, WhatsAppMedia } from "../src/lib/whatsapp/types.ts";

const mediaUrl = "https://lookaside.fbsbx.com/whatsapp_business/attachments/test-media";
const env = {
  WHATSAPP_ACCESS_TOKEN: "whatsapp-token-for-tests",
  WHATSAPP_GRAPH_API_VERSION: "v25.0",
  OPENAI_API_KEY: "openai-key-for-tests",
};

interface MediaFetchOptions {
  mimeType: string;
  bytes?: Uint8Array;
  transcript?: string;
  analysis?: string;
  declaredSize?: number;
}

function mockMediaFetch(options: MediaFetchOptions) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const bytes = options.bytes ?? new TextEncoder().encode("test media content");
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.startsWith("https://graph.facebook.com/v25.0/")) {
      return new Response(
        JSON.stringify({
          url: mediaUrl,
          mime_type: options.mimeType,
          file_size: options.declaredSize ?? bytes.byteLength,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url === mediaUrl) {
      return new Response(new Blob([bytes], { type: options.mimeType }), {
        status: 200,
        headers: {
          "content-type": options.mimeType,
          "content-length": String(bytes.byteLength),
        },
      });
    }
    if (url === "https://api.openai.com/v1/audio/transcriptions") {
      return new Response(JSON.stringify({ text: options.transcript ?? "transcrição de teste" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://api.openai.com/v1/responses") {
      return new Response(JSON.stringify({ output_text: options.analysis ?? "análise de teste" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`unexpected_fetch:${url}`);
  }) as typeof fetch;
  return { calls, fetchImpl, bytes };
}

function inputFor(media: WhatsAppMedia, text = "Analise o arquivo"): WhatsAppChatInput {
  return {
    phone: "5517999999999",
    messageId: `wamid.${media.type}`,
    text,
    media,
  };
}

test("texto puro não faz download nem chama a OpenAI", async () => {
  let fetched = false;
  const result = await resolveWhatsAppUserText(
    { phone: "5517999999999", messageId: "wamid.text", text: "Só texto" },
    {
      env,
      fetchImpl: (async () => {
        fetched = true;
        throw new Error("não deveria chamar fetch");
      }) as typeof fetch,
    },
  );
  assert.equal(result, "Só texto");
  assert.equal(fetched, false);
});

test("áudio do WhatsApp é baixado com token e transcrito", async () => {
  const mocked = mockMediaFetch({
    mimeType: "audio/ogg",
    transcript: "Qual o melhor sal mineral?",
  });
  const checksum = createHash("sha256").update(mocked.bytes).digest("base64");
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "audio-id", type: "audio", mimeType: "audio/ogg", sha256: checksum }),
    { env, fetchImpl: mocked.fetchImpl },
  );

  assert.match(result, /Transcrição do áudio: Qual o melhor sal mineral\?/);
  assert.equal(mocked.calls.length, 3);
  assert.equal(
    new Headers(mocked.calls[0]?.init?.headers).get("authorization"),
    "Bearer whatsapp-token-for-tests",
  );
  const transcriptionForm = mocked.calls[2]?.init?.body;
  assert.ok(transcriptionForm instanceof FormData);
  assert.equal(transcriptionForm.get("model"), "gpt-4o-mini-transcribe");
  assert.equal(transcriptionForm.get("language"), "pt");
});

test("imagem é enviada como input_image e a legenda orienta a resposta", async () => {
  const mocked = mockMediaFetch({
    mimeType: "image/jpeg",
    analysis: "A foto mostra um saco do produto DuKamp 80.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor(
      {
        id: "image-id",
        type: "image",
        mimeType: "image/jpeg",
        caption: "Qual é este produto?",
      },
      "Qual é este produto?",
    ),
    { env, fetchImpl: mocked.fetchImpl },
  );

  assert.match(result, /Legenda ou pedido do usuário: Qual é este produto\?/);
  assert.match(result, /A foto mostra um saco do produto DuKamp 80/);
  const requestBody = JSON.parse(String(mocked.calls[2]?.init?.body)) as {
    model?: string;
    max_output_tokens?: number;
    input: Array<{
      content: Array<{ type: string; image_url?: string; detail?: string }>;
    }>;
  };
  const imageInput = requestBody.input[0]?.content.find((item) => item.type === "input_image");
  assert.equal(requestBody.model, "gpt-4o-mini");
  assert.equal(requestBody.max_output_tokens, 800);
  assert.equal(imageInput?.detail, "low");
  assert.match(imageInput?.image_url ?? "", /^data:image\/jpeg;base64,/);
});

test("pedido de leitura de tela usa detalhe alto para preservar OCR", async () => {
  const mocked = mockMediaFetch({
    mimeType: "image/png",
    analysis: "A tela mostra o número 0,82.",
  });
  await resolveWhatsAppUserText(
    inputFor(
      { id: "ocr-image", type: "image", mimeType: "image/png" },
      "O que está escrito nesta tela?",
    ),
    { env, fetchImpl: mocked.fetchImpl },
  );

  const requestBody = JSON.parse(String(mocked.calls[2]?.init?.body)) as {
    input: Array<{ content: Array<{ type: string; detail?: string }> }>;
  };
  const imageInput = requestBody.input[0]?.content.find((item) => item.type === "input_image");
  assert.equal(imageInput?.detail, "high");
});

test("documento é enviado como input_file com nome seguro", async () => {
  const mocked = mockMediaFetch({
    mimeType: "application/pdf",
    analysis: "O relatório informa consumo médio de 120 gramas por dia.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor({
      id: "document-id",
      type: "document",
      mimeType: "application/pdf",
      filename: "../relatorio.pdf",
    }),
    { env, fetchImpl: mocked.fetchImpl },
  );

  assert.match(result, /consumo médio de 120 gramas por dia/);
  const requestBody = JSON.parse(String(mocked.calls[2]?.init?.body)) as {
    input: Array<{ content: Array<{ type: string; filename?: string; file_data?: string }> }>;
  };
  const fileInput = requestBody.input[0]?.content.find((item) => item.type === "input_file");
  assert.equal(fileInput?.filename, "_relatorio.pdf");
  assert.match(fileInput?.file_data ?? "", /^data:application\/pdf;base64,/);
});

test("vídeo usa a faixa de áudio sem fingir que analisou os quadros", async () => {
  const mocked = mockMediaFetch({
    mimeType: "video/mp4",
    transcript: "Os animais reduziram o consumo desde ontem.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "video-id", type: "video", mimeType: "video/mp4" }),
    { env, fetchImpl: mocked.fetchImpl },
  );

  assert.match(result, /Transcrição do áudio do vídeo/);
  assert.match(result, /reduziram o consumo desde ontem/);
  assert.equal(mocked.calls[2]?.url, "https://api.openai.com/v1/audio/transcriptions");
});

test("arquivo acima de 25 MB é recusado antes do download", async () => {
  const mocked = mockMediaFetch({
    mimeType: "application/pdf",
    declaredSize: 25 * 1024 * 1024 + 1,
  });

  await assert.rejects(
    () =>
      resolveWhatsAppUserText(
        inputFor({
          id: "too-large",
          type: "document",
          mimeType: "application/pdf",
          filename: "grande.pdf",
        }),
        { env, fetchImpl: mocked.fetchImpl },
      ),
    (error: unknown) =>
      error instanceof WhatsAppMediaError &&
      error.status === 413 &&
      error.code === "whatsapp_media_too_large",
  );
  assert.equal(mocked.calls.length, 1);
});
