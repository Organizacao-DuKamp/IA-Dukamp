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
  assert.match(directive, /BR-CORTE/i);
  assert.match(directive, /CQBAL/i);
});

test("source policy blocks unsafe veterinary prescribing", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.9] }));

  assert.match(directive, /não feche diagnóstico/i);
  assert.match(directive, /prescreva medicamento, dose, via ou protocolo/i);
  assert.match(directive, /serviço oficial/i);
});

test("source policy blocks pseudo-formulations without farm inputs", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.88] }));

  assert.match(directive, /NÃO forneça uma pseudoformulação/i);
  assert.match(directive, /quilogramas de silagem, concentrado ou proporções prontas/i);
});

test("source policy says CQBAL never replaces analysis of the actual lot", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.8] }));

  assert.match(directive, /CQBAL é referência de composição/i);
  assert.match(directive, /NUNCA deve ser descrita como substituta da análise bromatológica/i);
});

test("source policy prevents generic cross-species catalog dumps", () => {
  const directive = sourceDirective(assessEvidence({ catalog: true }));

  assert.match(directive, /não despeje catálogo/i);
  assert.match(directive, /correspondência oficial inequívoca/i);
});
