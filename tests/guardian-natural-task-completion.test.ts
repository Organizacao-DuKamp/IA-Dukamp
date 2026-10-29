import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { naturalTaskReminder } from "../src/lib/guardian/task-completion-language.ts";
import type { ChatMessage } from "../src/lib/chat/types.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
const phone = "5517999991111",
  now = new Date("2026-10-29T12:00:00Z");
const noAI = async () => {
  throw Error("A model cannot complete a task without persistence");
};
async function fixture() {
  const f = await farmIntegration();
  return f;
}
async function create(
  f: Awaited<ReturnType<typeof fixture>>,
  name: string,
  tasks: Array<[string, string, string]>,
) {
  let book = emptyFarm(name, "Tanabi", "SP");
  const at = "2026-10-27T12:00:00.000Z";
  for (const [id, title, dueAt] of tasks)
    book = applyFarmAction(
      book,
      { kind: "task_create", title, dueAt },
      "owner",
      { actor: phone, messageId: `seed-${id}`, at, confirmed: true },
      id,
    ).book;
  const s = await f.guardian.load(phone),
    id = randomUUID();
  assert.equal(
    await f.guardian.commit({
      phone,
      messageId: `create-${name}`,
      accountVersion: s.accountVersion,
      propertyId: id,
      propertyVersion: null,
      operation: "create",
      book,
      pending: null,
      reply: "ok",
    }),
    "committed",
  );
  for (const task of book.tasks)
    await f.db.query(
      "insert into guardian_events(property_id,recipient,type,topic,dedupe_key,evidence,message,priority,not_before,expires_at) values($1,$2,'task_due','tasks',$3,$4,$5,3,$6,$7)",
      [
        id,
        phone,
        task.id,
        { taskId: task.id, updatedAt: task.updatedAt },
        `Lembrete de ${task.title}`,
        task.dueAt,
        "2026-11-05T12:00:00Z",
      ],
    );
  return id;
}
async function notify(
  f: Awaited<ReturnType<typeof fixture>>,
  id: string,
  task: string,
  at: string,
  provider: string,
) {
  await f.db.query(
    "update guardian_events set status='sent',sent_at=$3,provider_message_id=$4 where property_id=$1 and evidence->>'taskId'=$2",
    [id, task, at, provider],
  );
}
const send = (
  f: Awaited<ReturnType<typeof fixture>>,
  id: string,
  text: string,
  history?: ChatMessage[],
  replyToMessageId?: string,
  time = now,
) =>
  handleGuardianMessage(
    {
      phone,
      messageId: id,
      text,
      history,
      replyToMessageId,
      mediaType: "audio",
      sentAt: time.toISOString(),
    },
    { store: f.guardian, now: time, extract: noAI },
  );
const status = async (f: Awaited<ReturnType<typeof fixture>>, id: string) =>
  (await f.guardian.loadProperty!(phone, id))!.book.tasks;

test("a named completed activity needs no code or extra confirmation and cancels its pending reminder", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["feed", "dar ração para os gados", "2026-10-29T21:30:00Z"],
      ["water", "conferir a água", "2026-10-29T22:00:00Z"],
    ]);
    const r = await send(f, "natural", "Já dei ração");
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.match(r!.reply!, /Concluída e salva/);
    assert.doesNotMatch(r!.reply!, /feed|c[oó]digo/i);
    const tasks = await status(f, id);
    assert.equal(tasks[0].status, "done");
    assert.equal(tasks[1].status, "open");
    const rows = await f.db.query<{ status: string }>(
      "select status from guardian_events where property_id=$1 and evidence->>'taskId'='feed'",
      [id],
    );
    assert.equal(rows.rows[0].status, "cancelled");
    await send(f, "natural", "Já dei ração");
    await send(f, "same-again", "Já dei ração");
    assert.equal((await status(f, id))[1].status, "open");
  } finally {
    await f.db.close();
  }
});

