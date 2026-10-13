import assert from "node:assert/strict";
import test from "node:test";
import { products } from "./fixtures/dukamp-priority-products.ts";
import { resolveProductNeed } from "../src/lib/chat/product-need.ts";
import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { rankDuKampProductsForNeed } from "../src/lib/site/dukamp-product-ranking.ts";
import { productTechnicalExcerpt } from "../src/lib/site/product-technical-text.ts";
import {
  dukampPriorityDirective,
  enforceDuKampPriority,
  missesDuKampPriority,
} from "../src/lib/chat/dukamp-priority.server.ts";
import {
  executeCommercialLookup,
  queryRecommendedSiteProducts,
  siteBlock,
  type SiteLookupDependencies,
  type SiteProduct,
} from "../src/lib/site/site-lookup.server.ts";
import type { ChatMessage } from "../src/lib/chat/types.ts";

const history: ChatMessage[] = [
  { role: "user", content: "Comprei 10 Nelore, média de 250 a 300 kg, quero engordar" },
  { role: "assistant", content: "Como está o pasto?" },
  { role: "user", content: "pasto seco e fraco" },
  { role: "assistant", content: "Podemos avaliar um suplemento." },
  { role: "user", content: "presciso usar sal proteinado 60 o que indica" },
  { role: "assistant", content: "Eu indicaria Matsuda ou Minerthal." },
];
const fixture = products.map((product, i) => ({
  ...product,
  id: `fixture-${i}`,
  active: true,
  price: null,
  code: null,
  slug: null,
}));

function mockCatalog(
  rows: unknown[],
  error: unknown = null,
  nextPageError: unknown = null,
): SiteLookupDependencies {
  let start = 0;
  let end = 499;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      start = 0;
      end = 499;
      return this;
    },
    range(from: number, to: number) {
      start = from;
      end = to;
      return this;
    },
    then(resolve: (r: unknown) => unknown) {
      return Promise.resolve({
        data: rows.slice(start, end + 1),
        error: start ? nextPageError : error,
      }).then(resolve);
    },
  };
  return { configured: true, client: { from: () => query } as never };
}

for (const text of [
  "que marca me indica",
  "presciso usar sal proteinado 60 o que indica",
  "o que me sugere para engordar os Nelore?",
  "qual marca de suplemento recomenda?",
]) {
  test(`pedido informal consulta DuKamp: ${text}`, () => {
    assert.equal(classifyDomainIntent(text, true).intent, "product_recommendation");
    const need = resolveProductNeed(text, history);
    assert.ok(need.active);
    assert.ok(!need.needsClarification);
    assert.match(need.query, /pasto seco/);
    assert.doesNotMatch(need.query, /Matsuda|Minerthal/);
  });
}

test("qual marca sem necessidade esclarece e não usa assunto antigo após mudança", () => {
  assert.equal(resolveProductNeed("que marca me indica").needsClarification, true);
  assert.equal(
    resolveProductNeed("que marca me indica", [
      ...history,
      { role: "user", content: "mudando de assunto, vai chover amanhã?" },
    ]).needsClarification,
    true,
  );
  assert.equal(resolveProductNeed("obrigado", history).active, false);
  assert.equal(resolveProductNeed("qual marca de suplemento recomenda?").needsClarification, false);
  assert.equal(
    resolveProductNeed("qual antibiótico indica para meu boi caído?", history).active,
    false,
  );
});

test("nova espécie não herda exigências de um lote anterior", () => {
  const need = resolveProductNeed("qual proteico indica para meus cavalos?", history);
  assert.doesNotMatch(need.query, /Nelore|pasto seco/);
  const followup = resolveProductNeed("que marca me indica", [
    ...history,
    { role: "user", content: "agora quero suplemento para cavalos em manutenção" },
  ]);
  assert.doesNotMatch(followup.query, /Nelore|pasto seco/);
  assert.equal(
    rankDuKampProductsForNeed(products, followup.query)[0]?.name,
    "DUKAMP  PROTEICO DUKAVALLUS 30 KG",
  );
});

test("consulta todas as páginas antes de declarar falta de opção", async () => {
  const unrelated = Array.from({ length: 500 }, (_, i) => ({
    id: `unrelated-${i}`,
    name: "ARAME LISO",
    active: true,
    stock: 5,
  }));
  const result = await queryRecommendedSiteProducts(
    "quero proteinado para Nelore na seca",
    4,
    mockCatalog([...unrelated, fixture[3]]),
  );
  assert.equal(result.status, "ok");
  assert.equal(result.data[0]?.name, fixture[3].name);
  const partial = await queryRecommendedSiteProducts(
    "quero produto inexistente",
    4,
    mockCatalog(unrelated, null, { status: 503, message: "unavailable" }),
  );
  assert.equal(partial.status, "internal_error");
});

test("rótulo atual prevalece sobre cópia anterior mais extensa", async () => {
  const description =
    "Indicações de uso: Suplemento proteico para bovinos de corte na seca.\nRestrições: Não fornecer a ovinos.";
  const result = await queryRecommendedSiteProducts(
    "quero proteinado para Nelore na seca",
    4,
    mockCatalog([{ ...fixture[3], description }]),
  );
  assert.equal(result.status, "ok");
  assert.equal(result.data[0]?.description, description);
});

