import assert from "node:assert/strict";
import test from "node:test";
import { assessEvidence, sourceDirective } from "../src/lib/chat/source-policy.ts";

test("source policy prioritizes live and official DuKamp evidence", () => {
  const directive = sourceDirective(
    assessEvidence({ catalog: true, site: true, knowledgeScores: [0.82, 0.75] }),
  );

  assert.match(directive, /catálogo DuKamp vivo/i);
  assert.match(directive, /rótulo\/RTPI\/ficha oficial DuKamp/i);
  assert.match(directive, /não substitua dados DuKamp/i);
});

test("source policy requires authoritative livestock sources", () => {
  const directive = sourceDirective(assessEvidence({}));

  assert.match(directive, /MAPA/i);
  assert.match(directive, /WOAH\/OMSA/i);
  assert.match(directive, /Embrapa/i);
  assert.match(directive, /NASEM\/NRC/i);
});

test("source policy blocks unsafe veterinary prescribing", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.9] }));

  assert.match(directive, /não feche diagnóstico/i);
  assert.match(directive, /prescreva medicamento, dose, via ou protocolo/i);
  assert.match(directive, /serviço oficial/i);
});
