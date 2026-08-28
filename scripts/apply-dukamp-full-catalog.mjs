import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`Nenhuma alteração aplicada em ${path}`);
  await writeFile(path, after, "utf8");
}

function once(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Trecho não encontrado: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Trecho ambíguo: ${label}`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

await edit("src/lib/site/site-lookup.server.ts", (source) => {
  source = once(
    source,
    'import { rankDuKampProductsForNeed } from "./dukamp-product-ranking.ts";\n',
    'import { rankDuKampProductsForNeed } from "./dukamp-product-ranking.ts";\nimport { DUKAMP_CATALOG_SNAPSHOT } from "./dukamp-catalog.snapshot.ts";\n',
    "snapshot import",
  );
  source = once(
    source,
    '  | "empty_result";',
    '  | "empty_result"\n  | "snapshot";',
    "snapshot status",
  );
  source = once(
    source,
    '  sale_consumer_pix_price?: number | null;\n}',
    '  sale_consumer_pix_price?: number | null;\n  category_id?: string | null;\n  catalog_id?: string | null;\n  weight?: number | null;\n  peso?: number | null;\n  altura?: number | null;\n  largura?: number | null;\n  comprimento?: number | null;\n  updated_at?: string | null;\n  source?: "live" | "live+snapshot" | "snapshot";\n}',
    "product fields",
  );
  source = once(
    source,
    '  display_order?: number | null;\n}',
    '  display_order?: number | null;\n  slug?: string | null;\n  show_on_team?: boolean | null;\n  photo_url?: string | null;\n  cutout_url?: string | null;\n  banner_url?: string | null;\n  source?: "live" | "live+snapshot" | "snapshot";\n}',
    "seller fields",
  );
  source = once(
    source,
    'const PRODUCT_RE =\n  /\\b(produtos?|suplementos?|ra[cç][aã]o|mineral|proteinado|dukamp|bezerro|recria|seca)\\b/i;\n',
    'const PRODUCT_RE =\n  /\\b(produtos?|suplementos?|ra[cç][aã]o|mineral|proteinado|dukamp|bezerro|recria|seca)\\b/i;\nconst PRODUCT_ASSET_RE =\n  /\\b(foto|imagem|descri[cç][aã]o|detalhes?|ficha\\s+t[eé]cnica|bula)\\b.{0,40}\\b(do|da|de|desse|dessa|sobre)\\b.{1,100}/i;\n',
    "asset intent",
  );
  source = once(
    source,
    '  "todos",\n]);',
    '  "todos",\n  "manda",\n  "mande",\n  "mostra",\n  "mostre",\n  "imagem",\n  "foto",\n  "descricao",\n  "detalhes",\n  "ficha",\n  "tecnica",\n  "bula",\n  "dele",\n  "dela",\n  "desse",\n  "dessa",\n]);',
    "search stopwords",
  );
  source = once(
    source,
    'const PRODUCT_SELECT =\n  "id,name,code,slug,price,active,stock,featured,description,images,brand,consumer_price,consumer_pix_price,producer_price,producer_pix_price,reseller_price,reseller_pix_price,installments,on_sale,sale_consumer_price,sale_consumer_pix_price";',
    'const PRODUCT_SELECT =\n  "id,name,code,slug,price,active,stock,featured,description,images,brand,consumer_price,consumer_pix_price,producer_price,producer_pix_price,reseller_price,reseller_pix_price,installments,on_sale,sale_consumer_price,sale_consumer_pix_price,category_id,catalog_id,weight,peso,altura,largura,comprimento,updated_at";',
    "rich product select",
  );
  source = once(
    source,
    '    product: PRODUCT_RE.test(text),\n    listProducts: PRODUCT_RE.test(text) && LIST_RE.test(text),',
    '    product: PRODUCT_RE.test(text) || PRODUCT_ASSET_RE.test(text),\n    productAsset: PRODUCT_ASSET_RE.test(text),\n    listProducts: PRODUCT_RE.test(text) && LIST_RE.test(text),',
    "asset hint",
  );

  const helperAnchor = `function fuzzyTokenHit(token: string, words: string[]): boolean {\n  return words.some(\n    (word) =>\n      word.includes(token) ||\n      token.includes(word) ||\n      (token.length >= 4 &&\n        Math.abs(word.length - token.length) <= 2 &&\n        editDistance(token, word) <= 2),\n  );\n}\n`;
  const helpers = `${helperAnchor}\nconst snapshotProducts = DUKAMP_CATALOG_SNAPSHOT.products;\nconst snapshotSellers = DUKAMP_CATALOG_SNAPSHOT.sellers;\nconst snapshotById = new Map(snapshotProducts.map((product) => [product.id, product]));\nconst snapshotByCode = new Map(\n  snapshotProducts.filter((product) => product.code).map((product) => [normalizeName(product.code ?? ""), product]),\n);\nconst snapshotBySlug = new Map(\n  snapshotProducts.filter((product) => product.slug).map((product) => [normalizeName(product.slug ?? ""), product]),\n);\nconst snapshotByName = new Map(snapshotProducts.map((product) => [normalizeName(product.name), product]));\nconst snapshotSellerById = new Map(snapshotSellers.map((seller) => [seller.id, seller]));\n\nfunction snapshotToSiteProduct(product: (typeof snapshotProducts)[number]): SiteProduct {\n  return {\n    id: product.id,\n    name: product.name,\n    code: product.code ?? null,\n    slug: product.slug ?? null,\n    price: null,\n    active: product.active ?? true,\n    stock: null,\n    description: product.description ?? null,\n    images: [...(product.images ?? [])],\n    brand: product.brand ?? null,\n    category_id: product.category_id ?? null,\n    catalog_id: product.catalog_id ?? null,\n    weight: product.weight ?? null,\n    peso: product.peso ?? null,\n    altura: product.altura ?? null,\n    largura: product.largura ?? null,\n    comprimento: product.comprimento ?? null,\n    updated_at: product.updated_at ?? null,\n    source: "snapshot",\n  };\n}\n\nfunction snapshotForProduct(product: SiteProduct) {\n  return (\n    snapshotById.get(product.id) ??\n    (product.code ? snapshotByCode.get(normalizeName(product.code)) : undefined) ??\n    (product.slug ? snapshotBySlug.get(normalizeName(product.slug)) : undefined) ??\n    snapshotByName.get(normalizeName(product.name))\n  );\n}\n\nfunction enrichProductFromSnapshot(product: SiteProduct): SiteProduct {\n  const snapshot = snapshotForProduct(product);\n  if (!snapshot) return { ...product, source: "live" };\n  const liveDescription = product.description?.trim() ?? "";\n  const snapshotDescription = snapshot.description?.trim() ?? "";\n  const description =\n    snapshotDescription.length > liveDescription.length ? snapshotDescription : liveDescription || null;\n  const images = [...new Set([...(product.images ?? []), ...(snapshot.images ?? [])].filter(Boolean))];\n  const supplemented =\n    description !== (product.description?.trim() || null) ||\n    images.length !== (product.images ?? []).length;\n  return {\n    ...product,\n    description,\n    images,\n    brand: product.brand ?? snapshot.brand ?? null,\n    category_id: product.category_id ?? snapshot.category_id ?? null,\n    catalog_id: product.catalog_id ?? snapshot.catalog_id ?? null,\n    weight: product.weight ?? snapshot.weight ?? null,\n    peso: product.peso ?? snapshot.peso ?? null,\n    altura: product.altura ?? snapshot.altura ?? null,\n    largura: product.largura ?? snapshot.largura ?? null,\n    comprimento: product.comprimento ?? snapshot.comprimento ?? null,\n    updated_at: product.updated_at ?? snapshot.updated_at ?? null,\n    source: supplemented ? "live+snapshot" : "live",\n  };\n}\n\nfunction queryTokens(query: string): string[] {\n  return normalizeName(query)\n    .replace(/[^a-z0-9\\s/]/g, " ")\n    .trim()\n    .split(/\\s+/)\n    .filter((token) => token.length >= 2 && !PRODUCT_SEARCH_STOPWORDS.has(token))\n    .slice(0, 10);\n}\n\nfunction searchSnapshotProducts(query: string, limit: number, listAll = false): SiteProduct[] {\n  if (listAll) return snapshotProducts.slice(0, limit).map(snapshotToSiteProduct);\n  const tokens = queryTokens(query);\n  if (!tokens.length) return snapshotProducts.slice(0, limit).map(snapshotToSiteProduct);\n  const normalizedQuery = normalizeName(query);\n  return snapshotProducts\n    .map((product) => {\n      const name = normalizeName(product.name);\n      const code = normalizeName(product.code ?? "");\n      const slug = normalizeName(product.slug ?? "");\n      const brand = normalizeName(product.brand ?? "");\n      const description = normalizeName(stripHtml(product.description ?? "").slice(0, 12000));\n      const words = \`${"${name} ${code} ${slug} ${brand} ${description}"}\`.split(/\\s+/).filter(Boolean);\n      const hits = tokens.filter((token) => fuzzyTokenHit(token, words)).length;\n      let score = hits / tokens.length;\n      if (name && normalizedQuery.includes(name)) score += 2;\n      if (code && normalizedQuery.includes(code)) score += 2;\n      return { product, score };\n    })\n    .filter(({ score }) => score >= 0.34)\n    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "pt-BR"))\n    .slice(0, limit)\n    .map(({ product }) => snapshotToSiteProduct(product));\n}\n\nfunction finishSnapshot(operation: string, started: number, data: SiteProduct[]): SiteQueryResult<SiteProduct[]> {\n  const result: SiteQueryResult<SiteProduct[]> = {\n    status: data.length ? "snapshot" : "empty_result",\n    data,\n    errorCode: data.length ? "live_catalog_fallback" : null,\n    durationMs: Date.now() - started,\n    count: data.length,\n  };\n  logQuery(operation, result);\n  return result;\n}\n`;
  source = once(source, helperAnchor, helpers, "snapshot helpers");

  source = source.replace(
    '    const normalized = normalizeName(query)\n      .replace(/[^a-z0-9\\s/]/g, " ")\n      .trim();\n    const tokens = normalized\n      .split(/\\s+/)\n      .filter((token) => token.length >= 2 && !PRODUCT_SEARCH_STOPWORDS.has(token))\n      .slice(0, 8);',
    '    const tokens = queryTokens(query);',
  );
  source = source.replace(
    '.limit(100);\n      if (response.error && classifyError(response.error).status === "schema_error")',
    '.limit(500);\n      if (response.error && classifyError(response.error).status === "schema_error")',
  );
  source = source.replace(
    '.eq("active", true)\n          .limit(100);',
    '.eq("active", true)\n          .limit(500);',
  );

  const mapTail = '      sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,\n    }));';
  const richMapTail = '      sale_consumer_pix_price: p.sale_consumer_pix_price ?? null,\n      category_id: p.category_id ?? null,\n      catalog_id: p.catalog_id ?? null,\n      weight: p.weight ?? null,\n      peso: p.peso ?? null,\n      altura: p.altura ?? null,\n      largura: p.largura ?? null,\n      comprimento: p.comprimento ?? null,\n      updated_at: p.updated_at ?? null,\n      source: "live" as const,\n    })).map(enrichProductFromSnapshot);';
  if ((source.match(new RegExp(mapTail.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "g")) ?? []).length !== 2) {
    throw new Error("Esperava dois mapeamentos de produto");
  }
  source = source.replaceAll(mapTail, richMapTail);

  source = once(
    source,
    '        const name = normalizeName(product.name);\n        const code = normalizeName(product.code ?? "");\n        const words = `${name} ${code}`.split(/\\s+/).filter(Boolean);\n        const distanceHits = tokens.filter((token) => fuzzyTokenHit(token, words)).length;',
    '        const name = normalizeName(product.name);\n        const code = normalizeName(product.code ?? "");\n        const slug = normalizeName(product.slug ?? "");\n        const brand = normalizeName(product.brand ?? "");\n        const description = normalizeName(stripHtml(product.description ?? "").slice(0, 12000));\n        const words = `${name} ${code} ${slug} ${brand} ${description}`.split(/\\s+/).filter(Boolean);\n        const distanceHits = tokens.filter((token) => fuzzyTokenHit(token, words)).length;',
    "description-aware rank",
  );

  const directError = '    if (response.error) return finish(operation, started, [], response.error);\n    const products = (';
  source = once(
    source,
    directError,
    '    if (response.error) {\n      const snapshot = searchSnapshotProducts(query, limit, listAll);\n      if (snapshot.length) return finishSnapshot(operation, started, snapshot);\n      return finish(operation, started, [], response.error);\n    }\n    const products = (',
    "direct snapshot fallback",
  );
  source = once(
    source,
    '    return finish(operation, started, ranked);\n  } catch (error) {\n    return finish(operation, started, [], error);\n  }\n}\n\nexport async function queryRecommendedSiteProducts(',
    '    if (ranked.length) return finish(operation, started, ranked);\n    return finishSnapshot(operation, started, searchSnapshotProducts(query, limit));\n  } catch (error) {\n    const snapshot = searchSnapshotProducts(query, limit);\n    return snapshot.length ? finishSnapshot(operation, started, snapshot) : finish(operation, started, [], error);\n  }\n}\n\nexport async function queryRecommendedSiteProducts(',
    "direct empty snapshot fallback",
  );

  const recError = '    if (response.error) return finish(operation, started, [], response.error);\n    const products = (';
  source = once(
    source,
    recError,
    '    if (response.error) {\n      const snapshot = rankDuKampProductsForNeed(\n        snapshotProducts.map(snapshotToSiteProduct),\n        query,\n        limit,\n      );\n      if (snapshot.length) return finishSnapshot(operation, started, snapshot);\n      return finish(operation, started, [], response.error);\n    }\n    const products = (',
    "recommendation snapshot fallback",
  );
  source = once(
    source,
    '    const ranked = rankDuKampProductsForNeed(products, query, limit);\n    return finish(operation, started, ranked);\n  } catch (error) {\n    return finish(operation, started, [], error);\n  }\n}\n\nexport async function querySiteSellers(',
    '    const ranked = rankDuKampProductsForNeed(products, query, limit);\n    if (ranked.length) return finish(operation, started, ranked);\n    const snapshot = rankDuKampProductsForNeed(\n      snapshotProducts.map(snapshotToSiteProduct),\n      query,\n      limit,\n    );\n    return snapshot.length ? finishSnapshot(operation, started, snapshot) : finish(operation, started, []);\n  } catch (error) {\n    const snapshot = rankDuKampProductsForNeed(\n      snapshotProducts.map(snapshotToSiteProduct),\n      query,\n      limit,\n    );\n    return snapshot.length ? finishSnapshot(operation, started, snapshot) : finish(operation, started, [], error);\n  }\n}\n\nexport async function querySiteSellers(',
    "recommendation empty snapshot fallback",
  );

  source = once(
    source,
    '.select("id,name,role,region,phone,whatsapp,active,display_order")',
    '.select("id,slug,show_on_team,name,role,region,phone,whatsapp,photo_url,cutout_url,banner_url,active,display_order")',
    "rich sellers select",
  );
  source = once(
    source,
    '.select("id,name,role,region,phone,whatsapp,active")',
    '.select("id,slug,name,role,region,phone,whatsapp,photo_url,cutout_url,banner_url,active,display_order")',
    "seller fallback select",
  );
  source = once(
    source,
    '    if (response.error) return finish(operation, started, [], response.error);\n    const sellers = (response.data ?? []) as SiteSeller[];\n    const match = text.trim()\n      ? matchSellerRequest(text, sellers)\n      : { kind: "all" as const, sellers, label: null };\n    return finish(operation, started, match.sellers as SiteSeller[]);\n  } catch (error) {\n    return finish(operation, started, [], error);\n  }\n}',
    '    const snapshotFallback = (): SiteSeller[] =>\n      snapshotSellers\n        .filter((seller) => !String(seller.slug ?? "").startsWith("conta-"))\n        .map((seller) => ({ ...seller, source: "snapshot" as const }));\n    if (response.error) {\n      const sellers = snapshotFallback();\n      const match = text.trim()\n        ? matchSellerRequest(text, sellers)\n        : { kind: "all" as const, sellers, label: null };\n      if (match.sellers.length) {\n        const result: SiteQueryResult<SiteSeller[]> = {\n          status: "snapshot",\n          data: match.sellers as SiteSeller[],\n          errorCode: "live_catalog_fallback",\n          durationMs: Date.now() - started,\n          count: match.sellers.length,\n        };\n        logQuery(operation, result);\n        return result;\n      }\n      return finish(operation, started, [], response.error);\n    }\n    const sellers = ((response.data ?? []) as SiteSeller[])\n      .filter((seller) => !String(seller.slug ?? "").startsWith("conta-"))\n      .map((seller) => {\n        const snapshot = snapshotSellerById.get(seller.id);\n        if (!snapshot) return { ...seller, source: "live" as const };\n        const media = {\n          photo_url: seller.photo_url ?? snapshot.photo_url ?? null,\n          cutout_url: seller.cutout_url ?? snapshot.cutout_url ?? null,\n          banner_url: seller.banner_url ?? snapshot.banner_url ?? null,\n        };\n        const supplemented = Object.values(media).some(Boolean) &&\n          (!seller.photo_url || !seller.cutout_url || !seller.banner_url);\n        return { ...seller, ...media, slug: seller.slug ?? snapshot.slug ?? null, source: supplemented ? "live+snapshot" as const : "live" as const };\n      });\n    const match = text.trim()\n      ? matchSellerRequest(text, sellers)\n      : { kind: "all" as const, sellers, label: null };\n    return finish(operation, started, match.sellers as SiteSeller[]);\n  } catch (error) {\n    const sellers = snapshotSellers.map((seller) => ({ ...seller, source: "snapshot" as const }));\n    const match = text.trim()\n      ? matchSellerRequest(text, sellers)\n      : { kind: "all" as const, sellers, label: null };\n    if (match.sellers.length) {\n      const result: SiteQueryResult<SiteSeller[]> = { status: "snapshot", data: match.sellers as SiteSeller[], errorCode: "live_catalog_fallback", durationMs: Date.now() - started, count: match.sellers.length };\n      logQuery(operation, result);\n      return result;\n    }\n    return finish(operation, started, [], error);\n  }\n}',
    "seller snapshot fallback",
  );

  source = once(
    source,
    '  if (["product", "product_recommendation", "internal_price"].includes(intent.intent)) {',
    '  if (["product", "product_recommendation", "internal_price"].includes(intent.intent) || hints.productAsset) {',
    "asset commercial execution",
  );

  source = once(
    source,
    '      const description = p.description?.trim()\n        ? `\\n  descrição oficial: ${p.description.trim().slice(0, 700)}`\n        : "";\n      const images = (p.images ?? []).filter(Boolean).slice(0, 3);',
    '      const descriptionLimit = look.products!.length <= 2 ? 12000 : 1800;\n      const officialDescription = stripHtml(p.description?.trim() ?? "");\n      const description = officialDescription\n        ? `\\n  descrição oficial: ${officialDescription.slice(0, descriptionLimit)}`\n        : "";\n      const images = (p.images ?? []).filter(Boolean).slice(0, look.products!.length <= 2 ? 10 : 3);',
    "full description and images",
  );
  source = once(
    source,
    '        p.stock != null ? `estoque: ${p.stock}` : null,\n      ].filter(Boolean);',
    '        p.stock != null ? `estoque: ${p.stock}` : null,\n        p.weight != null ? `peso: ${p.weight} kg` : p.peso != null ? `peso: ${p.peso} kg` : null,\n      ].filter(Boolean);',
    "product weight",
  );
  source = once(
    source,
    '    parts.push(`DADOS OFICIAIS E ATUAIS DA DUKAMP — PRODUTOS COMERCIAIS:\\n${lines.join("\\n")}`);',
    '    const snapshotNote = look.products.some((product) => product.source === "snapshot")\n      ? "\\nOBS.: itens marcados pelo snapshot servem para descrição, identificação e imagens; preço e estoque só devem ser afirmados quando vierem do catálogo vivo neste turno."\n      : "";\n    parts.push(`DADOS OFICIAIS DA DUKAMP — PRODUTOS COMERCIAIS${snapshotNote}:\\n${lines.join("\\n")}`);',
    "snapshot model note",
  );
  source = once(
    source,
    '      const region = s.region ? ` — ${s.region}` : "";\n      const wpp = s.whatsapp ? ` — WhatsApp: ${s.whatsapp}` : s.phone ? ` — Tel: ${s.phone}` : "";\n      return `- ${s.name}${region}${wpp}`;',
    '      const role = s.role ? ` — ${s.role}` : "";\n      const region = s.region ? ` — ${s.region}` : "";\n      const wpp = s.whatsapp ? ` — WhatsApp: ${s.whatsapp}` : s.phone ? ` — Tel: ${s.phone}` : "";\n      const media = [s.photo_url, s.cutout_url, s.banner_url].filter(Boolean);\n      const mediaLine = media.length ? `\\n  imagens oficiais do vendedor: ${media.join(" | ")}` : "";\n      return `- ${s.name}${role}${region}${wpp}${mediaLine}`;',
    "seller media block",
  );
  return source;
});

await edit("src/lib/chat/intent.ts", (source) =>
  once(
    source,
    '(?:(?:manda|mande|mostra|mostre|quero|tem)\\s+)?(?:a\\s+)?(?:foto|imagem)(?:\\s+(?:dele|dela|desse|dessa|do produto))?\\s*[?.!]*$/i.test(',
    '(?:(?:manda|mande|mostra|mostre|quero|tem)\\s+)?(?:a\\s+)?(?:foto|imagem|descri[cç][aã]o|detalhes?)(?:\\s+(?:dele|dela|desse|dessa|do produto))?\\s*[?.!]*$/i.test(',
    "product asset follow-up",
  ),
);

await edit("src/lib/chat/system-prompt.ts", (source) => {
  source = once(
    source,
    '- Para produtos, vendedores, preços, disponibilidade, contatos, descrições e imagens da DuKamp, os dados oficiais recuperados pelo sistema prevalecem.\n',
    '- Para produtos, vendedores, preços, disponibilidade, contatos, descrições e imagens da DuKamp, os dados oficiais recuperados pelo sistema prevalecem.\n- O sistema também pode fornecer um snapshot oficial de produtos, descrições, imagens e vendedores. Use o snapshot para identificação, descrição e mídia quando necessário, mas nunca trate preço ou estoque do snapshot como informação atual; preço e estoque exigem confirmação do catálogo vivo no turno.\n- Quando o usuário pedir a descrição de um produto específico e houver descrição oficial recuperada, responda com fidelidade ao conteúdo oficial. Se ele pedir a descrição completa, preserve os detalhes relevantes disponíveis em vez de substituí-los por uma descrição genérica.\n',
    "snapshot prompt policy",
  );
  source = once(
    source,
    '- Quando o usuário pedir foto/imagem de um produto e houver URL oficial em \'imagens oficiais\', inclua a primeira URL oficial em uma linha própria na resposta; no WhatsApp o backend a converterá em envio de imagem. Nunca use foto genérica da internet para representar um produto DuKamp.\n',
    '- Quando o usuário pedir foto/imagem de um produto e houver URL oficial em \'imagens oficiais\', inclua a primeira URL oficial em uma linha própria na resposta; no WhatsApp o backend a converterá em envio de imagem. Nunca use foto genérica da internet para representar um produto DuKamp.\n- Quando o usuário pedir a foto de um vendedor e houver URL em \'imagens oficiais do vendedor\', inclua a primeira URL oficial em linha própria para o WhatsApp enviá-la como imagem.\n',
    "seller photo prompt",
  );
  return source;
});

await edit("tests/site-commercial.test.ts", (source) => {
  source = once(
    source,
    '  description: "Suplemento mineral indicado para bezerros e recria.",\n};',
    '  description: "Suplemento mineral indicado para bezerros e recria.",\n  images: ["https://pioyrbcdprnplhcoyzam.supabase.co/storage/v1/object/public/produtos/dukamp-60.webp"],\n  brand: "DuKamp",\n  weight: 20,\n};',
    "test product richness",
  );
  source = once(
    source,
    '    display_order: 1,\n  },',
    '    display_order: 1,\n    slug: "ana-souza",\n    photo_url: "https://pioyrbcdprnplhcoyzam.supabase.co/storage/v1/object/public/sellers/ana.webp",\n    cutout_url: null,\n    banner_url: null,\n  },',
    "seller test media",
  );
  source += `\n\ntest("busca textual usa descrição oficial para encontrar produto", async () => {\n  const client = new MockSupabase({ products: [{ data: [] }, { data: [product] }] });\n  const result = await querySiteProducts("indicado para bezerros", 8, deps(client));\n  assert.equal(result.data[0]?.name, "DuKamp 60");\n  assert.match(result.data[0]?.description ?? "", /bezerros/i);\n});\n\ntest("consulta rica de vendedores inclui mídias oficiais", async () => {\n  const client = new MockSupabase({ sellers: { data: sellers } });\n  const result = await querySiteSellers("Ana Souza", 30, deps(client));\n  assert.match(client.selects[0]!.columns, /photo_url/);\n  assert.match(client.selects[0]!.columns, /banner_url/);\n  assert.match(result.data[0]?.photo_url ?? "", /supabase\\.co/);\n});\n\ntest("pedido de descrição específica dispara consulta comercial de produto", async () => {\n  const question = "me passe a descrição do DuKamp 60";\n  const client = new MockSupabase({ products: { data: [product] } });\n  const execution = await executeCommercialLookup(\n    classifyDomainIntent(question, true),\n    question,\n    deps(client),\n  );\n  assert.ok(client.calls.includes("products"));\n  assert.equal(execution.lookup.products?.[0]?.name, "DuKamp 60");\n});\n`;
  return source;
});

console.log("Integração de catálogo completo aplicada.");