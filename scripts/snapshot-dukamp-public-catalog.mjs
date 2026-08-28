import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://pioyrbcdprnplhcoyzam.supabase.co";
const SITE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpb3lyYmNkcHJucGxoY295emFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTk2NDYsImV4cCI6MjEwMDA5NTY0Nn0.wIPY4KZUEnP1ziR2lGQBF0sIj-b2p_SIZjTMEZe4WWk";
const OUTPUT = "src/lib/site/dukamp-catalog.snapshot.ts";
const SITE_REPO_RAW = "https://raw.githubusercontent.com/Organizacao-DuKamp/site-oficial-dukamp/main";

const client = createClient(SITE_URL, SITE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchText(path) {
  const response = await fetch(`${SITE_REPO_RAW}/${path}`, {
    headers: { "user-agent": "TPEC-IA-catalog-snapshot" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`description_source_failed:${path}:${response.status}`);
  return response.text();
}

function parseProdWeb(text) {
  const byCode = new Map();
  const re = /(?:^|\n)-{7}\s*\n([0-9]{4,})\s+-\s+([^\n]+)\n([\s\S]*?)(?=\n-{7}\s*(?:\n|$)|$)/g;
  for (const match of text.matchAll(re)) {
    const code = match[1]?.trim();
    const html = match[3]?.trim();
    if (code && html) byCode.set(code, { html, source: "descricoes_produtos_PROD_WEB.txt" });
  }
  return byCode;
}

function parseNewProducts(text) {
  const byCode = new Map();
  const re = /<p>Produto:\s*([^<(]+?)\s*\(([0-9]{4,})\)<\/p>([\s\S]*?)(?=\n\s*<!--\s*(?:={3,}|PRODUTO\s+\d+)|$)/gi;
  for (const match of text.matchAll(re)) {
    const code = match[2]?.trim();
    const html = (`<p>Produto: ${match[1]?.trim()} (${code})</p>${match[3] ?? ""}`).trim();
    if (code && html) byCode.set(code, { html, source: "novosprodutodukamp.txt" });
  }
  return byCode;
}

function parseUpdatedDescriptions(text) {
  const byName = new Map();
  const re = /<p>Produto:\s*([^<]+)<\/p>([\s\S]*?)(?=\n\s*(?:<!--\s*FIM DO PRODUTO\s*-->|<p>Produto:)|$)/gi;
  for (const match of text.matchAll(re)) {
    const name = match[1]?.trim();
    const html = (`<p>Produto: ${name}</p>${match[2] ?? ""}`).trim();
    if (name && html) byName.set(normalize(name), { html, source: "descricaoatt.txt" });
  }
  return byName;
}

async function readSupplementalDescriptions() {
  const results = await Promise.allSettled([
    fetchText("descricoes_produtos_PROD_WEB.txt"),
    fetchText("novosprodutodukamp.txt"),
    fetchText("descricaoatt.txt"),
  ]);
  const [prodWeb, novos, updated] = results;
  return {
    prodWeb: prodWeb.status === "fulfilled" ? parseProdWeb(prodWeb.value) : new Map(),
    novos: novos.status === "fulfilled" ? parseNewProducts(novos.value) : new Map(),
    updated: updated.status === "fulfilled" ? parseUpdatedDescriptions(updated.value) : new Map(),
  };
}

async function fetchAllProducts() {
  const fields = [
    "id",
    "name",
    "code",
    "slug",
    "active",
    "brand",
    "description",
    "images",
    "weight",
    "peso",
    "altura",
    "largura",
    "comprimento",
    "category_id",
    "catalog_id",
    "updated_at",
  ].join(",");
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("products")
      .select(fields)
      .eq("active", true)
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`products_snapshot_failed:${error.code ?? error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchAllSellers() {
  const rich =
    "id,slug,show_on_team,name,role,region,phone,whatsapp,photo_url,cutout_url,banner_url,active,display_order";
  let response = await client
    .from("sellers")
    .select(rich)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })
    .limit(1000);
  if (response.error) {
    response = await client
      .from("sellers")
      .select("id,slug,name,role,region,phone,whatsapp,photo_url,cutout_url,banner_url,active,display_order")
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(1000);
  }
  if (response.error) throw new Error(`sellers_snapshot_failed:${response.error.code ?? response.error.message}`);
  return (response.data ?? []).filter((seller) => !String(seller.slug ?? "").startsWith("conta-"));
}

function chooseDescription(product, supplemental) {
  const candidates = [];
  const code = String(product.code ?? "").trim();
  if (product.description?.trim()) {
    candidates.push({ html: product.description.trim(), source: "site_supabase" });
  }
  const prodWeb = code ? supplemental.prodWeb.get(code) : null;
  const novos = code ? supplemental.novos.get(code) : null;
  const updated = supplemental.updated.get(normalize(product.name));
  if (prodWeb) candidates.push(prodWeb);
  if (novos) candidates.push(novos);
  if (updated) candidates.push(updated);
  candidates.sort((a, b) => b.html.length - a.html.length);
  return candidates[0] ?? { html: null, source: null };
}

const [products, sellers, supplemental] = await Promise.all([
  fetchAllProducts(),
  fetchAllSellers(),
  readSupplementalDescriptions(),
]);

const snapshotProducts = products.map((product) => {
  const description = chooseDescription(product, supplemental);
  return {
    id: product.id,
    name: product.name,
    code: product.code ?? null,
    slug: product.slug ?? null,
    active: product.active ?? true,
    brand: product.brand ?? null,
    description: description.html,
    description_source: description.source,
    images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
    weight: product.weight ?? null,
    peso: product.peso ?? null,
    altura: product.altura ?? null,
    largura: product.largura ?? null,
    comprimento: product.comprimento ?? null,
    category_id: product.category_id ?? null,
    catalog_id: product.catalog_id ?? null,
    updated_at: product.updated_at ?? null,
  };
});

const snapshot = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source: "dukamp.netlify.app / Supabase público + descrições oficiais do repositório DuKamp",
  products: snapshotProducts,
  sellers,
};

await mkdir(dirname(OUTPUT), { recursive: true });
const serialized = JSON.stringify(snapshot, null, 2).replaceAll(" ", "\\u2028").replaceAll(" ", "\\u2029");
await writeFile(
  OUTPUT,
  `// Arquivo gerado por scripts/snapshot-dukamp-public-catalog.mjs. Não editar manualmente.\nexport const DUKAMP_CATALOG_SNAPSHOT = ${serialized} as const;\n`,
  "utf8",
);
console.log(
  `[dukamp-snapshot] ${snapshotProducts.length} produtos e ${sellers.length} vendedores salvos em ${OUTPUT}`,
);