import assert from "node:assert/strict";
import test from "node:test";
import { findControlledIdentityMatches, type Match } from "../src/lib/rag/search.server.ts";
import { matchControlledProducts } from "../src/lib/chat/dukamp-control.ts";
import { filterControlledMatches } from "../src/lib/chat/dukamp-control.server.ts";
import { dukampSafetySnapshot } from "../src/seed/dukamp-control.ts";
import { DUKAMP_CATEGORY, type CatalogEnvelope } from "../src/lib/rag/dukamp-package.ts";

const question = "Posso usar Dukamp 60/S nos meus ovinos?";
const product = matchControlledProducts(question, dukampSafetySnapshot)[0];
function section(entry: CatalogEnvelope): Match {
  const source = entry.product.fontes[0];
  return {
    content: "Indicação documental para bovinos; sem liberação operacional.",
    title: entry.product.nome_comercial_documental + " - Indicação e restrições",
    filename: `dukamp_section_${entry.product.produto_id}-${source.source_id}-S01.json`,
    category: DUKAMP_CATEGORY,
    subcategory: "section",
    similarity: 0,
    metadata: {
      dukamp: {
        produto_id: entry.product.produto_id,
        source_id: source.source_id,
        source_sha256: source.sha256,
        versao_papel: source.versao_papel,
        referencias: [
          { evidence_id: source.source_id + "-S01", arquivo_original: source.arquivo_original },
        ],
      },
    },
  };
}
function database(rows: Match[], calls: string[] = [], error?: string) {
  return {
    from(table: string) {
      assert.equal(table, "knowledge_chunks");
      return {
        select() {
          return this;
        },
        contains(_column: string, value: { dukamp: { produto_id: string } }) {
          calls.push(value.dukamp.produto_id);
          return this;
        },
        async limit() {
          return { data: rows, error: error ? { message: error } : null };
        },
      };
    },
  };
}
test("uma pergunta longa encontra a identidade canônica e conserva fonte/hash sem aprovar uso", async () => {
  const calls: string[] = [];
  const matches = await findControlledIdentityMatches(
    database([section(product)], calls),
    question,
    dukampSafetySnapshot,
  );
  assert.deepEqual(calls, [product.product.produto_id]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].retrieval, "identity");
  assert.deepEqual(matches[0].metadata, section(product).metadata);
  assert.equal(product.product.recomendacao_operacional_liberada, false);
});
test("necessidade genérica não concede uma identidade por aproximação", async () => {
  const calls: string[] = [];
  assert.deepEqual(
    await findControlledIdentityMatches(
      database([section(product)], calls),
      "Como melhorar meu pasto?",
      dukampSafetySnapshot,
    ),
    [],
  );
  assert.deepEqual(calls, []);
});
test("comparação mantém as variantes separadas mesmo com linhas fora do filtro", async () => {
  const query = "Compare Dukamp 60/S e Dukamp 80/S";
  const named = matchControlledProducts(query, dukampSafetySnapshot);
  assert.equal(named.length, 2);
  const matches = await findControlledIdentityMatches(
    database(named.map(section)),
    query,
    dukampSafetySnapshot,
  );
  assert.deepEqual(
    new Set(matches.map((m) => m.metadata!.dukamp!.produto_id)),
    new Set(named.map((e) => e.product.produto_id)),
  );
  assert.equal(matches.length, 2);
});
test("hash diferente, identidade errada e registro de apoio não viram evidência canônica", async () => {
  const wrongHash = section(product);
  wrongHash.metadata!.dukamp!.source_sha256 = "0".repeat(64);
  const wrongProduct = section(product);
  wrongProduct.metadata!.dukamp!.produto_id = "P999";
  const support = section(product);
  support.filename = "dukamp_catalog_P039.json";
  const foreign = section(product);
  foreign.category = "pecuaria";
  assert.deepEqual(
    await findControlledIdentityMatches(
      database([wrongHash, wrongProduct, support, foreign]),
      question,
      dukampSafetySnapshot,
    ),
    [],
  );
});
test("falha no banco não é representada como evidência recuperada", async () => {
  await assert.rejects(
    findControlledIdentityMatches(
      database([], [], "Database timeout"),
      question,
      dukampSafetySnapshot,
    ),
    /Database timeout/,
  );
});

test("pergunta por uma variante exclui evidência de outra variante mesmo com alta similaridade", async () => {
  const other = matchControlledProducts("Dukamp 80/S", dukampSafetySnapshot)[0];
  const matches = await filterControlledMatches([section(product), section(other)], question);
  assert.deepEqual(
    matches.map((m) => m.metadata!.dukamp!.produto_id),
    [product.product.produto_id],
  );
});
test("comparação explícita preserva as duas variantes com suas próprias fontes", async () => {
  const query = "Compare Dukamp 60/S e Dukamp 80/S";
  const named = matchControlledProducts(query, dukampSafetySnapshot);
  const matches = await filterControlledMatches(named.map(section), query);
  assert.deepEqual(
    new Set(matches.map((m) => m.metadata!.dukamp!.source_id)),
    new Set(named.map((e) => e.product.fontes[0].source_id)),
  );
});
