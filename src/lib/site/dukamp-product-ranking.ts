import { productPlainText, technicalProductSections } from "./product-technical-text.ts";

export interface RankableDuKampProduct {
  name: string;
  slug?: string | null;
  description?: string | null;
  brand?: string | null;
  code?: string | null;
  stock?: number | null;
  featured?: boolean | null;
}

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "me",
  "meu",
  "meus",
  "minha",
  "minhas",
  "o",
  "os",
  "para",
  "por",
  "pra",
  "pro",
  "quero",
  "preciso",
  "procuro",
  "tem",
  "tenho",
  "um",
  "uma",
  "uns",
  "umas",
  "voces",
  "vcs",
  "algo",
  "alguma",
  "coisa",
  "produto",
  "produtos",
  "dukamp",
  "qual",
  "quais",
  "que",
  "marca",
  "marcas",
  "indica",
  "indique",
  "indicar",
  "sugere",
  "sugestao",
  "recomenda",
  "recomendar",
  "melhor",
  "presciso",
  "usar",
]);

const GOAL_GROUPS: Array<{ trigger: RegExp; terms: string[] }> = [
  { trigger: /\b(seca|estiagem|periodo seco)\b/, terms: ["seca", "estiagem", "periodo seco"] },
  {
    trigger: /\b(engorda|ganho de peso|ganhar peso|terminacao|terminar)\b/,
    terms: ["engorda", "ganho de peso", "ganho", "peso", "terminacao"],
  },
  {
    trigger: /\b(recria|crescimento|desenvolvimento)\b/,
    terms: ["recria", "crescimento", "desenvolvimento"],
  },
  { trigger: /\b(cria|matriz|matrizes)\b/, terms: ["cria", "matriz", "matrizes"] },
  { trigger: /\b(aguas|periodo chuvoso|chuvas)\b/, terms: ["aguas", "periodo chuvoso", "chuvas"] },
  { trigger: /\b(confinamento|confinar)\b/, terms: ["confinamento", "confinar"] },
  {
    trigger: /\b(semi confinamento|semi-confinamento|semiconfinamento)\b/,
    terms: ["semi confinamento", "semiconfinamento"],
  },
  { trigger: /\b(leite|lactacao|lactante)\b/, terms: ["leite", "lactacao", "lactante"] },
  { trigger: /\b(bezerro|bezerros|creep)\b/, terms: ["bezerro", "bezerros", "creep"] },
  { trigger: /\b(ovino|ovinos|ovelha|ovelhas)\b/, terms: ["ovino", "ovinos", "ovelha", "ovelhas"] },
  {
    trigger: /\b(caprino|caprinos|cabra|cabras)\b/,
    terms: ["caprino", "caprinos", "cabra", "cabras"],
  },
  {
    trigger: /\b(equino|equinos|cavalo|cavalos)\b/,
    terms: ["equino", "equinos", "cavalo", "cavalos"],
  },
  { trigger: /\b(proteinado|proteico)\b/, terms: ["proteinado", "proteico", "proteica"] },
  { trigger: /\b(mineral|mineralizacao)\b/, terms: ["mineral", "mineralizacao"] },
];

export function normalizeDuKampNeed(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function termsForNeed(query: string): string[] {
  const normalized = normalizeDuKampNeed(query);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !STOPWORDS.has(token));
  const expanded = [...tokens];
  for (const group of GOAL_GROUPS) {
    if (group.trigger.test(normalized)) expanded.push(...group.terms);
  }
  return [...new Set(expanded.map(normalizeDuKampNeed).filter(Boolean))];
}

function fieldScore(field: string, term: string, weight: number): number {
  if (!field || !term) return 0;
  if (field === term) return weight * 1.5;
  if (field.includes(term)) return weight;
  const words = field.split(/\s+/);
  if (
    term.length >= 5 &&
    words.some((word) => word.startsWith(term.slice(0, Math.max(4, term.length - 2))))
  ) {
    return weight * 0.55;
  }
  return 0;
}

export function isOwnDuKampBrand(product: RankableDuKampProduct): boolean {
  return /\bdukamp\b/.test(normalizeDuKampNeed(`${product.brand ?? ""} ${product.name}`));
}

const SPECIES = [
  { key: "bovinos", pattern: /\b(?:bovino\w*|gado|bois?|vaca\w*|nelore|novilh\w*|bezerro\w*)\b/ },
  { key: "ovinos", pattern: /\b(?:ovino\w*|ovelh\w*|carneiro\w*)\b/ },
  { key: "caprinos", pattern: /\b(?:caprino\w*|cabra\w*|bode\w*)\b/ },
  { key: "equinos", pattern: /\b(?:equino\w*|equideo\w*|cavalo\w*|egua\w*|potro\w*)\b/ },
];