test("the producer's exact greeting completes the actual notified task even while another farm is active", async () => {
  const f = await fixture();
  try {
    const edu = await create(f, "Eduardo", [
      ["feed", "alimentar eles", "2026-10-28T21:30:00Z"],
      ["later", "alimentar eles", "2026-10-28T22:46:00Z"],
    ]);
    const other = await create(f, "Tambori", [
      ["other", "limpar o curral", "2026-10-29T13:00:00Z"],
    ]);
    await notify(f, edu, "feed", "2026-10-28T21:30:06Z", "wamid.feed");
    // A notification sent after the producer's message cannot hijack its historical meaning.
    await notify(f, edu, "later", "2026-10-29T11:00:08Z", "wamid.later");
    const at = new Date("2026-10-28T22:07:54Z");
    const r = await send(
      f,
      "exact-audio",
      "Bom dia, Zépec, já concluí a tarefa sim, tá?",
      undefined,
      undefined,
      at,
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.match(r!.reply!, /Eduardo/);
    assert.equal((await status(f, edu))[0].status, "done");
    assert.equal((await status(f, edu))[1].status, "open");
    assert.equal((await status(f, other))[0].status, "open");
    assert.equal((await f.guardian.load(phone)).active!.id, other);
    const answered = await f.db.query<{ answered: boolean }>(
      "select answered_at is not null answered from guardian_events where provider_message_id='wamid.feed'",
    );
    assert.equal(answered.rows[0].answered, true);
  } finally {
    await f.db.close();
  }
});

test("two similar tasks ask by readable activity/time and a natural choice closes only the selected task", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["first", "alimentar o lote 1", "2026-10-29T21:30:00Z"],
      ["second", "alimentar o lote 2", "2026-10-29T22:00:00Z"],
    ]);
    const r = await send(f, "ambiguous", "Já concluí a tarefa");
    assert.equal(r?.persisted, false);
    assert.match(r!.reply!, /Qual destas/);
    assert.doesNotMatch(r!.reply!, /first|second|c[oó]digo/);
    const answer = await send(f, "pick", "a do lote 2", [
      { role: "assistant", content: r!.reply! },
    ]);
    assert.equal(answer?.persisted, true, answer?.reply ?? "");
    assert.equal((await status(f, id))[0].status, "open");
    assert.equal((await status(f, id))[1].status, "done");
  } finally {
    await f.db.close();
  }
});

test("native WhatsApp reply context identifies one reminder and repeats never close a different task", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["one", "alimentar eles", "2026-10-28T21:30:00Z"],
      ["two", "alimentar eles", "2026-10-28T22:46:00Z"],
    ]);
    await notify(f, id, "one", "2026-10-28T21:30:00Z", "wamid.one");
    await notify(f, id, "two", "2026-10-29T11:00:00Z", "wamid.two");
    const r = await send(f, "quoted", "já fiz", undefined, "wamid.one");
    assert.equal(r?.persisted, true, r?.reply ?? "");
    const again = await send(f, "quoted-again", "já fiz", undefined, "wamid.one");
    assert.equal(again?.persisted, false);
    assert.match(again!.reply!, /já consta/i);
    assert.equal((await status(f, id))[0].status, "done");
    assert.equal((await status(f, id))[1].status, "open");
  } finally {
    await f.db.close();
  }
});

test("a bare yes after an unrelated question, negative reports and future/hypothetical actions don't complete tasks", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [["feed", "dar ração", "2026-10-28T21:30:00Z"]]);
    await notify(f, id, "feed", "2026-10-28T21:30:00Z", "wamid.feed");
    for (const [i, text] of [
      "sim",
      "Já fiz",
      "Ainda não dei ração",
      "Vou concluir a tarefa amanhã",
      "Se eu concluir a tarefa",
      "Meu vizinho disse que já concluiu a tarefa",
    ].entries()) {
      const r = await send(f, `blocked-${i}`, text, [
        { role: "assistant", content: "Você quer a previsão para amanhã?" },
      ]);
      assert.notEqual(r?.persisted, true, text);
    }
    assert.equal((await status(f, id))[0].status, "open");
  } finally {
    await f.db.close();
  }
});

test("a completion selection can close all explicitly chosen tasks without erasing unrelated data", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["feed", "dar ração", "2026-10-29T21:30:00Z"],
      ["water", "conferir água", "2026-10-29T22:00:00Z"],
    ]);
    const r = await send(f, "all", "Concluí todas as tarefas");
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.ok((await status(f, id)).every((t) => t.status === "done"));
  } finally {
    await f.db.close();
  }
});

test("completion plus a new reminder remains a single persistent multi-objective request through the WhatsApp adapter", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [["feed", "dar ração", "2026-10-29T13:00:00Z"]]);
    const r = await processClaimedWhatsAppChat(
      {
        phone,
        messageId: "finish-and-repeat",
        text: "Já dei ração e me avise de conferir a água hoje às 18h",
        sentAt: now.toISOString(),
      },
      {
        loadConversation: async () => null,
        resolveUserText: async (i) => i.text,
        processGuardian: (i) => handleGuardianMessage(i, { store: f.guardian, now, extract: noAI }),
        processHerd: noAI,
        executeChat: noAI,
        saveConversation: async () => {},
        completeMessage: async () => {},
      },
    );
    assert.match(r.reply!, /Tarefa concluída/);
    assert.doesNotMatch(r.reply!, /feed/);
    const tasks = await status(f, id);
    assert.equal(tasks[0].status, "done");
    assert.equal(tasks.length, 2);
    assert.equal(tasks[1].status, "open");
  } finally {
    await f.db.close();
  }
});