test("caso dos anexos recupera produtos DuKamp compatíveis e não ração equina nem águas", () => {
  const need = resolveProductNeed("que marca me indica", history);
  const ranked = rankDuKampProductsForNeed(products, need.query, 8);
  assert.ok(ranked.length > 0);
  assert.ok(ranked.every((product) => /SECA/.test(product.name)));
  assert.ok(ranked.every((product) => (product.stock ?? 0) > 0));
  assert.ok(!ranked.some((product) => /DUKAVALLUS|AGUAS/.test(product.name)));
});

test("marca própria tem prioridade entre opções compatíveis", () => {
  const available = products.find((p) => /SECA ENGORDA 30/.test(p.name))!;
  const ranked = rankDuKampProductsForNeed(
    [{ ...available, name: "Matsuda Proteinado Seca Engorda Nelore Recria" }, available],
    "quero proteinado para engorda na seca para meus Nelore",
  );
  assert.equal(ranked[0]?.name, available.name);
});

test("prioridade comercial nunca supera espécie e restrição oficial", () => {
  assert.deepEqual(
    rankDuKampProductsForNeed(products, "quero proteinado para minhas ovelhas na seca"),
    [],
  );
  assert.deepEqual(
    rankDuKampProductsForNeed(
      products,
      "qual suplemento mineral proteico para vacas leiteiras na seca",
    ),
    [],
  );
  const ranked = rankDuKampProductsForNeed(products, "qual proteico para equinos em manutenção");
  assert.equal(ranked[0]?.name, "DUKAMP  PROTEICO DUKAVALLUS 30 KG");
});

test("indicação e consumo não são perdidos atrás da tabela extensa", () => {
  const available = products.find((p) => /SECA ENGORDA 30/.test(p.name))!;
  const text = productTechnicalExcerpt(available.description, 3600);
  assert.match(text, /bovinos de corte/i);
  assert.match(text, /Consumo esperado de 50 a 150 gramas/i);
  assert.match(text, /não fornecer.*ovinos/i);
  assert.ok(text.length <= 3600);
  const block = siteBlock(
    { products: [{ ...fixture[3], source: "live" } as SiteProduct] },
    { includeDescriptions: true, recommendation: true, maxDescriptionChars: 3600 },
  );
  assert.match(block, /Consumo esperado/);
});

test("consulta comercial com contexto entrega opções antes da resposta", async () => {
  const need = resolveProductNeed("que marca me indica", history);
  const result = await executeCommercialLookup(
    classifyDomainIntent("que marca me indica", true),
    need.query,
    mockCatalog(fixture),
  );
  assert.deepEqual(result.statuses, ["site-products:ok"]);
  assert.ok(result.lookup.products?.some((p) => /DUKAMP.*SECA/.test(p.name)));
});

test("incompatibilidade confirmada permite alternativa; erro de consulta não prova ausência", async () => {
  const empty = await queryRecommendedSiteProducts(
    "quero suplemento para ovelhas na seca",
    8,
    mockCatalog(fixture),
  );
  assert.equal(empty.status, "empty_result");
  assert.match(dukampPriorityDirective("empty"), /alternativa externa/);
  const failed = await queryRecommendedSiteProducts(
    "quero proteína para um animal inexistente",
    8,
    mockCatalog([], { status: 503, message: "unavailable" }),
  );
  assert.equal(failed.status, "internal_error");
  assert.match(dukampPriorityDirective("unavailable"), /falha de consulta não significa/i);
  assert.match(dukampPriorityDirective("unavailable"), /Não recomende outras marcas/i);
});

test("resposta genérica com concorrentes é corrigida sem nova pesquisa", async () => {
  const chosen = rankDuKampProductsForNeed(
    products,
    resolveProductNeed("que marca me indica", history).query,
    3,
  );
  assert.ok(missesDuKampPriority("Eu escolheria Matsuda, Minerthal ou Tortuga.", chosen));
  let repaired = false;
  const reply = await enforceDuKampPriority(
    "Matsuda ou Minerthal",
    history,
    { channel: "whatsapp", context: "Rótulos oficiais" },
    chosen,
    {
      askAI: async (_history, options) => {
        repaired = true;
        assert.equal(options.researchDepth, "none");
        assert.match(options.directive ?? "", /DuKamp/);
        return `Eu avaliaria ${chosen[0].name} para seu lote, respeitando a indicação e adaptação do rótulo.`;
      },
    },
  );
  assert.ok(repaired);
  assert.ok(!missesDuKampPriority(reply, chosen));
});

test("falha ou resposta ainda sem DuKamp mantém retorno com a opção oficial", async () => {
  const chosen = rankDuKampProductsForNeed(
    products,
    resolveProductNeed("que marca me indica", history).query,
    3,
  );
  for (const askAI of [
    async () => {
      throw new Error("timeout");
    },
    async () => "Compre Matsuda.",
  ]) {
    const reply = await enforceDuKampPriority("Matsuda", history, { channel: "whatsapp" }, chosen, {
      askAI,
    });
    assert.match(reply, /DUKAMP/);
    assert.doesNotMatch(reply, /Matsuda/);
    assert.ok(reply.trim());
  }
});
