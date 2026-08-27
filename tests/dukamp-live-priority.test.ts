import assert from "node:assert/strict";
import test from "node:test";

import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { rankDuKampProductsForNeed } from "../src/lib/site/dukamp-product-ranking.ts";

test("pedido natural de produto para engorda vira recomendação comercial", () => {
  assert.equal(
    classifyDomainIntent("quero alguma coisa para engorda na seca").intent,
    "product_recommendation",
  );
});

test("pedido de foto em continuidade volta ao produto", () => {
  assert.equal(classifyDomainIntent("manda a foto dele", true).intent, "product");
});

test("ranking prioriza produto DuKamp compatível com seca e engorda e ignora sem estoque", () => {
  const products = [
    {
      name: "Proteico Seca Engorda Gold",
      slug: "proteico-seca-engorda-gold",
      description: "suplemento para período seco e terminação",
      stock: 12,
    },
    {
      name: "Mineral Águas",
      slug: "mineral-aguas",
      description: "mineral para período das águas",
      stock: 20,
    },
    {
      name: "Proteico Seca Engorda Premium",
      slug: "seca-engorda-premium",
      description: "seca e ganho de peso",
      stock: 0,
    },
  ];
  const ranked = rankDuKampProductsForNeed(
    products,
    "preciso de um produto para engorda na seca",
    5,
  );
  assert.equal(ranked[0]?.name, "Proteico Seca Engorda Gold");
  assert.equal(
    ranked.some((item) => item.stock === 0),
    false,
  );
});
