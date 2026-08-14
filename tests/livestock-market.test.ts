import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLivestockQueryWithContext,
  type LivestockCategoryRow,
  type LivestockPlaceRow,
} from "../src/lib/market/livestock-parse.ts";
import {
  MAX_CURRENT_QUOTE_AGE_DAYS,
  selectLivestockCandidate,
} from "../src/lib/market/livestock-ranking.ts";
import { assessEvidence, sourceDirective } from "../src/lib/chat/source-policy.ts";

const categories: LivestockCategoryRow[] = [
  "boi-gordo",
  "vaca-gorda",
  "novilha-gorda",
  "boi-china",
].map((slug, index) => ({
  slug,
  nome: slug.replaceAll("-", " "),
  especie: "bovinos",
  unidade_padrao: "@",
  sinonimos: [slug.replaceAll("-", " ")],
  max_idade_dias: 30,
  ordem: index,
}));

const places: LivestockPlaceRow[] = [
  {
    slug: "sao-paulo",
    municipio: "São Paulo",
    uf: "SP",
    regiao: "Sudeste",
    is_praca_pecuaria: true,
    lat: -23.55,
    lon: -46.63,
    apelidos: ["capital paulista"],
  },
];

test("fresh statewide quote wins over a month-old exact-city quote", () => {
  const selected = selectLivestockCandidate([
    {
      value: "local-old",
      date: "2026-07-14",
      ageDays: 31,
      localityRank: 0,
    },
    {
      value: "state-today",
      date: "2026-08-14",
      ageDays: 0,
      localityRank: 2_000,
    },
  ]);

  assert.equal(selected?.value, "state-today");
});

test("locality only breaks a tie between quotes from the same date", () => {
  const selected = selectLivestockCandidate([
    { value: "state", date: "2026-08-13", ageDays: 1, localityRank: 2_000 },
    { value: "local", date: "2026-08-13", ageDays: 1, localityRank: 0 },
  ]);

  assert.equal(selected?.value, "local");
});

test("the three-day freshness rule applies to every slaughter category", () => {
  for (const category of categories) {
    const current = selectLivestockCandidate([
      {
        value: category.slug,
        date: "2026-08-12",
        ageDays: MAX_CURRENT_QUOTE_AGE_DAYS,
        localityRank: 0,
      },
    ]);
    const historical = selectLivestockCandidate([
      {
        value: category.slug,
        date: "2026-08-11",
        ageDays: MAX_CURRENT_QUOTE_AGE_DAYS + 1,
        localityRank: 0,
      },
    ]);

    assert.equal(current?.ageDays, 2, category.slug);
    assert.equal(historical?.ageDays, 3, category.slug);
    assert.ok((historical?.ageDays ?? 0) > MAX_CURRENT_QUOTE_AGE_DAYS, category.slug);
  }
});

test("livestock follow-ups retain place and can change category", () => {
  const parsed = parseLivestockQueryWithContext("e a vaca gorda?", categories, places, {
    previous: {
      categorySlug: "boi-gordo",
      placeSlug: "sao-paulo",
      uf: "SP",
      unit: "@",
    },
  });

  assert.equal(parsed?.category.slug, "vaca-gorda");
  assert.equal(parsed?.place?.slug, "sao-paulo");
  assert.equal(parsed?.uf, "SP");
  assert.equal(parsed?.unit, "@");
});

test("livestock follow-ups retain category and replace the requested state", () => {
  const parsed = parseLivestockQueryWithContext("e em Minas Gerais?", categories, places, {
    previous: {
      categorySlug: "vaca-gorda",
      placeSlug: "sao-paulo",
      uf: "SP",
      unit: "@",
    },
  });

  assert.equal(parsed?.category.slug, "vaca-gorda");
  assert.equal(parsed?.place, null);
  assert.equal(parsed?.uf, "MG");
});

test("a different commodity does not inherit livestock context", () => {
  const parsed = parseLivestockQueryWithContext("e o milho?", categories, places, {
    previous: { categorySlug: "boi-gordo", uf: "SP", unit: "@" },
  });

  assert.equal(parsed, null);
});

test("stale livestock evidence forces a current market search", () => {
  const directive = sourceDirective(
    assessEvidence({ market: true, requiresCurrentMarketSearch: true }),
  );

  assert.match(directive, /hoje, ontem e anteontem/i);
  assert.match(directive, /não trate registro histórico interno como preço atual/i);
  assert.match(directive, /preço, unidade, praça, data e fonte/i);
});