export function isDuKampProductCompatible(product: RankableDuKampProduct, query: string): boolean {
  const need = normalizeDuKampNeed(query);
  const name = normalizeDuKampNeed(product.name);
  const sections = technicalProductSections(product.description ?? "");
  const description = productPlainText(product.description ?? "");
  const indication = Object.entries(sections).find(([key]) => key.startsWith("indicacoes"))?.[1];
  const positive = normalizeDuKampNeed(indication ?? description.split(/\bn[aã]o\b/i)[0]);
  const nutrition = /\b(?:suplement\w*|proteinado|proteico|racao|mineral|sal|nucleo|concentrado)\b/;
  if (
    /\b(?:proteinado|proteico)\b/.test(need) &&
    !/\b(?:proteinado|proteico|proteica)\b/.test(`${name} ${positive}`)
  )
    return false;
  if (nutrition.test(need) && !nutrition.test(`${name} ${positive}`) && !/proteica/.test(positive))
    return false;
  if (!nutrition.test(`${name} ${positive}`) && !/proteica/.test(positive)) return true;
  const targets = SPECIES.filter((species) => species.pattern.test(need));
  const label = description
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const officialSpecies =
    label.match(/especie animal a que se destina\s*:\s*([^\n]{1,120})/)?.[1] ?? positive;
  const indicated = SPECIES.filter((species) => species.pattern.test(officialSpecies));
  if (
    targets.length &&
    indicated.length &&
    !targets.some((target) => indicated.some((item) => item.key === target.key))
  )
    return false;
  const milkNeed = /\b(?:leite|leiteira\w*|lactacao|lactante)\b/.test(need);
  if (milkNeed && /bovinos de corte/.test(positive) && !/leiteir|lactacao|leite/.test(positive))
    return false;
  {
    // Use sentenças, sem arrastar a espécie da frase seguinte para uma restrição.
    const warnings = description
      .split(/\n|(?<=[.!?])\s+/)
      .filter((sentence) => /n[aã]o (?:fornecer|usar|utilizar|administrar)/i.test(sentence));
    if (
      targets.some((target) =>
        warnings.some((sentence) => {
          const warning = normalizeDuKampNeed(sentence);
          if (target.key === "bovinos" && /leiteir/.test(warning) && !milkNeed) return false;
          return target.pattern.test(warning);
        }),
      )
    )
      return false;
  }
  const dry = /\b(?:seca|seco|estiagem)\b/.test(need);
  const rainy = /\b(?:aguas|chuvoso|chuvosa|chuvas)\b/.test(need);
  const indicatedDry = /\b(?:seca|seco|estiagem)\b/.test(indication ? positive : name);
  const indicatedRainy = /\b(?:aguas|chuvoso|chuvosa|chuvas)\b/.test(indication ? positive : name);
  if (dry && !rainy && indicatedRainy && !indicatedDry) return false;
  if (rainy && !dry && indicatedDry && !indicatedRainy) return false;
  return true;
}

export function rankDuKampProductsForNeed<T extends RankableDuKampProduct>(
  products: T[],
  query: string,
  limit = 8,
): T[] {
  const terms = termsForNeed(query);
  if (!terms.length) return [];

  return products
    .filter(
      (product) =>
        (product.stock == null || product.stock > 0) && isDuKampProductCompatible(product, query),
    )
    .map((product) => {
      const name = normalizeDuKampNeed(product.name);
      const slug = normalizeDuKampNeed(product.slug ?? "");
      const description = normalizeDuKampNeed(product.description ?? "");
      const brand = normalizeDuKampNeed(product.brand ?? "");
      const code = normalizeDuKampNeed(product.code ?? "");
      let score = product.featured ? 0.25 : 0;
      let matchedTerms = 0;
      for (const term of terms) {
        const termScore =
          fieldScore(name, term, 5) +
          fieldScore(slug, term, 3.5) +
          fieldScore(description, term, 1.6) +
          fieldScore(code, term, 2.5) +
          fieldScore(brand, term, 0.8);
        if (termScore > 0) matchedTerms += 1;
        score += termScore;
      }
      const normalizedQuery = normalizeDuKampNeed(query);
      if (name && normalizedQuery.includes(name)) score += 10;
      return { product, score, matchedTerms, ownBrand: isOwnDuKampBrand(product) };
    })
    .filter(({ score, matchedTerms }) => score >= 1.5 && matchedTerms >= 1)
    .sort(
      (a, b) =>
        Number(b.ownBrand) - Number(a.ownBrand) ||
        b.score - a.score ||
        b.matchedTerms - a.matchedTerms ||
        a.product.name.localeCompare(b.product.name, "pt-BR"),
    )
    .slice(0, limit)
    .map(({ product }) => product);
}
