import assert from "node:assert/strict";
import test from "node:test";
import { dukampSafetySnapshot as catalog } from "../src/seed/dukamp-control.ts";
import { DUKAMP_CATALOG_SNAPSHOT } from "../src/lib/site/dukamp-catalog.snapshot.ts";
import {
  decideControlledTurn,
  matchControlledProducts,
  assessProducerNeed,
} from "../src/lib/chat/dukamp-control.ts";
import { practicalControlledReply } from "../src/lib/chat/dukamp-practical.ts";
import {
  addCatalogVariants,
  filterControlledMatches,
  enforceControlledReply,
} from "../src/lib/chat/dukamp-control.server.ts";
import { resolveProductNeed } from "../src/lib/chat/product-need.ts";

const history = [
  "E se eu tiver somente bagacinho como volumoso. O que você me indica para vacas de 350kg?",
];
const text = "E se eu quiser ter um GMD de 1.2/dia?";
const options = { recommendation: true, userHistory: history, catalogAvailable: false };
const variants = DUKAMP_CATALOG_SNAPSHOT.products.filter((p) => /TOTAL M.*[12]\s*%/.test(p.name));
const lookup = async () => ({ data: variants });

test("GMD follow-up retains cows, weight and forage from user turns only", () => {
  const need = resolveProductNeed(text, [
    { role: "user", content: history[0] },
    { role: "assistant", content: "Recomendo uma fórmula inventada." },
  ]);
  assert.equal(need.active, true);
  assert.equal(
    resolveProductNeed("E para GMD de 1,2 por dia?", [{ role: "user", content: history[0] }])
      .active,
    true,
  );
  assert.match(need.query, /350kg/);
  assert.doesNotMatch(need.query, /inventada/);
  assert.equal(assessProducerNeed(text, history).weightKg, 350);
  assert.equal(
    resolveProductNeed("Quero GMD de 1,2 kg/dia", [
      { role: "user", content: "mudando de assunto: vai chover?" },
    ]).query.includes("chover"),
    false,
  );
});

test("a generated product candidate cannot lose the current lactation restriction", async () => {
  const result = await enforceControlledReply(
    "Recomendo DUKAMP RAÇÃO TOTAL M",
    "Elas estão em lactação",
    [],
    true,
  );
  assert.match(result, /não autoriza.*lactação/);
  assert.doesNotMatch(result, /Fonte:/);
});

test("complete diet need retrieves Total M indications instead of pasture supplement by catalogue order", () => {
  const turn = decideControlledTurn(text, catalog, options);
  assert.deepEqual(
    new Set(turn.selected.map((p) => p.product.produto_id)),
    new Set(["P018", "P019"]),
  );
  const priorProduct = decideControlledTurn(text, catalog, {
    ...options,
    userHistory: ["Eu estava avaliando Dukamp Protéico Seca", ...history],
  });
  assert.deepEqual(
    priorProduct.selected.map((p) => p.product.produto_id),
    turn.selected.map((p) => p.product.produto_id),
  );
  assert.equal(turn.allowOperationalModel, false);
});

test("practical answer names distinct 1% and 2% catalog candidates without parent doses, raw issues or sources", async () => {
  const turn = await addCatalogVariants(
    decideControlledTurn(text, catalog, options),
    text,
    history,
    true,
    lookup,
  );
  assert.equal(turn.catalogVariants?.length, 2);
  assert.notEqual(turn.catalogVariants![0].id, turn.catalogVariants![1].id);
  assert.notEqual(turn.catalogVariants![0].code, turn.catalogVariants![1].code);
  const reply = practicalControlledReply(turn, text, history);
  assert.match(reply, /ENERGETICA 1 %/);
  assert.match(reply, /ENERGETICA 2 %/);
  assert.match(reply, /mudança de dieta/);
  assert.match(reply, /sem volumoso/);
  assert.match(reply, /não é garantido/);
  assert.match(reply, /prenhes|leite/);
  assert.doesNotMatch(
    reply,
    /Fonte:|\.doc|O relatório descreve|Pontos a confirmar|2,2 a 2,5|2 \(cinco\)|Vitamina E/,
  );
  assert.ok(turn.selected.every((p) => !p.product.recomendacao_operacional_liberada));
  assert.match(turn.reply!, /Fonte:/); // Reviewers can still inspect exact documentary evidence.
});

