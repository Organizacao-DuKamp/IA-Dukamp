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

test("sem evidência interna o ChatGPT pode pesquisar nativamente", () => {
  const directive = sourceDirective(assessEvidence({}));

  assert.match(directive, /CHATGPT-FIRST/i);
  assert.match(directive, /pesquisa web nativa da OpenAI/i);
  assert.match(directive, /fatos atuais/i);
  assert.match(directive, /fontes primárias/i);
  assert.doesNotMatch(directive, /NÃO finja que você consegue navegar por conta própria/i);
});

test("source policy blocks unsafe veterinary prescribing", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.9] }));

  assert.match(directive, /não feche diagnóstico/i);
  assert.match(directive, /prescreva medicamento, dose, via ou protocolo/i);
  assert.match(directive, /NÃO forneça nomes de princípios ativos nem números de dose/i);
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

test("source policy identifies NASEM beef and dairy editions", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.8] }));

  assert.match(directive, /bovinos de corte em 2016/i);
  assert.match(directive, /bovinos de leite em 2021/i);
  assert.match(directive, /Nunca descreva NASEM como referência apenas de leite/i);
});

test("source policy refuses invented DuKamp product sheets", () => {
  const directive = sourceDirective(assessEvidence({}));

  assert.match(directive, /recuse inventar ficha/i);
  assert.match(directive, /não ofereça uma ficha comercial simulada/i);
});

test("current regulation must use dated official evidence", () => {
  const directive = sourceDirective(assessEvidence({}));

  assert.match(directive, /fonte oficial atual do MAPA\/WOAH/i);
  assert.match(directive, /informe data de referência/i);
  assert.match(directive, /não use catálogo comercial como resposta/i);
});

test("weather policy requires current regional and official evidence", () => {
  const directive = sourceDirective(assessEvidence({ knowledgeScores: [0.84] }));

  assert.match(directive, /localização confirmada/i);
  assert.match(directive, /INMET/);
  assert.match(directive, /CPTEC\/INPE/);
  assert.match(directive, /data, hora\/fuso, período e incerteza/i);
});
