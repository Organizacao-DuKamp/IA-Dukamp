import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/chat/core.server.ts";
let source = await readFile(path, "utf8");
const before =
  "          lookup.products?.some((product) => product.stock == null || product.stock > 0) ?? false;";
const after =
  "          lookup.products?.some(\n            (product) =>\n              product.source !== \"snapshot\" && (product.stock == null || product.stock > 0),\n          ) ?? false;";
if (!source.includes(before)) throw new Error("Regra liveMatch não encontrada");
source = source.replace(before, after);
await writeFile(path, source, "utf8");
console.log("Snapshot separado de disponibilidade ao vivo.");