import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSellerList,
  matchSellerRequest,
  type PublicSeller,
} from "../src/lib/site/seller-domain.ts";

const sellers: PublicSeller[] = [
  {
    id: "1",
    name: "Ana Souza",
    role: "Consultora",
    region: "São José do Rio Preto",
    phone: null,
    whatsapp: "5517999991111",
  },
  {
    id: "2",
    name: "Bruno Lima",
    role: "Representante",
    region: "Monte Aprazível",
    phone: "1730002000",
    whatsapp: null,
  },
];

test("pedido genérico retorna todos os vendedores individuais", () => {
  const result = matchSellerRequest("quero falar com um vendedor", sellers);
  assert.equal(result.kind, "all");
  assert.deepEqual(
    result.sellers.map((seller) => seller.name),
    ["Ana Souza", "Bruno Lima"],
  );
  assert.match(formatSellerList(result), /Ana Souza/);
  assert.match(formatSellerList(result), /WhatsApp: \(17\) 99999-1111/);
});

test("cidade conhecida filtra a região e entende o apelido Rio Preto", () => {
  const result = matchSellerRequest("tem vendedor em Rio Preto?", sellers);
  assert.equal(result.kind, "region");
  assert.deepEqual(
    result.sellers.map((seller) => seller.name),
    ["Ana Souza"],
  );
});

test("pedido de lista não é confundido com busca por nome ou cidade", () => {
  const result = matchSellerRequest("me passe a lista de vendedores", sellers);
  assert.equal(result.kind, "all");
  assert.equal(result.sellers.length, 2);
});

test("nome individual tem prioridade sobre região", () => {
  const result = matchSellerRequest("quero o contato da Ana em Rio Preto", sellers);
  assert.equal(result.kind, "name");
  assert.deepEqual(
    result.sellers.map((seller) => seller.name),
    ["Ana Souza"],
  );
});

test("não inventa contato ausente", () => {
  const result = matchSellerRequest("lista de vendedores", [
    { ...sellers[0], phone: null, whatsapp: null },
  ]);
  const answer = formatSellerList(result);
  assert.doesNotMatch(answer, /Telefone|WhatsApp/);
});
