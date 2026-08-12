import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const candidateRoots = ["dist", "dist/client", ".output/public", "build/client"];
const forbidden = [
  "TPEC_PROXY_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LOVABLE_API_KEY",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
];
const extensions = /\.(?:js|mjs|cjs|map|html)$/i;

async function exists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function filesUnder(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (extensions.test(entry.name)) files.push(path);
    }
  }
  await walk(root);
  return files;
}

const roots = [];
for (const root of candidateRoots) if (await exists(root)) roots.push(root);
if (roots.length === 0) {
  throw new Error("Client build output not found for secret scan.");
}

const leaks = [];
for (const root of roots) {
  for (const file of await filesUnder(root)) {
    const text = await readFile(file, "utf8");
    for (const token of forbidden) {
      if (text.includes(token)) leaks.push(`${file}: ${token}`);
    }
  }
}

if (leaks.length > 0) {
  throw new Error(`Server-only secret identifiers found in client bundle:\n${leaks.join("\n")}`);
}
console.log(`[client-secret-scan] ok roots=${roots.join(",")}`);