test("queued legacy reminder wording becomes natural without changing task identity or timing", () => {
  const old =
    "Eduardo: a tarefa “dar ração” está prevista para 29/10/2026, 18:30:00 (Brasília). Você já concluiu? Se sim, responda “concluir tarefa ABC-123”.";
  const fixed = naturalTaskReminder(old);
  assert.doesNotMatch(fixed, /ABC-123|concluir tarefa/);
  assert.match(fixed, /já fiz/);
  assert.match(fixed, /18:30:00/);
  assert.equal(naturalTaskReminder("Aviso de chuva"), "Aviso de chuva");
});

test("revoked access and a replanned reminder cannot complete the wrong task", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [["feed", "dar ração", "2026-10-29T21:30:00Z"]]);
    await notify(f, id, "feed", "2026-10-29T11:00:00Z", "wamid.old-plan");
    const s = await f.guardian.load(phone);
    const changed = applyFarmAction(
      s.active!.book,
      { kind: "task_update", task: "feed", dueAt: "2026-10-30T21:30:00Z" },
      "owner",
      { actor: phone, messageId: "reschedule", at: now.toISOString(), confirmed: true },
      "replan",
    ).book;
    await f.guardian.commit({
      phone,
      messageId: "reschedule",
      accountVersion: s.accountVersion,
      propertyId: id,
      propertyVersion: s.active!.version,
      operation: "update",
      book: changed,
      pending: null,
      reply: "replanned",
    });
    const stale = await send(f, "old-reply", "já fiz", undefined, "wamid.old-plan");
    assert.notEqual(stale?.persisted, true);
    assert.equal((await status(f, id))[0].status, "open");
    await f.db.query(
      "update guardian_members set active=false where property_id=$1 and phone_number=$2",
      [id, phone],
    );
    const denied = await send(f, "revoked", "Já concluí a tarefa", undefined, "wamid.old-plan");
    assert.notEqual(denied?.persisted, true);
    const book = await f.rpc<{ tasks: Array<{ status: string }> }>(
      "select book data from guardian_properties where id=$1",
      [id],
    );
    assert.equal(book.tasks[0].status, "open");
  } finally {
    await f.db.close();
  }
});

test("the producer may cancel a choice or retry an expired choice by activity, without an old hidden selection firing", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["feed", "dar ração", "2026-10-29T21:30:00Z"],
      ["water", "conferir a água", "2026-10-29T22:00:00Z"],
    ]);
    await send(f, "choose", "Já concluí a tarefa");
    await send(f, "cancel-choice", "cancelar");
    assert.ok((await status(f, id)).every((t) => t.status === "open"));
    assert.equal((await f.guardian.load(phone)).pending, null);
    await send(f, "choose-again", "Já concluí a tarefa");
    await f.db.query(
      "update guardian_accounts set pending=jsonb_set(pending,'{expiresAt}','\"2026-10-29T10:00:00Z\"') where phone_number=$1",
      [phone],
    );
    const r = await send(f, "fresh-description", "Já dei ração");
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.equal((await status(f, id))[0].status, "done");
    assert.equal((await status(f, id))[1].status, "open");
  } finally {
    await f.db.close();
  }
});

test("delayed historical confirmation cannot finish a task that did not yet exist when the producer spoke", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [["new", "dar ração", "2026-10-29T21:30:00Z"]]);
    await f.db.query(
      "update guardian_properties set book=jsonb_set(jsonb_set(book,'{tasks,0,source,at}','\"2026-10-29T11:30:00.000Z\"'),'{tasks,0,updatedAt}','\"2026-10-29T11:30:00.000Z\"') where id=$1",
      [id],
    );
    const r = await handleGuardianMessage(
      {
        phone,
        messageId: "old-completion",
        text: "Já concluí a tarefa",
        sentAt: "2026-10-29T10:00:00Z",
      },
      { store: f.guardian, now, extract: noAI },
    );
    assert.notEqual(r?.persisted, true);
    assert.equal((await status(f, id))[0].status, "open");
  } finally {
    await f.db.close();
  }
});

test("a repeated generic completion after a notified task is closed never closes an unrelated remaining task", async () => {
  const f = await fixture();
  try {
    const id = await create(f, "Eduardo", [
      ["feed", "dar ração", "2026-10-28T21:30:00Z"],
      ["water", "conferir a água", "2026-10-29T22:00:00Z"],
    ]);
    await notify(f, id, "feed", "2026-10-29T11:00:00Z", "wamid.only-notice");
    const first = await send(f, "first-done", "Já concluí a tarefa");
    assert.equal(first?.persisted, true, first?.reply ?? "");
    const repeated = await send(f, "repeat-done", "Já concluí a tarefa sim");
    assert.notEqual(repeated?.persisted, true);
    assert.equal((await status(f, id))[0].status, "done");
    assert.equal((await status(f, id))[1].status, "open");
  } finally {
    await f.db.close();
  }
});
