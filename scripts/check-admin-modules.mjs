import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// A successful bundle alone does not guarantee its route modules can load.
// In particular, removed server-function builder APIs throw during import,
// before authentication or any handler has a chance to run.
const root = resolve(".netlify/functions-internal/server/_ssr");
const files = await readdir(root);
const routes = [
  "admin.base-conhecimento",
  "admin.ia",
  "admin.produtos",
  "admin.cotacoes",
  "guardia",
];

for (const route of routes) {
  const file = files.find((name) => name.startsWith(`${route}-`) && name.endsWith(".mjs"));
  if (!file) throw new Error(`Missing compiled administrative route: ${route}`);
  await import(pathToFileURL(resolve(root, file)).href);
  console.log(`[admin-module-check] ok ${route}`);
}
