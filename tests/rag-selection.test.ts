import assert from "node:assert/strict";
import test from "node:test";

import { selectKnowledgeMatches, type Match } from "../src/lib/rag/search.server.ts";

function match(index: number, filename: string, similarity: number, content?: string): Match {
  return {
    content: content ?? `trecho técnico relevante ${index}`,
    title: `Documento ${filename}`,
    filename,
    category: "pecuaria",
    subcategory: null,
    similarity,
  };
}

test("RAG forte seleciona poucos trechos e limita repetição do documento", () => {
  const candidates = [
    match(1, "manual-a.pdf", 0.95),
    match(1, "manual-a.pdf", 0.94, "TRECHO TÉCNICO RELEVANTE 1"),
    match(2, "manual-a.pdf", 0.93),
    match(3, "manual-a.pdf", 0.92),
    match(4, "manual-b.pdf", 0.91),
    match(5, "manual-c.pdf", 0.9),
  ];

  const selected = selectKnowledgeMatches(candidates, "qual é a recomendação?", 6, 0.72);
  assert.equal(selected.length, 3);
  assert.ok(selected.filter((item) => item.filename === "manual-a.pdf").length <= 2);
  assert.equal(new Set(selected.map((item) => item.content.toLowerCase())).size, selected.length);
});

test("RAG amplia contexto para comparação sem ultrapassar o teto de trechos", () => {
  const selected = selectKnowledgeMatches(
    Array.from({ length: 10 }, (_, index) =>
      match(index, `manual-${index % 4}.pdf`, 0.9 - index / 100),
    ),
    "compare os cenários e explique passo a passo",
    8,
    0.72,
  );
  assert.equal(selected.length, 6);
  assert.ok(selected.every((item) => item.similarity >= 0.72));
});

test("RAG descarta candidatos abaixo do limiar explícito", () => {
  const selected = selectKnowledgeMatches(
    [match(1, "a.pdf", 0.71), match(2, "b.pdf", 0.8)],
    "qual recomendação?",
    6,
    0.82,
  );
  assert.deepEqual(selected, []);
});
