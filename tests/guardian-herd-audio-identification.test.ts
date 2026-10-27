import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { automaticFarmEvent } from "../src/lib/guardian/automatic.ts";
import { herdStatement, HERD_IDENTITY_QUESTION } from "../src/lib/guardian/herd-language.ts";
import { emptyFarm, PreferencesSchema, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import { emptyOperations, stockAt } from "../src/lib/guardian/operations.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "5517999991111",
  now = new Date("2026-10-27T13:00:00Z");
const audio =
  "[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: Pepec, agora nasceram mais quatro bezerros aqui na minha fazenda, tá? Se você puder registrar isso pra mim...";
const noProvider = async () => {
  throw new Error("no provider should be called");
};
function snapshot(): GuardianSnapshot {
  return {
    accountVersion: 0,
    preferences: PreferencesSchema.parse({}),
    pending: null,
    properties: [{ id: "p", name: "Boa Vista", role: "owner" }],
    active: {
      id: "p",
      version: 0,
      role: "owner",
      book: { ...emptyFarm("Boa Vista", "Tanabi", "SP"), operations: emptyOperations() },
    },
  };
}
async function baseline(f: Awaited<ReturnType<typeof farmIntegration>>, count = 78) {
  await f.observe(
    phone,
    "baseline",
    `Minha fazenda fica em Tanabi e tenho ${count} cabeças.`,
    "2026-10-26T15:00:00Z",
  );
}
async function send(
  f: Awaited<ReturnType<typeof farmIntegration>>,
  messageId: string,
  text: string,
) {
  return handleGuardianMessage(
    { phone, messageId, text },
    { store: f.guardian, now, extract: noProvider },
  );
}

test("spoken additions, written cardinals and singular cattle nouns become exact deltas", () => {
  for (const [text, expected] of [
    [audio, 4],
    ["Hoje nasceram mais quatro bezerros.", 4],
    ["Comprei mais três gados hoje.", 3],
    ["Hoje comprei um boi.", 1],
    ["Comprei mais uma vaca hoje.", 1],
    ["Nasceram vinte e quatro bezerros hoje.", 24],
    ["Hoje comprei duzentas e trinta e duas novilhas.", 232],
    ["Agora nasceram mais 4 bezerros aqui na minha fazenda.", 4],
    ["Acabaram de nascer dois bezerros hoje.", 2],
  ] as const) {
    const result = automaticFarmEvent(
      { text, mediaType: text === audio ? "audio" : undefined, at: now },
      snapshot(),
    );
    assert.equal(result.status, "action", herdStatement(text));
    if (result.status === "action")
      assert.equal(result.action.kind === "herd_event" && result.action.count, expected);
  }
  for (const text of [
    "Será que nasceram quatro bezerros?",
    "Meu vizinho disse: nasceram quatro bezerros, tá?",
    "Nasceram uns quatro bezerros hoje",
    "Nasceram quatro e cinco bezerros hoje",
    "Se nascerem quatro bezerros, pode registrar isso pra mim?",
  ]) {
    assert.equal(automaticFarmEvent({ text, at: now }, snapshot()).status, "none", text);
  }
});

test("integrated PostgreSQL: the reported audio increases 78 to 82 and asks for identification only after committing", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    const input = {
      phone,
      messageId: "audio-more-four",
      text: audio,
      mediaType: "audio",
      sentAt: "2026-10-27T12:40:20Z",
    };
    const deps = { store: f.guardian, now, extract: noProvider };
    const result = await handleGuardianMessage(input, deps);
    assert.equal(result!.persisted, true, result!.reply ?? "");
    assert.match(result!.reply!, /Rebanho calculado após os registros: 82 animais/);
    assert.match(result!.reply!, /código\/brinco e RGN/);
    const state = await f.guardian.load(phone);
    assert.equal(state.active!.book.records.length, 0);
    assert.equal(state.active!.book.operations!.movements[0].count, 4);
    assert.equal(
      state.active!.book.operations!.movements[0].source.sourceAt,
      new Date(input.sentAt).toISOString(),
    );
    assert.equal(state.pending!.kind, "herd_identification");
    assert.equal((await handleGuardianMessage(input, deps))!.reply, result!.reply);
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.movements.length, 1);
    const failed = await handleGuardianMessage(
      { ...input, messageId: "db-failure" },
      {
        ...deps,
        store: {
          ...f.guardian,
          commit: async () => {
            throw new Error("offline");
          },
        },
      },
    );
    assert.equal(failed!.persisted, false);
    assert.doesNotMatch(failed!.reply!, /Registros salvos|86 animais/);
    assert.equal(
      stockAt((await f.guardian.load(phone)).active!.book.operations!, "2026-10-27").count,
      82,
    );
  } finally {
    await f.db.close();
  }
});

