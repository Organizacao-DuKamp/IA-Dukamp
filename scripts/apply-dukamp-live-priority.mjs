import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`Nenhuma alteração aplicada em ${path}`);
  await writeFile(path, after);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Trecho não encontrado: ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) {
    throw new Error(`Trecho ambíguo: ${label}`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

const ranker = `export interface RankableDuKampProduct {
  name: string;
  slug?: string | null;
  description?: string | null;
  brand?: string | null;
  code?: string | null;
  stock?: number | null;
  featured?: boolean | null;
}

const STOPWORDS = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "me", "meu", "meus",
  "minha", "minhas", "o", "os", "para", "por", "pra", "pro", "quero", "preciso", "procuro", "tem", "tenho",
  "um", "uma", "uns", "umas", "voces", "vcs", "algo", "alguma", "coisa", "produto", "produtos", "dukamp",
]);

const GOAL_GROUPS: Array<{ trigger: RegExp; terms: string[] }> = [
  { trigger: /\\b(seca|estiagem|periodo seco)\\b/, terms: ["seca", "estiagem", "periodo seco"] },
  { trigger: /\\b(engorda|ganho de peso|ganhar peso|terminacao|terminar)\\b/, terms: ["engorda", "ganho de peso", "ganho", "peso", "terminacao"] },
  { trigger: /\\b(recria|crescimento|desenvolvimento)\\b/, terms: ["recria", "crescimento", "desenvolvimento"] },
  { trigger: /\\b(cria|matriz|matrizes)\\b/, terms: ["cria", "matriz", "matrizes"] },
  { trigger: /\\b(aguas|periodo chuvoso|chuvas)\\b/, terms: ["aguas", "periodo chuvoso", "chuvas"] },
  { trigger: /\\b(confinamento|confinar)\\b/, terms: ["confinamento", "confinar"] },
  { trigger: /\\b(semi confinamento|semi-confinamento|semiconfinamento)\\b/, terms: ["semi confinamento", "semiconfinamento"] },
  { trigger: /\\b(leite|lactacao|lactante)\\b/, terms: ["leite", "lactacao", "lactante"] },
  { trigger: /\\b(bezerro|bezerros|creep)\\b/, terms: ["bezerro", "bezerros", "creep"] },
  { trigger: /\\b(ovino|ovinos|ovelha|ovelhas)\\b/, terms: ["ovino", "ovinos", "ovelha", "ovelhas"] },
  { trigger: /\\b(caprino|caprinos|cabra|cabras)\\b/, terms: ["caprino", "caprinos", "cabra", "cabras"] },
  { trigger: /\\b(equino|equinos|cavalo|cavalos)\\b/, terms: ["equino", "equinos", "cavalo", "cavalos"] },
  { trigger: /\\b(proteinado|proteico)\\b/, terms: ["proteinado", "proteico"] },
  { trigger: /\\b(mineral|mineralizacao)\\b/, terms: ["mineral", "mineralizacao"] },
];

export function normalizeDuKampNeed(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function termsForNeed(query: string): string[] {
  const normalized = normalizeDuKampNeed(query);
  const tokens = normalized.split(/\\s+/).filter((token) => token.length >= 3 && !STOPWORDS.has(token));
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
  const words = field.split(/\\s+/);
  if (term.length >= 5 && words.some((word) => word.startsWith(term.slice(0, Math.max(4, term.length - 2))))) {
    return weight * 0.55;
  }
  return 0;
}

export function rankDuKampProductsForNeed<T extends RankableDuKampProduct>(
  products: T[],
  query: string,
  limit = 8,
): T[] {
  const terms = termsForNeed(query);
  if (!terms.length) return [];

  return products
    .filter((product) => product.stock == null || product.stock > 0)
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
      return { product, score, matchedTerms };
    })
    .filter(({ score, matchedTerms }) => score >= 4 && matchedTerms >= 1)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedTerms - a.matchedTerms ||
        a.product.name.localeCompare(b.product.name, "pt-BR"),
    )
    .slice(0, limit)
    .map(({ product }) => product);
}
`;
await writeFile("src/lib/site/dukamp-product-ranking.ts", ranker);

await edit("src/lib/site/site-lookup.server.ts", (source) => {
  source = replaceOnce(
    source,
    'import type { IntentClassification } from "../chat/intent.ts";\n',
    'import type { IntentClassification } from "../chat/intent.ts";\nimport { rankDuKampProductsForNeed } from "./dukamp-product-ranking.ts";\n',
    "import ranker",
  );

  source = replaceOnce(
    source,
    `export interface SiteProduct {\n  id: string;\n  name: string;\n  code: string | null;\n  slug: string | null;\n  price: number | null;\n  active: boolean | null;\n  stock: number | null;\n  featured?: boolean | null;\n}`,
    `export interface SiteProduct {\n  id: string;\n  name: string;\n  code: string | null;\n  slug: string | null;\n  price: number | null;\n  active: boolean | null;\n  stock: number | null;\n  featured?: boolean | null;\n  description?: string | null;\n  images?: string[] | null;\n  brand?: string | null;\n  consumer_price?: number | null;\n  consumer_pix_price?: number | null;\n  producer_price?: number | null;\n  producer_pix_price?: number | null;\n  reseller_price?: number | null;\n  reseller_pix_price?: number | null;\n  installments?: number | null;\n  on_sale?: boolean | null;\n  sale_consumer_price?: number | null;\n  sale_consumer_pix_price?: number | null;\n}`,
    "SiteProduct rico",
  );

  const stopwordEnd = `  "todos",\n]);\n`;
  source = replaceOnce(
    source,
    stopwordEnd,
    `${stopwordEnd}\nconst PRODUCT_SELECT =\n  "id,name,code,slug,price,active,stock,featured,description,images,brand,consumer_price,consumer_pix_price,producer_price,producer_pix_price,reseller_price,reseller_pix_price,installments,on_sale,sale_consumer_price,sale_consumer_pix_price";\nconst PRODUCT_FALLBACK_SELECT = "id,name,code,slug,price,active,stock,featured";\n`,
    "product selects",
  );

  source = source.replaceAll(
    '.select("id,name,code,slug,price,active,stock,featured")',
    ".select(PRODUCT_SELECT)",
  );
  source = source.replaceAll(
    '.select("id,name,code,slug,active")',
    ".select(PRODUCT_FALLBACK_SELECT)",
  );

  source = replaceOnce(
    source,
    `      featured: p.featured ?? null,\n    }));`,
    `      featured: p.featured ?? null,\n      description: p.description ?? null,\n      images: Array.isArray(p.images) ? p.images.filter((item): item is string => typeof item === "string") : [],\n      brand: p.brand ?? null,\n      consumer_price: p.consumer_price ?? null,\n      consumer_pix_price: p.consumer_pix_price ?? null,\n      producer_price: p.producer_price ?? null,\n      producer_pix_price: p.producer_pix_price ?? null,\n      reseller_price: p.reseller_price ?? null,\n      reseller_pix_price: p.reseller_pix_price ?? null,\n      installments: p.installments ?? null,\n      on_sale: p.on_sale ?? null,\n      sale_consumer_price: p.sale_consumer_price ?? null,\n      sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,\n    }));`,
    "map rich products",
  );

  const beforeSellers = `\nexport async function querySiteSellers(`;
  const recommendationFunction = `\nexport async function queryRecommendedSiteProducts(\n  query: string,\n  limit = 8,\n  deps: SiteLookupDependencies = {},\n): Promise<SiteQueryResult<SiteProduct[]>> {\n  const operation = "products recommendation lookup";\n  if (!configured(deps)) return unavailable(operation, []);\n  const started = Date.now();\n  try {\n    const client = clientFor(deps);\n    let response: { data: unknown[] | null; error: unknown } = await client\n      .from("products")\n      .select(PRODUCT_SELECT)\n      .eq("active", true)\n      .limit(500);\n    if (response.error && classifyError(response.error).status === "schema_error") {\n      response = await client\n        .from("products")\n        .select(PRODUCT_FALLBACK_SELECT)\n        .eq("active", true)\n        .limit(500);\n    }\n    if (response.error) return finish(operation, started, [], response.error);\n    const products = ((response.data ?? []) as Array<Partial<SiteProduct> & { id: string; name: string }>).map(\n      (p) => ({\n        id: p.id,\n        name: p.name,\n        code: p.code ?? null,\n        slug: p.slug ?? null,\n        price: p.price ?? null,\n        active: p.active ?? true,\n        stock: p.stock ?? null,\n        featured: p.featured ?? null,\n        description: p.description ?? null,\n        images: Array.isArray(p.images) ? p.images.filter((item): item is string => typeof item === "string") : [],\n        brand: p.brand ?? null,\n        consumer_price: p.consumer_price ?? null,\n        consumer_pix_price: p.consumer_pix_price ?? null,\n        producer_price: p.producer_price ?? null,\n        producer_pix_price: p.producer_pix_price ?? null,\n        reseller_price: p.reseller_price ?? null,\n        reseller_pix_price: p.reseller_pix_price ?? null,\n        installments: p.installments ?? null,\n        on_sale: p.on_sale ?? null,\n        sale_consumer_price: p.sale_consumer_price ?? null,\n        sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,\n      }),\n    );\n    const ranked = rankDuKampProductsForNeed(products, query, limit);\n    return finish(operation, started, ranked);\n  } catch (error) {\n    return finish(operation, started, [], error);\n  }\n}\n`;
  source = replaceOnce(source, beforeSellers, `${recommendationFunction}${beforeSellers}`, "recommendation query");

  source = replaceOnce(
    source,
    `    const products = await querySiteProducts(\n      text,\n      12,\n      deps,\n      hints.listProducts || intent.intent === "product_recommendation" || PURPOSE_RE.test(text),\n    );`,
    `    const products =\n      intent.intent === "product_recommendation" || PURPOSE_RE.test(text)\n        ? await queryRecommendedSiteProducts(text, 8, deps)\n        : await querySiteProducts(text, 12, deps, hints.listProducts);`,
    "commercial recommendation route",
  );

  source = replaceOnce(
    source,
    `    const lines = look.products.map((p) => {\n      const price = p.price != null ? \` — \${fmtPrice(p.price)}\` : "";\n      const stock =\n        p.stock != null && p.stock > 0\n          ? " (em estoque)"\n          : p.stock === 0\n            ? " (sem estoque no momento)"\n            : "";\n      return \`- \${p.name}\${price}\${stock}\`;\n    });\n    parts.push(\`DADOS DO SITE DUKAMP — PRODUTOS COMERCIAIS:\\n\${lines.join("\\n")}\`);`,
    `    const lines = look.products.map((p) => {\n      const publicPrice = p.on_sale && p.sale_consumer_price != null ? p.sale_consumer_price : (p.consumer_price ?? p.price);\n      const publicPix = p.on_sale && p.sale_consumer_pix_price != null ? p.sale_consumer_pix_price : p.consumer_pix_price;\n      const details = [\n        p.brand ? \`marca: \${p.brand}\` : null,\n        p.code ? \`código: \${p.code}\` : null,\n        publicPrice != null ? \`preço público: \${fmtPrice(publicPrice)}\` : null,\n        publicPix != null ? \`Pix público: \${fmtPrice(publicPix)}\` : null,\n        p.installments && p.installments > 1 ? \`até \${p.installments}x\` : null,\n        p.stock != null ? \`estoque: \${p.stock}\` : null,\n      ].filter(Boolean);\n      const description = p.description?.trim() ? \`\\n  descrição oficial: \${p.description.trim().slice(0, 700)}\` : "";\n      const images = (p.images ?? []).filter(Boolean).slice(0, 3);\n      const imageLine = images.length ? \`\\n  imagens oficiais: \${images.join(" | ")}\` : "";\n      return \`- \${p.name}\${details.length ? \` — \${details.join("; ")}\` : ""}\${description}\${imageLine}\`;\n    });\n    parts.push(\`DADOS OFICIAIS E ATUAIS DA DUKAMP — PRODUTOS COMERCIAIS:\\n\${lines.join("\\n")}\`);`,
    "rich site block",
  );
  return source;
});

await edit("src/lib/chat/core.server.ts", (source) => {
  source = replaceOnce(
    source,
    `  let hasMarketEvidence = false;\n`,
    `  let hasMarketEvidence = false;\n  let needsExternalProductFallback = false;\n`,
    "fallback state",
  );

  source = replaceOnce(
    source,
    `      if (lookup.sellers?.length) {`,
    `      if (domainIntent.intent === "product_recommendation") {\n        const liveMatch = lookup.products?.some((product) => product.stock == null || product.stock > 0) ?? false;\n        const productStatus = commercial.statuses.find((status) => status.startsWith("site-products:"));\n        if (liveMatch) {\n          contextParts.push(\n            "PRIORIDADE DUKAMP: há produto(s) oficial(is), ativo(s) e disponível(is) recuperado(s) do catálogo vivo. Se forem tecnicamente adequados ao objetivo informado, recomende primeiro a melhor opção da DuKamp e explique por quê. Não force uma opção inadequada apenas por ser da DuKamp.",\n          );\n          retrieved.push("dukamp:priority-match");\n        } else {\n          needsExternalProductFallback = true;\n          const confirmedEmpty = productStatus === "site-products:empty_result";\n          contextParts.push(\n            confirmedEmpty\n              ? "FALLBACK COMERCIAL: o catálogo vivo da DuKamp foi consultado e não retornou produto adequado disponível para este objetivo. Pesquise na web uma alternativa externa confiável e deixe claro que ela NÃO é um produto DuKamp."\n              : "FALLBACK COMERCIAL: não foi possível confirmar uma opção adequada no catálogo vivo da DuKamp neste turno. Pesquise na web uma alternativa externa confiável, sem afirmar que a DuKamp não possui o produto e sem apresentar a alternativa como DuKamp.",\n          );\n          retrieved.push(confirmedEmpty ? "dukamp:fallback-empty" : "dukamp:fallback-unavailable");\n        }\n      }\n      if (lookup.sellers?.length) {`,
    "DuKamp first / external fallback",
  );

  source = replaceOnce(
    source,
    `        : domainIntent.needs_web_search || requiresCurrentMarketSearch;`,
    `        : domainIntent.needs_web_search || requiresCurrentMarketSearch || needsExternalProductFallback;`,
    "conditional web fallback",
  );

  source = replaceOnce(
    source,
    `          routerInput,\n          currentMarketDetails ? \`Contexto confirmado da cotação: \${currentMarketDetails}.\` : null,`,
    `          routerInput,\n          needsExternalProductFallback\n            ? "O catálogo vivo da DuKamp não trouxe uma opção adequada confirmada. Pesquise uma alternativa comercial externa tecnicamente pertinente e confiável; não a apresente como produto DuKamp."\n            : null,\n          currentMarketDetails ? \`Contexto confirmado da cotação: \${currentMarketDetails}.\` : null,`,
    "fallback research query",
  );
  return source;
});

await edit("src/lib/chat/intent.ts", (source) => {
  const anchor = `  [\n    "product_recommendation",\n    /\\b(recomend\\w*|qual produto|qual suplemento|melhor para|indiqu\\w*|produto para)\\b/i,\n    true,\n    false,\n  ],`;
  const expanded = `  [\n    "product_recommendation",\n    /\\b(?:tem|t[eê]m|quero|preciso|procuro|busco|alguma coisa|algo|op[cç][aã]o)\\b.{0,100}\\b(?:engorda|ganho de peso|ganhar peso|seca|[áa]guas|recria|cria|termina[cç][aã]o|confinamento|semi[- ]?confinamento|lacta[cç][aã]o|leite|bezerros?|suplemento|ra[cç][aã]o|proteinado|mineral)\\b|\\b(?:engorda|ganho de peso|ganhar peso|seca|[áa]guas|recria|cria|termina[cç][aã]o|confinamento|semi[- ]?confinamento|lacta[cç][aã]o|leite|bezerros?)\\b.{0,100}\\b(?:produto|suplemento|ra[cç][aã]o|proteinado|mineral|op[cç][aã]o)\\b/i,\n    true,\n    false,\n  ],\n${anchor}`;
  source = replaceOnce(source, anchor, expanded, "natural product recommendation intent");

  source = replaceOnce(
    source,
    `  const hit = isWeatherRequest(normalized)\n    ? (["weather_forecast", /$^/, true, true] as const)\n    : rules.find(([, pattern]) => pattern.test(normalized));`,
    `  const productImageFollowUp =\n    hasHistory &&\n    /^(?:(?:manda|mande|mostra|mostre|quero|tem)\\s+)?(?:a\\s+)?(?:foto|imagem)(?:\\s+(?:dele|dela|desse|dessa|do produto))?\\s*[?.!]*$/i.test(\n      normalized,\n    );\n  const hit = isWeatherRequest(normalized)\n    ? (["weather_forecast", /$^/, true, true] as const)\n    : productImageFollowUp\n      ? (["product", /$^/, true, false] as const)\n      : rules.find(([, pattern]) => pattern.test(normalized));`,
    "product photo follow-up",
  );
  return source;
});

await edit("src/lib/chat/system-prompt.ts", (source) =>
  replaceOnce(
    source,
    `DUKAMP\n- Para produtos, vendedores, preços, disponibilidade, contatos e informações comerciais da DuKamp, prefira os dados oficiais recuperados pelo sistema.\n- Nunca invente produto, composição, indicação, preço, estoque, vendedor ou contato da DuKamp.\n- Se a base oficial não confirmar um fato comercial específico, deixe isso claro. Informação genérica da internet não deve ser tratada como dado oficial da DuKamp.\n- Em recomendação de produto, combine a necessidade técnica do animal com as informações oficiais realmente disponíveis; não force uma venda quando faltarem dados.`,
    `DUKAMP — PRIORIDADE COMERCIAL VIVA\n- Para pedidos de produto, suplemento, ração, mineral ou solução para objetivos como seca, engorda, ganho de peso, cria, recria, águas, leite, confinamento e semi-confinamento, avalie PRIMEIRO os produtos oficiais da DuKamp recuperados do catálogo vivo.\n- Se houver uma opção DuKamp ativa, disponível e tecnicamente adequada ao objetivo do produtor, recomende-a antes de alternativas externas e explique a adequação usando apenas os dados oficiais e seu raciocínio técnico.\n- Prioridade não significa propaganda cega: nunca recomende um produto inadequado à espécie, categoria, objetivo ou situação só por ser DuKamp.\n- Se o sistema informar que não encontrou opção DuKamp adequada, aí sim use a pesquisa web e apresente uma alternativa externa confiável, identificando claramente que NÃO é produto DuKamp.\n- Para produtos, vendedores, preços, disponibilidade, contatos, descrições e imagens da DuKamp, os dados oficiais recuperados pelo sistema prevalecem.\n- Nunca invente produto, composição, indicação, descrição, imagem, preço, estoque, vendedor ou contato da DuKamp.\n- Para usuário sem faixa comercial identificada, trate consumer_price/sale_consumer_price como preço público de referência e consumer_pix_price/sale_consumer_pix_price como preço Pix público. Não revele preço de produtor ou revenda sem contexto/autorização que justifique essa faixa.\n- Quando o usuário pedir foto/imagem de um produto e houver URL oficial em 'imagens oficiais', inclua a primeira URL oficial em uma linha própria na resposta; no WhatsApp o backend a converterá em envio de imagem. Nunca use foto genérica da internet para representar um produto DuKamp.\n- Se a base oficial não confirmar um fato comercial específico, deixe isso claro. Informação genérica da internet não deve ser tratada como dado oficial da DuKamp.\n- Em recomendação de produto, combine a necessidade técnica do animal com as informações oficiais realmente disponíveis; não force uma venda quando faltarem dados.`,
    "DuKamp system policy",
  ),
);

await edit("src/lib/whatsapp/enhanced-http.server.ts", (source) => {
  const splitEnd = `  return chunks;\n}\n\nasync function sendWhatsAppText(`;
  const imageHelpers = `  return chunks;\n}\n\nfunction extractOfficialImageUrls(body: string): string[] {\n  const urls = body.match(/https:\\/\\/[^\\s<>()]+/g) ?? [];\n  const unique = new Set<string>();\n  for (const raw of urls) {\n    const candidate = raw.replace(/[),.;]+$/, "");\n    try {\n      const url = new URL(candidate);\n      if (!/^https:$/.test(url.protocol)) continue;\n      if (!/\\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname)) continue;\n      unique.add(url.toString());\n    } catch {\n      // URL inválida: não converta em mídia.\n    }\n    if (unique.size >= 3) break;\n  }\n  return [...unique];\n}\n\nasync function sendWhatsAppImage(\n  to: string,\n  imageUrl: string,\n  env: EnvLike,\n  fetchImpl: typeof fetch,\n): Promise<void> {\n  const accessToken = requireEnv(env, "WHATSAPP_ACCESS_TOKEN");\n  const phoneNumberId = requireEnv(env, "WHATSAPP_PHONE_NUMBER_ID");\n  const version = (env.WHATSAPP_GRAPH_API_VERSION?.trim() || "v25.0").replace(/^\\/+|\\/+$/g, "");\n  if (!/^v\\d+\\.\\d+$/.test(version)) throw new Error("invalid_whatsapp_graph_api_version");\n  const response = await fetchImpl(\n    \`https://graph.facebook.com/\${version}/\${encodeURIComponent(phoneNumberId)}/messages\`,\n    {\n      method: "POST",\n      headers: { authorization: \`Bearer \${accessToken}\`, "content-type": "application/json" },\n      body: JSON.stringify({\n        messaging_product: "whatsapp",\n        recipient_type: "individual",\n        to,\n        type: "image",\n        image: { link: imageUrl },\n      }),\n      redirect: "error",\n    },\n  );\n  if (!response.ok) throw new Error(\`whatsapp_image_send_failed:\${response.status}\`);\n}\n\nasync function sendWhatsAppText(`;
  source = replaceOnce(source, splitEnd, imageHelpers, "WhatsApp image helpers");

  source = replaceOnce(
    source,
    `  for (const chunk of splitOutboundText(body)) {`,
    `  const imageUrls = extractOfficialImageUrls(body);\n  const textBody = imageUrls\n    .reduce((value, url) => value.replaceAll(url, ""), body)\n    .replace(/\\n{3,}/g, "\\n\\n")\n    .trim();\n\n  for (const chunk of splitOutboundText(textBody)) {`,
    "strip image urls from WhatsApp text",
  );

  const sendTextEnd = `    if (!response.ok) throw new Error(\`whatsapp_send_failed:\${response.status}\`);\n  }\n}`;
  source = replaceOnce(
    source,
    sendTextEnd,
    `    if (!response.ok) throw new Error(\`whatsapp_send_failed:\${response.status}\`);\n  }\n\n  for (const imageUrl of imageUrls) {\n    await sendWhatsAppImage(to, imageUrl, env, fetchImpl);\n  }\n}`,
    "send extracted WhatsApp images",
  );
  return source;
});

const tests = `import assert from "node:assert/strict";\nimport test from "node:test";\n\nimport { classifyDomainIntent } from "../src/lib/chat/intent.ts";\nimport { rankDuKampProductsForNeed } from "../src/lib/site/dukamp-product-ranking.ts";\n\ntest("pedido natural de produto para engorda vira recomendação comercial", () => {\n  assert.equal(classifyDomainIntent("quero alguma coisa para engorda na seca").intent, "product_recommendation");\n});\n\ntest("pedido de foto em continuidade volta ao produto", () => {\n  assert.equal(classifyDomainIntent("manda a foto dele", true).intent, "product");\n});\n\ntest("ranking prioriza produto DuKamp compatível com seca e engorda e ignora sem estoque", () => {\n  const products = [\n    { name: "Proteico Seca Engorda Gold", slug: "proteico-seca-engorda-gold", description: "suplemento para período seco e terminação", stock: 12 },\n    { name: "Mineral Águas", slug: "mineral-aguas", description: "mineral para período das águas", stock: 20 },\n    { name: "Proteico Seca Engorda Premium", slug: "seca-engorda-premium", description: "seca e ganho de peso", stock: 0 },\n  ];\n  const ranked = rankDuKampProductsForNeed(products, "preciso de um produto para engorda na seca", 5);\n  assert.equal(ranked[0]?.name, "Proteico Seca Engorda Gold");\n  assert.equal(ranked.some((item) => item.stock === 0), false);\n});\n`;
await writeFile("tests/dukamp-live-priority.test.ts", tests);

console.log("Integração DuKamp live-first aplicada.");
