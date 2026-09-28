import assert from "node:assert/strict";
import test from "node:test";
import { formatReplyForUser, userRequestedSourceLinks } from "../src/lib/chat/response-format.ts";

const reply = `Na praça de **São Paulo**, segundo o Cepea/Esalq, o boi gordo estava em **R$ 350,30/@** na parcial até **22/09/2026**.[Preço do boi gordo](https://example.org/noticia)

Se quiser, posso comparar com Barretos.[Outra notícia](https://example.org/outra)

Fontes consultadas:
- [Cotação 1](https://example.org/1)
- [Cotação 2](https://example.org/2)
- [Cotação 3](https://example.org/3)
- [Cotação 4](https://example.org/4)`;

test("cotação conserva valor, praça, data e fonte identificada sem links de pesquisa", () => {
  const result = formatReplyForUser(reply, "Qual o preço da arroba em São Paulo?");
  assert.match(result, /São Paulo/);
  assert.match(result, /Cepea\/Esalq/);
  assert.match(result, /R\$ 350,30\/@/);
  assert.match(result, /22\/09\/2026/);
  assert.doesNotMatch(result, /https?:\/\/|Fontes consultadas|\[Cotação|\[Preço do boi/);
  assert.match(result, /Se quiser, posso comparar com Barretos\./);
});

test("quando o usuário pede links, mostra somente três fontes", () => {
  assert.equal(userRequestedSourceLinks("Quais são as fontes dessa cotação?"), true);
  const result = formatReplyForUser(reply, "Quais são as fontes dessa cotação?");
  assert.equal((result.match(/https:\/\/example\.org/g) ?? []).length, 3);
  assert.match(result, /Fontes:/);
});

test("foto oficial pedida continua disponível para o envio como mídia", () => {
  const image = "https://dukamp.com.br/produtos/boi.webp";
  const result = formatReplyForUser(`Aqui está a foto oficial:\n${image}`, "Mande a foto do produto");
  assert.match(result, /dukamp\.com\.br\/produtos\/boi\.webp/);
});

test("link do produto pedido diretamente continua na resposta", () => {
  const result = formatReplyForUser(
    "Produto: https://dukamp.com.br/produto/123",
    "Qual é o link desse produto?",
  );
  assert.match(result, /https:\/\/dukamp\.com\.br\/produto\/123/);
  assert.doesNotMatch(result, /Fontes:/);
});

test("limpa citações numéricas de provedores sem alterar conteúdo técnico", () => {
  assert.equal(
    formatReplyForUser("Segundo o INMET [1], há alerta de geada【2】 para 29/09/2026.", "Vai gear?"),
    "Segundo o INMET, há alerta de geada para 29/09/2026.",
  );
});
