import assert from "node:assert/strict";
import test from "node:test";
import {
  animalImportIntent,
  importFollowupIntent,
  handleAnimalImportInbound,
} from "../src/lib/guardian/import-dialogue.server.ts";
import type { ImportBatch } from "../src/lib/guardian/imports.ts";

const phone = "5517999900001";

test("bulk import intent never hijacks ordinary farm operations", () => {
  for (const text of [
    "Registra pra mim que a fazenda tem de despesa todo mes 20000 R$ com combustivel",
    "Nasceu 2 bezerros aqui na minha fazenda, registre isso",
    "Registre 2 novos nascimentos no rebanho hoje",
    "Registra 88000 reais de despesa da fazenda",
    "Registra uma tarefa para amanha",
    "Registrar mais 10 cabeças de gado na contagem do rebanho",
  ]) {
    assert.equal(animalImportIntent(text), false, text);
  }
  for (const text of [
    "Importe os animais do PDF ABCZ",
    "Cadastre os animais da lista",
    "Vou mandar 13 fotos dos animais para cadastrar",
    "Importar todos os animais da planilha",
  ]) {
    assert.equal(animalImportIntent(text), true, text);
  }
});

test("completed and cancelled imports cannot capture confirmation or edits", () => {
  for (const status of ["completed", "cancelled", undefined]) {
    for (const text of [
      "Confirmar",
      "Registre despesa de R$ 20000 com combustivel",
      "Registre 2 nascimentos no rebanho",
      "Corrija a ultima despesa",
      "Lista minhas tarefas",
      "Pode salvar",
      "Confirma a lista de animais",
    ]) {
      assert.equal(importFollowupIntent(text, status), false, status + ": " + text);
    }
  }
});

test("active imports accept focused follow-ups without taking other farm conversations", () => {
  for (const text of [
    "Somente as femeas nascidas em 2024",
    "Terminei de enviar",
    "Confira a lista",
    "Mostra os duplicados",
    "Confirma a lista de animais",
    "Corrija a genealogia da ficha ABCZ",
  ])
    assert.equal(importFollowupIntent(text, "review"), true, text);
  for (const text of [
    "Confirmar",
    "Registra combustivel do mes",
    "Registre 2 nascimentos no rebanho",
    "Registra minhas despesas",
    "Lista minhas tarefas",
    "Porque deu problema?",
  ])
    assert.equal(importFollowupIntent(text, "review"), false, text);
});

test("ordinary WhatsApp commands never read or depend on import storage", async () => {
  const missingImportStorage = async (): Promise<never> => {
    throw Error("IMPORT_TABLE_NOT_AVAILABLE");
  };
  const missingGuardian = {
    load: async (): Promise<never> => {
      throw Error("GUARDIAN_MUST_OWN_THIS_MESSAGE");
    },
    loadProperty: async (): Promise<never> => {
      throw Error("GUARDIAN_MUST_OWN_THIS_MESSAGE");
    },
  };
  for (const [index, text] of [
    "Registra pra mim que a fazenda tem de despesa todo mes 20000 R$ com combustivel",
    "Nasceu 2 bezerros aqui na minha fazenda, registre isso",
    "Selecionar fazenda",
    "Porque deu problema?",
    "Confirmar",
    "Registre uma tarefa",
  ].entries()) {
    const result = await handleAnimalImportInbound(
      { phone, messageId: "regular-" + index, text },
      { enabled: true, current: missingImportStorage, store: missingGuardian },
    );
    assert.equal(result, null, text);
  }
});

test("a completed import stays closed even when the user mentions the old list", async () => {
  let loaded = 0;
  const result = await handleAnimalImportInbound(
    { phone, messageId: "completed-import", text: "Confirma a lista de animais" },
    {
      enabled: true,
      current: async () => {
        loaded++;
        return { status: "completed" } as ImportBatch;
      },
      store: {
        load: async (): Promise<never> => {
          throw Error("COMPLETED_IMPORT_MUST_NOT_TOUCH_GUARDIAN");
        },
        loadProperty: async (): Promise<never> => {
          throw Error("COMPLETED_IMPORT_MUST_NOT_TOUCH_GUARDIAN");
        },
      },
    },
  );
  assert.equal(loaded, 1);
  assert.equal(result, null);
});