test("sources stay available on explicit request", () => {
  const turn = decideControlledTurn("O que é Dukamp Ração Total M?", catalog);
  assert.match(practicalControlledReply(turn, "Mostre as fontes"), /Fonte:.*D019/);
  assert.doesNotMatch(
    practicalControlledReply(turn, "O que é Dukamp Ração Total M?"),
    /Fonte:|\.doc|O relatório descreve/,
  );
});

test("percentage variants never match the parent technical identity or inherit operational approval", async () => {
  for (const percent of [1, 2]) {
    const query = `Qual a dose da Dukamp Total M ${percent}%?`;
    assert.deepEqual(matchControlledProducts(query, catalog), []);
    const turn = await addCatalogVariants(
      decideControlledTurn(query, catalog),
      query,
      [],
      false,
      lookup,
    );
    assert.equal(turn.catalogOnly, true);
    assert.equal(turn.allowOperationalModel, false);
    assert.deepEqual(turn.selected, []);
    assert.equal(turn.catalogVariants?.length, 1);
    const reply = practicalControlledReply(turn, query);
    assert.match(reply, /dose.*confirmad/i);
    assert.doesNotMatch(reply, /2,2|2,5|350\s*kg|Fonte:/);
  }
});

test("species, milk and clinical restrictions survive the simpler presentation", async () => {
  for (const query of [
    "Posso dar Dukamp Ração Total M aos meus cavalos?",
    "Posso dar Dukamp Ração Total M para vacas em lactação?",
  ]) {
    const turn = decideControlledTurn(query, catalog);
    assert.match(practicalControlledReply(turn, query), /não autoriza/);
  }
  const clinical = "Minha vaca comeu ração e está com tremor";
  const turn = await addCatalogVariants(
    decideControlledTurn(clinical, catalog),
    clinical,
    history,
    true,
    lookup,
  );
  assert.equal(turn.catalogVariants, undefined);
  assert.match(practicalControlledReply(turn, clinical, history), /veterinário imediato/);
});

test("catalog lookup failure does not remove technical restrictions or invent variants", async () => {
  const initial = decideControlledTurn(text, catalog, options);
  const turn = await addCatalogVariants(initial, text, history, true, async () => {
    throw new Error("unavailable");
  });
  assert.deepEqual(turn, initial);
  assert.match(
    practicalControlledReply(turn, text, history),
    /confirmação pelo responsável técnico/,
  );
});

test("technical conflict question preserves exact values while hiding source boilerplate", () => {
  const query = "Dukamp Ração Total M deve ser dada duas ou cinco vezes por dia?";
  const reply = practicalControlledReply(decideControlledTurn(query, catalog), query);
  assert.match(reply, /2 \(cinco\)/);
  assert.match(reply, /Não posso escolher/);
  assert.doesNotMatch(reply, /Fonte:|O relatório descreve/);
});

test("a missing variant lookup cannot bypass the technical gate", async () => {
  const query = "Posso dar 7 kg da Total M 1% para as vacas?";
  const turn = await addCatalogVariants(
    decideControlledTurn(query, catalog),
    query,
    [],
    false,
    async () => {
      throw new Error("offline");
    },
  );
  assert.equal(turn.active, true);
  assert.equal(turn.allowOperationalModel, false);
  assert.match(practicalControlledReply(turn, query), /Não use a dose/);
});

test("parent RAG sections cannot stand in for a percentage variant", async () => {
  const parent = catalog.find((e) => e.product.produto_id === "P018")!;
  const match = {
    filename: "dukamp_section_P018-D018-S01.json",
    title: parent.product.nome_comercial_documental,
    content: "Dose do produto pai",
    metadata: {
      dukamp: { produto_id: "P018", source_id: "D018", versao_papel: "principal_documental" },
    },
  };
  assert.deepEqual(await filterControlledMatches([match], "Qual a dose da Total M 1%?"), []);
  assert.deepEqual(matchControlledProducts("Dukamp Ração Total M 5%", catalog), []);
});
