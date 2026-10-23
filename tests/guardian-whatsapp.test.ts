import assert from "node:assert/strict";
import test from "node:test";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { PreferencesSchema, emptyFarm, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import type { GuardianCommit, GuardianStore } from "../src/lib/guardian/store.server.ts";
import { parseGuardianRequest } from "../src/lib/guardian/parse.ts";
const phone = "5517999991111",
  now = new Date("2026-10-23T15:00:00Z");
const snapshot: GuardianSnapshot = {
  accountVersion: 0,
  properties: [],
  preferences: PreferencesSchema.parse({}),
  pending: null,
  active: {
    id: "00000000-0000-4000-8000-000000000001",
    version: 0,
    role: "owner",
    book: emptyFarm("Boa Vista", "Monte Aprazível", "SP"),
  },
};
test("structured response reaches WhatsApp without a second model call and completes the inbound receipt", async () => {
  const completed: string[] = [],
    saved: string[] = [];
  const result = await processClaimedWhatsAppChat(
    { phone, messageId: "wa-guardian1", text: "confirmar" },
    {
      loadConversation: async () => null,
      resolveUserText: async (i) => i.text,
      processGuardian: async () => ({
        reply: "Lançamento L1 salvo: despesa de R$ 150,50.",
        activeProperty: true,
      }),
      processHerd: async () => {
        throw new Error("legacy must not run");
      },
      executeChat: async () => {
        throw new Error("model must not run");
      },
      completeMessage: async (id) => {
        completed.push(id);
      },
      saveConversation: async (_p, s) => {
        saved.push(s.history.at(-1)!.content);
      },
    },
  );
  assert.match(result.reply, /Lançamento L1 salvo/);
  assert.deepEqual(completed, ["wa-guardian1"]);
  assert.match(saved[0], /150,50/);
});
test("confirmed property evidence reaches general chat; active farm cannot fall into another herd book", async () => {
  let chat = 0;
  await processClaimedWhatsAppChat(
    { phone, messageId: "wa-guardian2", text: "Como melhorar a produtividade aqui?" },
    {
      loadConversation: async () => ({ conversationId: `wa:${phone}`, history: [] }),
      resolveUserText: async (i) => i.text,
      processGuardian: async () => ({
        reply: null,
        context: "Somente fazenda Boa Vista, lote 2, dados confirmados.",
        activeProperty: true,
      }),
      processHerd: async () => {
        throw new Error("wrong herd scope");
      },
      executeChat: async (i) => {
        chat++;
        assert.match(i.conversationRecall!.context, /Somente fazenda Boa Vista/);
        return {
          status: 200,
          body: {
            reply: "Vamos avaliar os dados do lote 2.",
            state: {},
            conversationId: `wa:${phone}`,
            diagnostics: {},
          },
        };
      },
      completeMessage: async () => {},
      saveConversation: async () => {},
    },
  );
  assert.equal(chat, 1);
});
test("audio confirmation is decoded before parsing, and only acknowledges the committed data", async () => {
  let committed: GuardianCommit | undefined;
  const pending = {
    action: {
      kind: "ledger" as const,
      direction: "expense" as const,
      amountCents: 15050,
      date: "2026-10-23",
      description: "Ração",
    },
    propertyId: snapshot.active!.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60000).toISOString(),
    sourceMessageId: "proposal",
  };
  const store: GuardianStore = {
    receipt: async () => null,
    load: async () => ({ ...structuredClone(snapshot), pending }),
    commit: async (c) => {
      committed = c;
      return "committed";
    },
  };
  const result = await handleGuardianMessage(
    {
      phone,
      messageId: "audio-confirm",
      mediaType: "audio",
      text: "[Mensagem recebida por áudio] Pedido do usuário: confirmar\nTranscrição do áudio: confirmar",
    },
    { store, now },
  );
  assert.equal(committed!.operation, "update");
  assert.equal(committed!.book!.ledger[0].amountCents, 15050);
  assert.match(result!.reply!, /salvo/);
});
test("database failure never confirms a saved operation and duplicate receipts do not load or mutate", async () => {
  let loads = 0,
    commits = 0;
  const store: GuardianStore = {
    receipt: async () => null,
    load: async () => {
      loads++;
      return structuredClone(snapshot);
    },
    commit: async () => {
      commits++;
      throw new Error("database failed");
    },
  };
  const result = await handleGuardianMessage(
    { phone, messageId: "failure", text: "despesa R$ 50 com ração" },
    { store, now },
  );
  assert.match(result!.reply!, /Nenhuma nova operação está confirmada/);
  assert.equal(commits, 1);
  const replay = await handleGuardianMessage(
    { phone, messageId: "replayed", text: "confirmar" },
    { store: { ...store, receipt: async () => "Recibo confirmado anteriormente" }, now },
  );
  assert.match(replay!.reply!, /anteriormente/);
  assert.equal(loads, 1);
  assert.equal(commits, 1);
});
test("expired proposals cannot be committed and informal dates retain the reported day", async () => {
  let operation = "";
  const store: GuardianStore = {
    receipt: async () => null,
    load: async () => ({
      ...snapshot,
      pending: {
        action: { kind: "property_create", name: "Outra", city: "Tanabi", uf: "SP" },
        propertyId: null,
        createdAt: "2026-10-22T10:00:00Z",
        expiresAt: "2026-10-22T10:30:00Z",
        sourceMessageId: "expired",
      },
    }),
    commit: async (c) => {
      operation = c.operation;
      return "committed";
    },
  };
  const result = await handleGuardianMessage(
    { phone, messageId: "expired-confirm", text: "confirmar" },
    { store, now },
  );
  assert.equal(operation, "clear");
  assert.match(result!.reply!, /expirou/);
  const past = parseGuardianRequest("despesa R$ 150 com ração ontem", snapshot, now);
  assert.equal(past?.kind, "action");
  if (past?.kind === "action" && past.action.kind === "ledger")
    assert.equal(past.action.date, "2026-10-22");
  assert.equal(
    parseGuardianRequest("despesa R$ 150 com ração mês passado", snapshot, now)?.kind,
    "clarify",
  );
  assert.equal(parseGuardianRequest("O que é GMD?", snapshot, now), null);
});
