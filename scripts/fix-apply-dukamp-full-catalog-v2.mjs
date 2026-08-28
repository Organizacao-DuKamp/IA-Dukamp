import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-dukamp-full-catalog.mjs";
let source = await readFile(path, "utf8");

const marker = "  const directError = ";
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error("Marcador directError não encontrado");

const callIndex = source.indexOf("  source = once(", markerIndex);
if (callIndex < 0) throw new Error("Primeira chamada após directError não encontrada");
source =
  source.slice(0, callIndex) +
  "  source = first(" +
  source.slice(callIndex + "  source = once(".length);

const helperEnd = "  return source.slice(0, index) + after + source.slice(index + before.length);\n}\n";
const helperEndIndex = source.indexOf(helperEnd);
if (helperEndIndex < 0) throw new Error("Fim do helper once não encontrado");
const insertionPoint = helperEndIndex + helperEnd.length;
const firstHelper =
  "\nfunction first(source, before, after, label) {\n" +
  "  const index = source.indexOf(before);\n" +
  "  if (index < 0) throw new Error(`Trecho não encontrado: ${label}`);\n" +
  "  return source.slice(0, index) + after + source.slice(index + before.length);\n" +
  "}\n";
source = source.slice(0, insertionPoint) + firstHelper + source.slice(insertionPoint);

await writeFile(path, source, "utf8");
console.log("Substituição duplicada corrigida.");