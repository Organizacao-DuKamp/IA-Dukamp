import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import type { ChatMessage } from "../src/lib/chat/types.ts";
import { taskClocks, normalizeTaskClock } from "../src/lib/guardian/task-time.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";

const phone = "5517999991111",
  at = new Date("2026-10-28T17:42:00Z");
const noAI = async () => {
  throw Error("No model acknowledgement may stand in for persistence");
};
async function fixture() {
  const f = await farmIntegration();
  const s = await f.guardian.load(phone);
  await f.guardian.commit({
    phone,
    messageId: "fixture",
    accountVersion: s.accountVersion,
    propertyId: randomUUID(),
    propertyVersion: null,
    operation: "create",
    book: emptyFarm("Eduardo", "Tanabi", "SP"),
    pending: null,
    reply: "ok",
  });
  return f;
}
const send = (
  f: Awaited<ReturnType<typeof fixture>>,
  id: string,
  text: string,
  history?: ChatMessage[],
) =>
  handleGuardianMessage(
    { phone, messageId: id, text, history, mediaType: "audio", sentAt: at.toISOString() },
    { store: f.guardian, now: at, extract: noAI },
  );

test("spoken approximate times and bare numeric clocks retain the afternoon and don't turn quantities into hours", () => {
  assert.equal(normalizeTaskClock("umas seis e meia da tarde"), "as 18:30");
  assert.equal(normalizeTaskClock("às dezoito e trinta"), "as 18:30");
  assert.equal(normalizeTaskClock("18:30"), "as 18:30");
  assert.equal(taskClocks("comprei 4 gados no dia 28/10").length, 0);
  assert.equal(
    normalizeTaskClock("alimentar as quatro vacas às seis e meia da tarde"),
    "alimentar as quatro vacas as 18:30",
  );
  assert.equal(taskClocks("conferir as duas tarefas às 18h").length, 1);
});

for (const [n, text, title, due] of [
  [
    "typed",
    "Eu comprei 4 novos gados pra fazenda Eduardo, e me avise também as 18:30 pra eu alimentar eles",
    "alimentar eles",
    "2026-10-28T21:30:00.000Z",
  ],
  [
    "audio",
    "Você tem que anota na minha fazenda Eduardo que eu comprei quatro novos gados tá? E cria uma tarefa também para eu alimentar eles umas seis da tarde, por aí, tá?",
    "alimentar eles",
    "2026-10-28T21:00:00.000Z",
  ],
  [
    "spoken",
    "Hoje comprei quatro animais. Me avisa de dar ração umas seis e meia da tarde",
    "dar ração",
    "2026-10-28T21:30:00.000Z",
  ],
  [
    "inverted",
    "Cria uma tarefa para eu conferir a água às 18:30 e adicione 4 animais que eu comprei hoje",
    "conferir a água",
    "2026-10-28T21:30:00.000Z",
  ],
] as const) {
  test(`the producer's ${n} request saves both goals with one receipt`, async () => {
    const f = await fixture();
    try {
      const r = await send(f, n, text);
      assert.equal(r?.persisted, true, r?.reply ?? "");
      const b = (await f.guardian.load(phone)).active!.book;
      assert.equal(b.operations!.movements.length, 1);
      assert.equal(b.operations!.movements[0].count, 4);
      assert.equal(b.tasks.length, 1);
      assert.equal(b.tasks[0].title, title);
      assert.equal(b.tasks[0].dueAt, due);
      assert.match(r!.reply!, /tarefa|Agendar/i);
      assert.match(r!.reply!, /compra/);
      await send(f, n, text);
      assert.equal((await f.guardian.load(phone)).active!.book.tasks.length, 1);
    } finally {
      await f.db.close();
    }
  });
}

