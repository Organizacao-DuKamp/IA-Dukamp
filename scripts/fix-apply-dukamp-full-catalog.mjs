import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-dukamp-full-catalog.mjs";
const source = await readFile(path, "utf8");
const lines = source.split("\n");
let changed = false;
const fixed = lines.map((line) => {
  if (line.includes("source.match(new RegExp(mapTail.replace(")) {
    changed = true;
    return "  if (source.split(mapTail).length - 1 !== 2) {";
  }
  return line;
});
if (!changed) throw new Error("Linha do validador não encontrada");
await writeFile(path, fixed.join("\n"), "utf8");
console.log("Validador temporário corrigido.");