import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { parseDueDate } from "../src/lib/guardian/parse.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";

const phone = "5517999991111",
  at = new Date("2026-10-28T13:41:47Z");
const audio =
  "Tá legal, o que eu quero que você faça? Selecione a fazenda Eduardo e adicione mais quatro gados que eu comprei hoje, tá? E me lembra também, às uma e meia da tarde, pra eu dar ração para todos os gados, ok?";
const noAI = async () => {
  throw Error("A model cannot confirm database writes");
};
async function fixture() {
  const f = await farmIntegration();
  for (const name of ["Eduardo", "Tambori"]) {
    const s = await f.guardian.load(phone),
      book = emptyFarm(name, "Tanabi", "SP");
    assert.equal(
      await f.guardian.commit({
        phone,
        messageId: `create-${name}`,
        accountVersion: s.accountVersion,
        propertyId: randomUUID(),
        propertyVersion: null,
        operation: "create",
        book,
        pending: null,
        reply: "ok",
      }),
      "committed",
    );
  }
  return f;
}
const send = (f: Awaited<ReturnType<typeof fixture>>, id: string, text: string, time = at) =>
  handleGuardianMessage(
    { phone, messageId: id, text, mediaType: "audio", sentAt: time.toISOString() },
    { store: f.guardian, now: time, extract: noAI },
  );

test("spoken clocks convert afternoon to Brasília rather than UTC", () => {
  assert.equal(parseDueDate("hoje às uma e meia da tarde", at), "2026-10-28T16:30:00.000Z");
  assert.equal(parseDueDate("hoje às 1:30 da tarde", at), "2026-10-28T16:30:00.000Z");
  assert.equal(parseDueDate("amanhã às duas da tarde", at), "2026-10-29T17:00:00.000Z");
  assert.equal(parseDueDate("hoje às uma e meia da tarde", new Date("2026-10-28T17:00:00Z")), null);
});

test("the exact audio selects Eduardo and atomically saves cattle + 13:30 task, with receipt and retry safety", async () => {
  const f = await fixture();
  try {
    const reply = await send(
      f,
      "combined",
      `[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: ${audio}`,
    );
    assert.equal(reply?.persisted, true, reply?.reply ?? "");
    assert.match(reply!.reply!, /13:30/);
    const s = await f.guardian.load(phone),
      b = s.active!.book;
    assert.equal(b.name, "Eduardo");
    assert.equal(b.operations!.movements.length, 1);
    assert.equal(b.operations!.movements[0].count, 4);
    assert.equal(b.operations!.movements[0].type, "purchase");
    assert.equal(b.operations!.movements[0].source.messageId, "combined");
    assert.equal(b.tasks.length, 1);
    assert.equal(b.tasks[0].title, "dar ração para todos os gados");
    assert.equal(b.tasks[0].dueAt, "2026-10-28T16:30:00.000Z");
    assert.equal(b.tasks[0].source.sourceAt, at.toISOString());
    assert.equal(stockAt(b.operations!, "2026-10-28").count, null);
    assert.match(reply!.reply!, /avisos.*dependem/);
    await send(f, "combined", audio);
    await send(f, "rephrase", audio);
    const again = (await f.guardian.load(phone)).active!.book;
    assert.equal(again.operations!.movements.length, 1);
    assert.equal(again.tasks.length, 1);
    const other = await f.rpc<{ tasks: unknown[]; operations?: unknown }>(
      "select book data from guardian_properties where id=$1",
      [s.properties.find((p) => p.name === "Tambori")!.id],
    );
    assert.equal(other.tasks.length, 0);
    assert.equal(other.operations, undefined);
  } finally {
    await f.db.close();
  }
});

