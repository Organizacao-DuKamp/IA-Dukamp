import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeIdentityFiles = [
  "src/lib/chat/system-prompt.ts",
  "src/lib/chat/core.server.ts",
  "src/lib/whatsapp/conversation.server.ts",
];

test("TPEC-IA se apresenta somente como a IA da pecuária", async () => {
  const contents = await Promise.all(runtimeIdentityFiles.map((path) => readFile(path, "utf8")));
  const runtimeIdentity = contents.join("\n");

  assert.match(runtimeIdentity, /Sou a TPEC-IA, a IA da pecuária/);
  assert.doesNotMatch(
    runtimeIdentity,
    /assistente(?: virtual)? da DuKamp|Sou a TPEC-IA, da DuKamp/i,
  );
});

test("respostas curadas de identidade não vinculam a IA a uma empresa", async () => {
  const faq = await readFile(
    "src/seed/base-conhecimento/02-CONHECIMENTO-GERAL/02-PERGUNTAS-FREQUENTES/MODELO-PERGUNTAS-E-RESPOSTAS.txt",
    "utf8",
  );

  assert.match(faq, /Resposta aprovada: Sou a TPEC-IA, a IA da pecuária\./g);
  assert.doesNotMatch(faq, /IA da Dukamp|IA da Tambory/i);
});
