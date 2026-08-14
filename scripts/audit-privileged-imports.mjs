import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = "src";
const patterns = [
  "supabaseAdmin",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PERPLEXITY_API_KEY",
  "embedQuery",
  "embedTexts",
  "handleIncoming",
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (/\.(?:ts|tsx|js|mjs)$/i.test(entry.name)) out.push(path);
  }
  return out;
}

const matches = Object.fromEntries(patterns.map((pattern) => [pattern, []]));
for (const path of await walk(root)) {
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/);
  for (const pattern of patterns) {
    lines.forEach((line, index) => {
      if (line.includes(pattern)) {
        matches[pattern].push(`${relative(".", path)}:${index + 1}`);
      }
    });
  }
}

for (const pattern of patterns) {
  console.log(`[privileged-audit] ${pattern}`);
  for (const match of matches[pattern]) console.log(`  ${match}`);
}
