import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import {
  animalImportIntent,
  handleAnimalImportInbound,
  importFollowupIntent,
} from "../src/lib/guardian/import-dialogue.server.ts";
import { explainPreviousFarmFailure } from "../src/lib/guardian/conversation-fastpath.ts";
import { directFarmReport } from "../src/lib/guardian/direct-report.ts";
import type { ImportBatch } from "../src/lib/guardian/imports.ts";

const phone = "5517999984444";
const time = new Date("2026-11-10T17:20:00Z");

test("P4-01 to P4-04: finished imports do not steal finance, births, tasks or generic confirmation", async () => {
  for (const text of [
    "Gasto 20000 R$ com combustivel todo mes",
    "Hoje mesmo nasceu 2 bezerros aqui na minha fazenda",
    "Registra uma tarefa para amanhã",
    "Confirmar",
  ]) {
    assert.equal(animalImportIntent(text), false, text);
    assert.equal(importFollowupIntent(text, "completed"), false, text);
    assert.equal(importFollowupIntent(text, "review"), false, text);
    const result = await handleAnimalImportInbound(
      { phone, messageId: "p4-" + text.length, text },
      {
        enabled: true,
        current: async () => ({ status: "completed" }) as ImportBatch,
        store: {
          load: async () => {
            throw Error("UNRELATED_MESSAGE_MUST_NOT_READ_IMPORT_STATE");
          },
          loadProperty: async () => {
            throw Error("UNRELATED_MESSAGE_MUST_NOT_READ_IMPORT_STATE");
          },
        },
      },
    );
    assert.equal(result, null, text);
  }
});

test("P4-05 to P4-09: isolated SQL registers expense and births once, selects correct farm, and never changes another farm", async () => {
  const f = await farmIntegration();
  const ids: Record<string, string> = {};
  const send = (id: string, text: string) =>
    handleGuardianMessage(
      { phone, messageId: id, text, sentAt: time.toISOString() },
      {
        store: f.guardian,
        now: time,
        extract: async () => {
          throw Error("SIMPLE_FARM_OPERATION_MUST_NOT_CALL_AI");
        },
      },
    );
  try {
    for (const name of ["Eduardo", "Tambori"]) {
      const before = await f.guardian.load(phone);
      const id = randomUUID();
      ids[name] = id;
      assert.equal(
        await f.guardian.commit({
          phone,
          messageId: "create-" + name,
          accountVersion: before.accountVersion,
          propertyId: id,
          propertyVersion: null,
          operation: "create",
          book: emptyFarm(name, "Tanabi", "SP"),
          pending: null,
          reply: "Criada",
        }),
        "committed",
      );
    }

    const select = await send("select-p4", "Usar fazenda Eduardo");
    assert.match(
      select?.reply ?? "",
      /(?:fazenda selecionada|fazenda Eduardo já está selecionada)/i,
    );
    assert.equal((await f.guardian.load(phone)).active?.id, ids.Eduardo);

    const wrong = await send("unknown-p4", "Usar fazenda Inexistente");
    assert.notEqual(wrong?.persisted, true);
    assert.equal((await f.guardian.load(phone)).active?.id, ids.Eduardo);

    const finance = await send("fuel-p4", "Gasto 20000 R$ com combustivel todo mes");
    assert.equal(finance?.persisted, true, finance?.reply ?? "");
    const report = directFarmReport(
      { text: "Resumo financeiro" },
      await f.guardian.load(phone),
      time,
    );
    assert.match(report ?? "", /combustivel|combustível/i);
    const repeatedFinance = await send("fuel-p4", "Gasto 20000 R$ com combustivel todo mes");
    assert.ok(repeatedFinance?.reply);
    let active = (await f.guardian.load(phone)).active!.book;
    assert.equal(active.ledger.length, 1);
    assert.equal(active.ledger[0].amountCents, 2_000_000);
    assert.equal(active.ledger[0].recurrence, "monthly");

    const born = await send("birth-p4", "Hoje mesmo nasceu 2 bezerros aqui na minha fazenda");
    assert.equal(born?.persisted, true, born?.reply ?? "");
    await send("birth-p4", "Hoje mesmo nasceu 2 bezerros aqui na minha fazenda");
    active = (await f.guardian.load(phone)).active!.book;
    assert.equal(active.operations!.movements.length, 1);
    assert.equal(active.operations!.movements[0].count, 2);
    assert.equal(active.operations!.movements[0].type, "birth");
    assert.equal(stockAt(active.operations!, "2026-11-10").count, null);

    const other = await f.rpc<{ ledger: unknown[]; operations?: unknown }>(
      "select book data from guardian_properties where id=$1",
      [ids.Tambori],
    );
    assert.equal(other.ledger.length, 0);
    assert.equal(other.operations, undefined);
  } finally {
    await f.db.close();
  }
});

test("P4-10: no report may become a write while a proposal is pending", () => {
  const snapshot = {
    accountVersion: 1,
    preferences: {
      enabled: false,
      consentAt: null,
      consentMessageId: null,
      timeZone: "America/Sao_Paulo",
      startHour: 8,
      topics: [],
    },
    pending: { kind: "semantic_draft" as const, question: "Qual lote?", propertyId: "farm" },
    properties: [{ id: "farm", name: "Eduardo", role: "owner" as const }],
    active: { id: "farm", version: 1, role: "owner" as const, book: emptyFarm("Eduardo", "", "") },
  };
  assert.equal(directFarmReport({ text: "Resumo financeiro" }, snapshot as never, time), null);
});

test("P4-11: a previous import mismatch produces a truthful explanation, not a fake receipt", () => {
  const reply = explainPreviousFarmFailure("Por que deu problema?", [
    { role: "user", content: "Nasceram 2 bezerros hoje" },
    { role: "assistant", content: "Preciso de confirmação" },
    { role: "user", content: "Confirmar" },
    { role: "assistant", content: "Nenhuma linha desta seleção está pronta para cadastrar." },
  ]);
  assert.match(reply ?? "", /importação/);
  assert.match(reply ?? "", /não tenho recibo/i);
});

test("P4-12: new imports remain possible without reopening an old completed batch", () => {
  assert.equal(animalImportIntent("Importe os animais do PDF ABCZ"), true);
  assert.equal(importFollowupIntent("Confirme a lista de animais", "completed"), false);
  assert.equal(importFollowupIntent("Confira a lista", "review"), true);
});