test("durable identification survives a database restart, accepts a list and never changes the already recorded stock", async () => {
  const dir = await mkdtemp(join(tmpdir(), "guardian-identification-"));
  let f = await farmIntegration(join(dir, "db"));
  try {
    await baseline(f);
    await send(f, "birth", "Hoje nasceram mais quatro bezerros.");
    await f.db.close();
    f = await farmIntegration(join(dir, "db"), true);
    await send(f, "yes", "Sim");
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
    const partial = await send(f, "identity-1", "código B01, RGN KBU 491\ncódigo B02, RGN KBU 492");
    assert.equal(partial!.persisted, true, partial!.reply ?? "");
    assert.match(partial!.reply!, /Faltam identificar 2 animais/);
    await send(f, "identity-1", "código B01, RGN KBU 491\ncódigo B02, RGN KBU 492");
    const completed = await send(f, "identity-2", "brinco B03, sem RGN\ncódigo B04");
    assert.equal(completed!.persisted, true);
    let s = await f.guardian.load(phone);
    assert.equal(s.pending, null);
    assert.deepEqual(
      s.active!.book.animals.map((a) => [a.code, a.rgn, a.birthDate]),
      [
        ["B01", "KBU 491", "2026-10-27"],
        ["B02", "KBU 492", "2026-10-27"],
        ["B03", undefined, "2026-10-27"],
        ["B04", undefined, "2026-10-27"],
      ],
    );
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 82);
    await send(f, "identity-2", "brinco B03, sem RGN\ncódigo B04");
    await send(f, "extra-confirm", "confirmar");
    s = await f.guardian.load(phone);
    assert.equal(s.active!.book.animals.length, 4);
    assert.equal(s.active!.book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("identity answers reject duplicates, too many animals, RGN-only responses and partially invalid lists atomically", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    await send(f, "birth", "Hoje nasceram mais dois bezerros.");
    for (const [id, text] of [
      ["duplicate", "código B01, RGN KBU 491\ncódigo B01, RGN KBU 492"],
      ["duplicate-rgn", "código B01, RGN KBU 491\ncódigo B02, RGN KBU491"],
      ["excess", "código B01\ncódigo B02\ncódigo B03"],
      ["rgn-only", "RGN KBU 491"],
      ["invalid", "código B01\ntalvez seja código B02"],
    ]) {
      const result = await send(f, id, text);
      assert.equal(result!.persisted, false, text);
      assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
    }
    await send(f, "no-rgn", "Não tem RGN");
    assert.equal((await f.guardian.load(phone)).pending!.kind, "herd_identification");
    const declined = await send(f, "no-codes", "Não têm");
    assert.match(declined!.reply!, /entrada permanece contabilizada/);
    const s = await f.guardian.load(phone);
    assert.equal(s.pending, null);
    assert.equal(s.active!.book.animals.length, 0);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 80);
  } finally {
    await f.db.close();
  }
});

test("purchase identification does not invent birth dates; revoked access and expired replies never bind identities", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    await send(f, "purchase", "Hoje comprei mais uma vaca.");
    const answer = await send(f, "purchased-code", "código V01, RGN ABC 10");
    assert.equal(answer!.persisted, true);
    assert.equal((await f.guardian.load(phone)).active!.book.animals[0].birthDate, undefined);
    await send(f, "new-entry", "Hoje nasceram mais dois bezerros.");
    const expired = await handleGuardianMessage(
      { phone, messageId: "expired", text: "código B02" },
      { store: f.guardian, now: new Date(now.getTime() + 31 * 60000) },
    );
    assert.match(expired!.reply!, /expirou/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 1);
    await send(f, "entry-again", "Hoje nasceram mais dois bezerros.");
    await f.db.query("update guardian_members set active=false where phone_number=$1", [phone]);
    const revoked = await send(f, "revoked", "código B02");
    assert.equal(revoked!.persisted, false);
    assert.doesNotMatch(revoked!.reply!, /Identificações salvas/);
  } finally {
    await f.db.close();
  }
});

