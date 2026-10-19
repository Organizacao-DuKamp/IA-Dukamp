import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { dispatchClaimedWhatsAppChat } from "../src/lib/whatsapp/backend.server.ts";
import { resolveWhatsAppUserText, WhatsAppMediaError } from "../src/lib/whatsapp/media.server.ts";
import type { WhatsAppChatInput, WhatsAppMedia } from "../src/lib/whatsapp/types.ts";
import type { PreparedWhatsAppVideo } from "../src/lib/whatsapp/video.server.ts";

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
  transcriptionStatus?: number;
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
        status: options.transcriptionStatus ?? 200,
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

const preparedVideo: PreparedWhatsAppVideo = {
  durationSeconds: 12,
  frames: [
    { seconds: 0, base64: "cXVhZHJvLTE=" },
    { seconds: 11, base64: "cXVhZHJvLTI=" },
  ],
  audio: new TextEncoder().encode("audio extraído"),
};

test("vídeo combina quadros em ordem temporal, áudio extraído e legenda", async () => {
  const mocked = mockMediaFetch({
    mimeType: "video/mp4",
    transcript: "Os animais reduziram o consumo desde ontem.",
    analysis: "Às 11s um animal se afasta do cocho; o narrador relata redução de consumo.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "video-id", type: "video", mimeType: "video/mp4", caption: "O que mudou?" }),
    {
      env,
      fetchImpl: mocked.fetchImpl,
      prepareVideo: async () => preparedVideo,
      history: [{ role: "user", content: "Estou observando o consumo no cocho." }],
    },
  );

  assert.match(result, /Análise visual do vídeo/);
  assert.match(result, /animal se afasta do cocho/);
  assert.equal(mocked.calls[2]?.url, "https://api.openai.com/v1/audio/transcriptions");
  const form = mocked.calls[2].init?.body as FormData;
  const audio = form.get("file") as File;
  assert.equal(audio.type, "audio/mpeg");
  assert.equal(audio.name, "video-audio.mp3");
  assert.equal(await audio.text(), "audio extraído");
  const body = JSON.parse(String(mocked.calls[3].init?.body));
  const content = body.input[0].content;
  const prompt = content[0].text;
  assert.match(prompt, /O que mudou\?/);
  assert.match(prompt, /reduziram o consumo desde ontem/);
  assert.match(prompt, /observando o consumo no cocho/);
  assert.match(prompt, /não uma reprodução contínua/);
  assert.deepEqual(
    content
      .filter((item: { type: string }) => item.type === "input_image")
      .map((item: { image_url: string }) => item.image_url),
    preparedVideo.frames.map((frame) => `data:image/jpeg;base64,${frame.base64}`),
  );
  assert.match(content[3].text, /11s/);
  assert.equal(JSON.stringify(body).includes("data:video/"), false);
});

test("vídeo sem áudio é analisado visualmente sem tentar transcrição", async () => {
  const mocked = mockMediaFetch({ mimeType: "video/mp4", analysis: "Um bovino caminha no pasto." });
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "silent", type: "video", mimeType: "video/mp4" }),
    {
      env,
      fetchImpl: mocked.fetchImpl,
      prepareVideo: async () => ({ ...preparedVideo, audio: undefined }),
    },
  );
  assert.match(result, /bovino caminha/);
  assert.equal(mocked.calls.length, 3);
  assert.match(String(mocked.calls[2].init?.body), /não possui faixa de áudio/);
  assert.doesNotMatch(result, /descreva a parte visual/);
});

test("falha de transcrição preserva a análise visual e explicita a limitação", async () => {
  const mocked = mockMediaFetch({
    mimeType: "video/mp4",
    transcriptionStatus: 400,
    analysis: "Um animal está deitado. O áudio não pôde ser transcrito.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "audio-failed", type: "video", mimeType: "video/mp4" }),
    { env, fetchImpl: mocked.fetchImpl, prepareVideo: async () => preparedVideo },
  );
  assert.match(result, /animal está deitado/);
  assert.match(String(mocked.calls.at(-1)?.init?.body), /transcrição do áudio está indisponível/);
});

test("vídeo multimodelo funciona com apenas OpenAI e não depende do tamanho do vídeo inline", async () => {
  const mocked = mockMediaFetch({
    mimeType: "video/mp4",
    bytes: new Uint8Array(16 * 1024 * 1024),
    analysis: "O animal se desloca entre os quadros.",
  });
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "multimodel-video", type: "video", mimeType: "video/mp4" }),
    {
      env: { ...env, TPEC_MULTIMODEL_ENABLED: "true" },
      fetchImpl: mocked.fetchImpl,
      prepareVideo: async () => ({ ...preparedVideo, audio: undefined }),
    },
  );
  assert.match(result, /animal se desloca/);
  assert.equal(mocked.calls.length, 3);
  const body = String(mocked.calls[2].init?.body);
  assert.match(body, /data:image\/jpeg;base64/);
  assert.doesNotMatch(body, /data:video/);
  assert.ok(body.length < 100_000);
});

test("vídeo corrompido não chega ao modelo como texto ou arquivo binário", async () => {
  const mocked = mockMediaFetch({ mimeType: "video/mp4" });
  await assert.rejects(
    () =>
      resolveWhatsAppUserText(inputFor({ id: "corrupt", type: "video", mimeType: "video/mp4" }), {
        env,
        fetchImpl: mocked.fetchImpl,
        prepareVideo: async () => {
          throw new Error("invalid_video");
        },
      }),
    /invalid_video/,
  );
  assert.equal(mocked.calls.length, 2);
});

test("Gemini indisponível mantém os quadros e o contexto na alternativa OpenAI", async () => {
  const mocked = mockMediaFetch({
    mimeType: "video/mp4",
    analysis: "O animal se levanta no último quadro.",
  });
  let geminiCalls = 0;
  const result = await resolveWhatsAppUserText(
    inputFor({ id: "gemini-failed-video", type: "video", mimeType: "video/mp4" }),
    {
      env: { ...env, TPEC_MULTIMODEL_ENABLED: "true", GEMINI_API_KEY: "gemini-test" },
      prepareVideo: async () => ({ ...preparedVideo, audio: undefined }),
      fetchImpl: async (url, init) => {
        if (String(url).includes("generativelanguage.googleapis.com")) {
          geminiCalls++;
          const body = JSON.parse(String(init?.body));
          assert.equal(body.contents.at(-1).parts.length, preparedVideo.frames.length);
          assert.match(body.systemInstruction.parts[0].text, /não possui faixa de áudio/);
          return Response.json({ error: { message: "temporarily unavailable" } }, { status: 503 });
        }
        return mocked.fetchImpl(url, init);
      },
    },
  );
  assert.equal(geminiCalls, 1);
  assert.match(result, /animal se levanta/);
  const body = String(mocked.calls.at(-1)?.init?.body);
  for (const frame of preparedVideo.frames) assert.ok(body.includes(frame.base64));
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
