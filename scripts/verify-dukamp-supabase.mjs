// Read-only deploy-preview smoke test. It never prints credentials or rows.

const url =
  process.env.DUKAMP_SITE_SUPABASE_URL?.trim() ||
  process.env.VITE_DUKAMP_SITE_SUPABASE_URL?.trim();
const key =
  process.env.DUKAMP_SITE_SUPABASE_ANON_KEY?.trim() ||
  process.env.DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_DUKAMP_SITE_SUPABASE_ANON_KEY?.trim() ||
  process.env.VITE_DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  throw new Error("dukamp_site:not_configured");
}

const headers = { apikey: key };
if (!key.startsWith("sb_publishable_")) headers.Authorization = `Bearer ${key}`;

async function check(table, select) {
  const endpoint = new URL(`/rest/v1/${table}`, url);
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set("limit", "1");
  endpoint.searchParams.set("active", "eq.true");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { headers, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) {
      let code = `http_${response.status}`;
      try {
        const parsed = JSON.parse(body);
        code = parsed.code || code;
      } catch {
        // Keep only a safe status code.
      }
      throw new Error(`${table}:${code}`);
    }
    const rows = JSON.parse(body);
    if (!Array.isArray(rows)) throw new Error(`${table}:invalid_response`);
    console.log(`[dukamp-site-live] ${table}`, { status: "ok", count: rows.length });
    return rows.length;
  } finally {
    clearTimeout(timeout);
  }
}

const [products, sellers, categories] = await Promise.all([
  check("products", "id,name,code,price,stock"),
  check("sellers", "id,name,region,whatsapp,phone"),
  check("categories", "id,name"),
]);

if (products < 1) throw new Error("products:empty_result");
if (sellers < 1) throw new Error("sellers:empty_result");
console.log("[dukamp-site-live] verification passed", {
  products,
  sellers,
  categories,
});
