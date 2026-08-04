import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TpecBackendError,
  dispatchChat,
  proxyChat,
  type TpecBackendDependencies,
} from "../src/lib/chat/backend.server.ts";
import { handleInternalChatRequest, handlePublicChatRequest } from "../src/lib/chat/http.server.ts";
import type { ChatCoreResult, ChatInput } from "../src/lib/chat/input.ts";

const secret = "tpec-test-secret-" + "x".repeat(40);
const input: ChatInput = {
  sessionId: "session-1",
  conversationId: "conversation-1",
  clientMessageId: "message-1",
  text: "Quais são os vendedores ativos da DuKamp?",
  history: [
    { role: "user", content: "Bom dia" },
    { role: "assistant", content: "Bom dia!" },
  ],
  state: { current_topic: "vendedores" },
};
const coreResult: ChatCoreResult = {
  reply: "Vendedores ativos da DuKamp: Brenda e Andressa.",
  state: { current_topic: "vendedores", turn_count: 2 },
  conversationId: "conversation-1",
  diagnostics: { model: "sonar", retrieved_blocks: ["site"] },
};

function proxyEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    TPEC_BACKEND_MODE: "proxy",
    LOVABLE_BACKEND_URL: "https://tpec-lovable.example",
    TPEC_PROXY_SECRET: secret,
    ...overrides,
  };
}

function responseFetch(body: unknown, status = 200) {
  return (async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function localDeps(): TpecBackendDependencies {
  return {
    env: { TPEC_BACKEND_MODE: "local", TPEC_PROXY_SECRET: secret },
    loadLocalBackend: async () => ({
      handleIncoming: async (received) => {
        assert.deepEqual(received, input);
        return coreResult;
      },
    }),
  };
}

test("modo local chama handleIncoming", async () => {
  const result = await dispatchChat(input, localDeps());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, coreResult);
});

test("modo proxy não importa o backend privilegiado", async () => {
  let imported = false;
  const result = await dispatchChat(input, {
    env: proxyEnv(),
    fetchImpl: responseFetch(coreResult),
    loadLocalBackend: async () => {
      imported = true;
      throw new Error("não deveria importar core.server");
    },
  });
  assert.equal(imported, false);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, coreResult);
});

test("modo proxy funciona sem SUPABASE_SERVICE_ROLE_KEY e LOVABLE_API_KEY", async () => {
  const result = await dispatchChat(input, {
    env: proxyEnv({
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      LOVABLE_API_KEY: undefined,
    }),
    fetchImpl: responseFetch(coreResult),
  });
  assert.equal(result.status, 200);
});

test("endpoint interno sem segredo é recusado", async () => {
  const response = await handleInternalChatRequest(
    new Request("https://lovable.example/api/internal/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tpec-proxy-hop": "1" },
      body: JSON.stringify(input),
    }),
    localDeps(),
  );
  assert.equal(response.status, 401);
});

test("endpoint interno com segredo incorreto é recusado", async () => {
  const response = await handleInternalChatRequest(
    new Request("https://lovable.example/api/internal/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-hop": "1",
        "x-tpec-proxy-secret": "incorrect-secret-that-is-long-enough-000",
      },
      body: JSON.stringify(input),
    }),
    localDeps(),
  );
  assert.equal(response.status, 401);
});

test("endpoint interno com segredo correto executa o chat", async () => {
  const response = await handleInternalChatRequest(
    new Request("https://lovable.example/api/internal/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-hop": "1",
        "x-tpec-proxy-secret": secret,
      },
      body: JSON.stringify(input),
    }),
    localDeps(),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), coreResult);
});

test("endpoint interno fica oculto quando o runtime está em modo proxy", async () => {
  const response = await handleInternalChatRequest(
    new Request("https://netlify.example/api/internal/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tpec-proxy-hop": "1",
        "x-tpec-proxy-secret": secret,
      },
      body: JSON.stringify(input),
    }),
    { env: proxyEnv() },
  );
  assert.equal(response.status, 404);
});

test("proxy preserva body, state, history e conversationId", async () => {
  let sentBody: unknown;
  let sentHeaders: Headers | undefined;
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    sentHeaders = new Headers(init?.headers);
    assert.equal(init?.redirect, "error");
    return new Response(JSON.stringify(coreResult), { status: 200 });
  }) as typeof fetch;
  await proxyChat(input, { env: proxyEnv(), fetchImpl });
  assert.deepEqual(sentBody, input);
  assert.equal(sentHeaders?.get("x-tpec-proxy-secret"), secret);
  assert.equal(sentHeaders?.get("x-tpec-proxy-hop"), "1");
  assert.equal(sentHeaders?.has("authorization"), false);
  assert.equal(sentHeaders?.has("cookie"), false);
});

test("timeout do proxy retorna 504", async () => {
  const abortingFetch = (async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  }) as typeof fetch;
  await assert.rejects(
    () => proxyChat(input, { env: proxyEnv(), fetchImpl: abortingFetch }),
    (error: unknown) =>
      error instanceof TpecBackendError && error.status === 504 && error.code === "proxy_timeout",
  );
});

test("resposta não JSON é tratada como 502", async () => {
  const invalidFetch = (async () => new Response("html", { status: 200 })) as typeof fetch;
  await assert.rejects(
    () => proxyChat(input, { env: proxyEnv(), fetchImpl: invalidFetch }),
    (error: unknown) =>
      error instanceof TpecBackendError &&
      error.status === 502 &&
      error.code === "invalid_proxy_json",
  );
});

test("falta de LOVABLE_BACKEND_URL produz erro claro", async () => {
  await assert.rejects(
    () => proxyChat(input, { env: proxyEnv({ LOVABLE_BACKEND_URL: undefined }) }),
    (error: unknown) =>
      error instanceof TpecBackendError && error.code === "missing_lovable_backend_url",
  );
});

test("falta de TPEC_PROXY_SECRET produz erro claro", async () => {
  await assert.rejects(
    () => proxyChat(input, { env: proxyEnv({ TPEC_PROXY_SECRET: undefined }) }),
    (error: unknown) => error instanceof TpecBackendError && error.code === "missing_proxy_secret",
  );
});

test("rota pública preserva status HTTP e serializa o estado opaco", async () => {
  const response = await handlePublicChatRequest(
    new Request("https://netlify.example/api/public/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
    { env: proxyEnv(), fetchImpl: responseFetch(coreResult) },
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { reply: string; state: string; conversationId: string };
  assert.equal(body.reply, coreResult.reply);
  assert.equal(body.conversationId, coreResult.conversationId);
  assert.deepEqual(JSON.parse(body.state), coreResult.state);
});

test("vendedores da DuKamp têm o mesmo resultado em local e proxy", async () => {
  const local = await dispatchChat(input, localDeps());
  const remote = await dispatchChat(input, {
    env: proxyEnv(),
    fetchImpl: responseFetch(coreResult),
  });
  assert.deepEqual(remote.body, local.body);
});

test("código do navegador não referencia segredos de servidor", async () => {
  const source = await readFile("src/lib/chat/web-adapter.ts", "utf8");
  for (const forbidden of [
    "TPEC_PROXY_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "LOVABLE_API_KEY",
    "OPENAI_API_KEY",
    "PERPLEXITY_API_KEY",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
