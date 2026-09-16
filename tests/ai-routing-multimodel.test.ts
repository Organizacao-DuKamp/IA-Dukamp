import assert from "node:assert/strict";
import test from "node:test";

import { isSelfContainedCalculation } from "../src/lib/ai/chat.server.ts";
import { synthesisProviderFor } from "../src/lib/ai/orchestrator.server.ts";
import { routeAIRequest } from "../src/lib/ai/router.ts";

test("cálculo puro vai para DeepSeek", () => {
  const route = routeAIRequest({ message: "Calcule o custo por cabeça para 120 bois por 90 dias" });
  assert.equal(route.primary, "deepseek");
  assert.ok(route.categories.includes("CALCULATION"));
  assert.equal(route.synthesize, false);
});

test("cálculo autossuficiente ignora contexto antigo e não exige web", () => {
  const prompt =
    "Tenho 80 bois com peso médio de 420 kg. Cada um consome 2,2% do peso vivo em matéria seca por dia. Se a ração custa R$ 1,85 por kg e o confinamento durar 90 dias, calcule o consumo total de ração, o custo por animal e o custo total do lote.";
  assert.equal(isSelfContainedCalculation(prompt), true);

  const route = routeAIRequest({
    message: prompt,
    conversationContext: "cotações e produtos anteriores ".repeat(2_000),
    prohibitWeb: true,
  });
  assert.equal(route.primary, "deepseek");
  assert.equal(route.webRequired, false);
  assert.ok(route.categories.includes("CALCULATION"));
});

test("cálculo que pede dado atual continua elegível para pesquisa", () => {
  assert.equal(
    isSelfContainedCalculation(
      "Pesquise a cotação atual da arroba e calcule o valor de 180 bois de 500 kg hoje",
    ),
    false,
  );
});

test("documento e contexto longo vão para Gemini", () => {
  const document = routeAIRequest({
    message: "Analise este relatório técnico",
    attachments: [{ name: "relatorio.pdf", mimeType: "application/pdf", text: "conteúdo" }],
  });
  assert.equal(document.primary, "gemini");
  assert.ok(document.categories.includes("DOCUMENT_ANALYSIS"));

  const long = routeAIRequest({
    message: "Compare este material com o histórico",
    conversationContext: "x".repeat(25_000),
  });
  assert.equal(long.primary, "gemini");
  assert.ok(long.categories.includes("LONG_CONTEXT"));
});

test("pesquisa atual usa Perplexity e cálculo da síntese usa DeepSeek", () => {
  const route = routeAIRequest({
    message: "Pesquise o preço atual da arroba e calcule o valor de 180 animais",
  });
  assert.equal(route.primary, "perplexity");
  assert.ok(route.categories.includes("WEB_SEARCH"));
  assert.ok(route.categories.includes("CALCULATION"));
  assert.equal(route.synthesize, true);
  assert.equal(synthesisProviderFor(route.categories), "deepseek");
});

test("pesquisa com contexto longo usa Gemini para a síntese", () => {
  const route = routeAIRequest({
    message: "Pesquise estudos recentes e compare com o material informado",
    conversationContext: "x".repeat(25_000),
  });
  assert.equal(route.primary, "perplexity");
  assert.ok(route.categories.includes("LONG_CONTEXT"));
  assert.equal(route.synthesize, true);
  assert.equal(synthesisProviderFor(route.categories), "gemini");
});

test("pergunta geral continua com OpenAI", () => {
  const route = routeAIRequest({ message: "Explique a diferença entre cria e recria" });
  assert.equal(route.primary, "openai");
  assert.equal(route.synthesize, false);
});