test("identity followups stay scoped to their farm even if another client switches the account; workers can register identities without editing stock", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    const firstId = (await f.guardian.load(phone)).active!.id;
    await send(f, "birth", "Hoje nasceram mais dois bezerros.");
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    const worker = await send(f, "worker-code", "código B01, RGN KBU 491");
    assert.equal(worker!.persisted, true, worker!.reply ?? "");
    assert.equal(
      stockAt((await f.guardian.load(phone)).active!.book.operations!, "2026-10-27").count,
      80,
    );
    await f.db.query("update guardian_members set role='owner' where phone_number=$1", [phone]);
    await f.observe(
      phone,
      "second",
      "Tenho outra fazenda chamada Santa Rita em Votuporanga/SP. Tenho 20 cabeças.",
      "2026-10-26T16:00:00Z",
    );
    const s = await f.guardian.load(phone),
      other = s.properties.find((p) => p.id !== firstId)!;
    await f.db.query("update guardian_accounts set active_property_id=$1 where phone_number=$2", [
      other.id,
      phone,
    ]);
    const blocked = await send(f, "wrong-farm", "código B02, RGN KBU 492");
    assert.equal(blocked!.persisted, false);
    assert.doesNotMatch(blocked!.reply!, /Identificações salvas/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
    const first = await f.db.query<{ book: { animals: unknown[] } }>(
      "select book from guardian_properties where id=$1",
      [firstId],
    );
    assert.equal(first.rows[0].book.animals.length, 1);
  } finally {
    await f.db.close();
  }
});

test("an existing reviewed proposal is preserved behind the identification question and cannot be accidentally confirmed by 'sim'", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    await send(f, "expense-draft", "Despesa R$ 50 com ração hoje");
    await send(f, "birth", "Hoje nasceram mais dois bezerros.");
    await send(f, "yes", "sim");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    await send(f, "no", "não têm");
    const pending = (await f.guardian.load(phone)).pending;
    assert.equal(pending?.sourceMessageId, "expense-draft");
    await send(f, "confirm-expense", "confirmar");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("unresolved herd requests and 'é pra rebanho' never fall through to a fictional confirmation", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    for (const [messageId, text] of [
      ["clarify", "É pra rebanho"],
      ["missing", "Registre que nasceram alguns bezerros na minha fazenda"],
    ]) {
      const result = await send(f, messageId, text);
      assert.equal(result!.persisted, false);
      assert.ok(result!.reply);
    }
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.movements.length, 0);
  } finally {
    await f.db.close();
  }
});

test("WhatsApp delivers the committed audio receipt and identity question without calling the general AI", async () => {
  const f = await farmIntegration();
  try {
    await baseline(f);
    const reply = await processClaimedWhatsAppChat(
      { phone, messageId: "wa-audio", text: "", media: { type: "audio", id: "fixture" } },
      {
        loadConversation: async () => null,
        resolveUserText: async () => audio,
        processGuardian: (input) =>
          handleGuardianMessage(input, { store: f.guardian, now, extract: noProvider }),
        processHerd: noProvider,
        executeChat: noProvider,
        saveConversation: async () => {},
        completeMessage: async () => {},
      },
    );
    assert.match(reply.reply!, /82 animais/);
    assert.match(reply.reply!, /código\/brinco e RGN/);
  } finally {
    await f.db.close();
  }
});

test("general herd conversation ends with the identity question, saved in the same WhatsApp reply and history", async () => {
  let saved = "",
    completed = "";
  const result = await processClaimedWhatsAppChat(
    { phone, messageId: "herd-question", text: "Como organizar meu rebanho?" },
    {
      loadConversation: async () => null,
      resolveUserText: async (i) => i.text,
      processGuardian: async () => ({
        reply: null,
        activeProperty: true,
        context: "Fazenda ativa",
        herdIdentificationQuestion: HERD_IDENTITY_QUESTION,
      }),
      executeChat: async () => ({
        status: 200,
        body: {
          conversationId: "fixture",
          reply: "Separe os animais por categoria.",
          state: {},
          diagnostics: {},
        },
      }),
      processHerd: noProvider,
      saveConversation: async (_p, s) => {
        saved = s.history.at(-1)!.content;
      },
      completeMessage: async (_id, reply) => {
        completed = reply;
      },
    },
  );
  assert.ok(result.reply!.endsWith(HERD_IDENTITY_QUESTION));
  assert.equal(saved, result.reply);
  assert.equal(completed, result.reply);
});
