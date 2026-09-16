import assert from "node:assert/strict";
import test from "node:test";

import { selectKnowledgeMatches, type Match } from "../src/lib/rag/search.server.ts";

function match(overrides: Partial<Match>): Match {
  return {
    content: "Ração DuKamp para bovinos em engorda com indicação técnica oficial.",
    title: "RTPI ração corte",
    filename: "rtpi-racao-corte.txt",
    category: "PRODUTOS",
    subcategory: null,
    similarity: 0.6,
    ...overrides,
  };
}

test("resultado lexical forte usa a escala lexical sem depender de embedding", () => {
  const result = selectKnowledgeMatches(
    [match({ retrieval: "lexical", similarity: 0.606 })],
    "ração para engorda de bovinos",
    6,
    0.72,
    0.58,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]?.retrieval, "lexical");
});

test("mesma pontuação continua insuficiente para similaridade semântica", () => {
  const result = selectKnowledgeMatches(
    [match({ retrieval: "semantic", similarity: 0.606 })],
    "ração para engorda de bovinos",
    6,
    0.72,
    0.58,
  );
  assert.equal(result.length, 0);
});

test("resultado lexical fraco continua bloqueado", () => {
  const result = selectKnowledgeMatches(
    [match({ retrieval: "lexical", similarity: 0.56 })],
    "ração para engorda de bovinos",
    6,
    0.72,
    0.58,
  );
  assert.equal(result.length, 0);
});