test("a missing time keeps the description, cattle, property and original source across a process reload", async () => {
  const f = await fixture();
  try {
    const first = await send(
      f,
      "incomplete",
      "Selecione a fazenda Eduardo. Hoje comprei 4 gados. E me lembra de dar ração para o gado",
    );
    assert.equal(first?.persisted, false);
    assert.match(first!.reply!, /dia e horário/);
    let s = await f.guardian.load(phone);
    assert.equal(s.pending?.kind, "task_batch");
    assert.equal(s.active!.book.operations, undefined);
    assert.equal(s.active!.book.tasks.length, 0);
    const complete = await send(f, "clock", "Ele pode colocar uma e meia da tarde.");
    assert.equal(complete?.persisted, true, complete?.reply ?? "");
    s = await f.guardian.load(phone);
    assert.equal(s.active!.book.tasks[0].title, "dar ração para o gado");
    assert.equal(s.active!.book.tasks[0].dueAt, "2026-10-28T16:30:00.000Z");
    assert.equal(s.active!.book.operations!.movements[0].source.messageId, "incomplete");
    assert.equal(s.active!.book.tasks[0].source.messageId, "incomplete");
    assert.equal(s.active!.book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("past times don't silently reschedule and no subset of the batch is saved", async () => {
  const f = await fixture();
  try {
    const now = new Date("2026-10-28T17:00:00Z");
    const r = await send(f, "past", audio, now);
    assert.equal(r?.persisted, false);
    assert.match(r!.reply!, /não é futuro/);
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.tasks.length, 0);
    assert.equal(b.operations, undefined);
    const next = await send(f, "next-day", "amanhã às uma e meia da tarde", now);
    assert.equal(next?.persisted, true, next?.reply ?? "");
    const after = (await f.guardian.load(phone)).active!.book;
    assert.equal(after.tasks[0].dueAt, "2026-10-29T16:30:00.000Z");
    assert.equal(after.operations!.movements[0].date, "2026-10-28");
  } finally {
    await f.db.close();
  }
});

test("two reminders + finance and a reminder preceding cattle both persist without losing objectives", async () => {
  const f = await fixture();
  try {
    await send(f, "select", "Eduardo");
    const r = await send(
      f,
      "many",
      "Despesa R$ 150 com ração hoje. Me lembra de conferir o cocho hoje às 13:30 e me lembra de fechar o curral hoje às 18h",
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    let b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.ledger.length, 1);
    assert.equal(b.tasks.length, 2);
    assert.match(b.ledger[0].description, /^ração(?: hoje)?$/);
    assert.equal(b.ledger[0].amountCents, 15000);
    assert.equal(b.ledger[0].date, "2026-10-28");
    const after = await send(
      f,
      "order",
      "Me lembra de conferir a água hoje às 14h e adicione 2 gados que eu comprei hoje",
    );
    assert.equal(after?.persisted, true, after?.reply ?? "");
    b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.operations!.movements[0].count, 2);
    assert.equal(b.tasks.length, 3);
  } finally {
    await f.db.close();
  }
});

test("permission, farm scope, negation and a failing commit cannot produce false success", async () => {
  const f = await fixture();
  try {
    for (const [i, text] of [
      "Na fazenda Desconhecida comprei 4 gados hoje e me lembra de dar ração hoje às 13:30",
      "Suponha que comprei 4 gados hoje e me lembra de dar ração hoje às 13:30",
      "Não me lembra hoje às uma e meia da tarde de dar ração",
      "Selecione a fazenda Eduardo e adicione gados. Me lembra de dar ração hoje às 13:30",
    ].entries()) {
      const r = await send(f, `blocked-${i}`, text);
      assert.notEqual(r?.persisted, true, text);
    }
    await send(f, "choose", "Eduardo");
    const before = (await f.guardian.load(phone)).active!.book;
    const failure = await handleGuardianMessage(
      { phone, messageId: "db-failure", text: audio },
      {
        store: {
          ...f.guardian,
          commit: async () => {
            throw Error("database unavailable");
          },
        },
        now: at,
        extract: noAI,
      },
    );
    assert.equal(failure?.persisted, false);
    assert.match(failure!.reply!, /Nenhuma nova operação está confirmada/);
    assert.deepEqual((await f.guardian.load(phone)).active!.book, before);
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    const denied = await send(f, "worker", audio);
    assert.equal(denied?.persisted, false);
    assert.match(denied!.reply!, /perfil não permite/);
    const allowed = await send(
      f,
      "worker-tasks",
      "Me lembra de dar ração hoje às 13:30 e me lembra de conferir a água hoje às 14h",
    );
    assert.equal(allowed?.persisted, true, allowed?.reply ?? "");
    assert.equal((await f.guardian.load(phone)).active!.book.tasks.length, 2);
  } finally {
    await f.db.close();
  }
});

test("the WhatsApp adapter returns only the persisted multi-objective receipt, without a generic model response", async () => {
  const f = await fixture();
  try {
    let delivered = "";
    const r = await processClaimedWhatsAppChat(
      { phone, messageId: "wa-combined", text: audio, sentAt: at.toISOString() },
      {
        loadConversation: async () => null,
        resolveUserText: async (i) => i.text,
        processGuardian: (i) =>
          handleGuardianMessage(i, { store: f.guardian, now: at, extract: noAI }),
        processHerd: noAI,
        executeChat: noAI,
        saveConversation: async () => {},
        completeMessage: async (_id, reply) => {
          delivered = reply;
        },
      },
    );
    assert.match(r.reply!, /Registros salvos em Eduardo/);
    assert.equal(delivered, r.reply);
    const snapshot = await f.guardian.load(phone);
    assert.equal(snapshot.active!.book.tasks.length, 1);
    assert.equal(snapshot.active!.book.operations!.movements.length, 1);
    assert.equal(snapshot.active!.book.tasks[0].dueAt, "2026-10-28T16:30:00.000Z");
  } finally {
    await f.db.close();
  }
});