test("a speech transcription ambiguity keeps the valid reminder and asks only about the uncertain animal entry", async () => {
  const f = await fixture();
  try {
    const r = await send(
      f,
      "disfluent",
      "Ó, seguinte, adicione quatro animais, quatro galgos que eu comprei e crie uma tarefa para eu alimentar eles umas seis e meia da tarde.",
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.match(r!.reply!, /Pendente:.*bovinos/s);
    let b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.tasks.length, 1);
    assert.equal(b.operations, undefined);
    const clarification = await send(
      f,
      "corrected",
      "Eu comprei 4 novos gados pra fazenda Eduardo, e me avise também as 18:30 pra eu alimentar eles",
    );
    assert.equal(clarification?.persisted, true, clarification?.reply ?? "");
    b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.tasks.length, 1);
    assert.equal(b.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("a legacy partial receipt resumes the missing task from actual producer evidence without another cattle purchase", async () => {
  const f = await fixture();
  try {
    const original =
      "Eu comprei 4 novos gados pra fazenda Eduardo, e me avise também as 18:30 pra eu alimentar eles";
    // Reproduce the old release: it saved only the purchase, including the complete literal source quote.
    const s = await f.guardian.load(phone),
      b = structuredClone(s.active!.book);
    b.operations = {
      counts: [],
      lots: [],
      movements: [
        {
          id: "old-entry",
          type: "purchase",
          count: 4,
          date: "2026-10-28",
          description: original,
          source: {
            actor: phone,
            messageId: "original-purchase",
            sourceAt: at.toISOString(),
            at: at.toISOString(),
            confirmed: true,
          },
        },
      ],
    };
    await f.guardian.commit({
      phone,
      messageId: "original-purchase",
      accountVersion: s.accountVersion,
      propertyId: s.active!.id,
      propertyVersion: s.active!.version,
      operation: "update",
      book: b,
      pending: null,
      reply: "Compra salva.",
    });
    const history: ChatMessage[] = [
      { role: "user", content: original },
      { role: "assistant", content: "Compra salva." },
    ];
    const r = await send(f, "resume", "Tá, mas e a tarefa que eu te dei?", history);
    assert.equal(r?.persisted, true, r?.reply ?? "");
    let after = (await f.guardian.load(phone)).active!.book;
    assert.equal(after.operations!.movements.length, 1);
    assert.equal(after.tasks.length, 1);
    assert.equal(after.tasks[0].dueAt, "2026-10-28T21:30:00.000Z");
    assert.equal(after.tasks[0].source.messageId, "original-purchase");
    const again = await send(
      f,
      "resume-again",
      "Não, eu quero que você registre aí o painel da fazenda por mim. Seis e meia você me manda mensagem.",
      history,
    );
    assert.notEqual(again?.persisted, true);
    after = (await f.guardian.load(phone)).active!.book;
    assert.equal(after.tasks.length, 1);
    assert.equal(after.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("a model's earlier promise without producer evidence and a persisted receipt can't create a task", async () => {
  const f = await fixture();
  try {
    const r = await send(f, "no-proof", "E a tarefa que eu te dei?", [
      { role: "assistant", content: "Você comprou 4 animais e pediu alimentação às 18h30." },
    ]);
    assert.notEqual(r?.persisted, true);
    assert.equal((await f.guardian.load(phone)).active!.book.tasks.length, 0);
  } finally {
    await f.db.close();
  }
});

test("multiple independent reminders plus purchase and expense all survive the WhatsApp adapter", async () => {
  const f = await fixture();
  try {
    const r = await processClaimedWhatsAppChat(
      {
        phone,
        messageId: "adapter-multiple",
        text: "Hoje comprei 4 bois e paguei R$ 3000. Me avise às 18:30 para alimentar eles e cria uma tarefa para conferir a água às 19h",
        sentAt: at.toISOString(),
      },
      {
        loadConversation: async () => null,
        resolveUserText: async (i) => i.text,
        processGuardian: (i) =>
          handleGuardianMessage(i, { store: f.guardian, now: at, extract: noAI }),
        processHerd: noAI,
        executeChat: noAI,
        saveConversation: async () => {},
        completeMessage: async () => {},
      },
    );
    assert.match(r.reply!, /Registros salvos/);
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.operations!.movements.length, 1);
    assert.equal(b.ledger.length, 1);
    assert.equal(b.ledger[0].amountCents, 300000);
    assert.equal(b.tasks.length, 2);
    assert.equal(stockAt(b.operations!, "2026-10-28").count, null);
  } finally {
    await f.db.close();
  }
});

test("a species-only answer completes the pending cattle entry without repeating an already saved task", async () => {
  const f = await fixture();
  try {
    const first = await send(
      f,
      "uncertain-species",
      "Ó, seguinte, adicione quatro animais, quatro galgos que eu comprei e crie uma tarefa para eu alimentar eles umas seis e meia da tarde.",
    );
    assert.equal(first?.persisted, true, first?.reply ?? "");
    const r = await send(f, "species", "São bovinos", [
      { role: "assistant", content: first!.reply! },
    ]);
    assert.equal(r?.persisted, true, r?.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.operations!.movements.length, 1);
    assert.equal(b.operations!.movements[0].count, 4);
    assert.equal(b.tasks.length, 1);
    assert.equal(b.tasks[0].source.messageId, "uncertain-species");
    assert.equal(b.operations!.movements[0].source.messageId, "uncertain-species");
  } finally {
    await f.db.close();
  }
});

test("an uncounted entry stays pending while a complete requested reminder is saved truthfully", async () => {
  const f = await fixture();
  try {
    const r = await send(
      f,
      "missing-count",
      "Selecione a fazenda Eduardo e adicione gados. Me avise de dar ração hoje às 18:30",
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    assert.match(r!.reply!, /Pendente:/);
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.operations, undefined);
    assert.equal(b.tasks.length, 1);
  } finally {
    await f.db.close();
  }
});

test("a field note is independent of the purchase, financial payment and reminder", async () => {
  const f = await fixture();
  try {
    const r = await send(
      f,
      "four-goals",
      "Hoje comprei 4 bois e paguei R$ 3000. Anote que a cerca do lote 2 está quebrada hoje. Me avise de alimentar eles às 18:30",
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.operations!.movements.length, 1);
    assert.equal(b.ledger.length, 1);
    assert.equal(b.tasks.length, 1);
    assert.equal(b.records.length, 1);
    assert.match(b.records[0].description, /cerca/);
  } finally {
    await f.db.close();
  }
});

test("one creation verb can introduce an entire task list and negated alerts remain unexecuted", async () => {
  const f = await fixture();
  try {
    const r = await send(
      f,
      "list",
      "Hoje comprei 4 bois. Crie duas tarefas: uma para dar ração às seis e meia da tarde e outra para conferir a água às 19h",
    );
    assert.equal(r?.persisted, true, r?.reply ?? "");
    let b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.tasks.length, 2);
    assert.equal(b.operations!.movements.length, 1);
    assert.equal(b.tasks[0].dueAt, "2026-10-28T21:30:00.000Z");
    assert.equal(b.tasks[1].dueAt, "2026-10-28T22:00:00.000Z");
    const blocked = await send(f, "negative", "Não me avise de dar ração às 20h");
    assert.notEqual(blocked?.persisted, true);
    b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.tasks.length, 2);
  } finally {
    await f.db.close();
  }
});
