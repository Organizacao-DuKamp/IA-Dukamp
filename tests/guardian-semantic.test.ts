import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyFarm,
  PreferencesSchema,
  FarmBookSchema,
  type GuardianAction,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import { applyFarmAction, farmReport } from "../src/lib/guardian/book.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import {
  groundSemanticEvidence,
  handleSemanticTurn,
  semanticContext,
  type SemanticInterpreter,
} from "../src/lib/guardian/semantic.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "000000000000107",
  now = new Date("2026-10-29T15:00:00Z");
const audio = (s: string) =>
  `[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: ${s}`;
const inventory: GuardianAction = {
  kind: "herd_inventory",
  date: "2026-10-29",
  complete: true,
  groups: [
    {
      name: "Novilhas",
      count: 66,
      description:
        "12 a 24 meses; 38 aptas para IATF acima de 15 meses e 360 kg; 28 fora da IATF por idade e peso.",
    },
    {
      name: "Vacas parideiras",
      count: 100,
      description: "40 paridas e vazias; 60 solteiras, sendo 40 prenhas e 20 vazias.",
    },
    {
      name: "Machos",
      count: 20,
      description: "10 de 12 a 24 meses, 5 de 18 a 24 meses e 5 acima de 36 meses.",
    },
    {
      name: "Novilhas Girolando",
      count: 16,
      description: "Receptoras de embriões das doadoras Nelore.",
    },
  ],
};
const snapshot = (): GuardianSnapshot => ({
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  properties: [{ id: "farm-a", name: "Estância de Teste", role: "owner" }],
  active: {
    id: "farm-a",
    version: 1,
    role: "owner",
    book: emptyFarm("Estância de Teste", "Monte Aprazível", "SP"),
  },
});

test("existing herd census persists groups and details without births, fictitious IDs or double-counting subsets", () => {
  const b = applyFarmAction(
    snapshot().active!.book,
    inventory,
    "owner",
    {
      actor: phone,
      messageId: "inventory",
      at: now.toISOString(),
      confirmed: true,
    },
    "inventory",
  ).book;
  assert.equal(stockAt(b.operations!, "2026-10-29").count, 202);
  assert.equal(b.animals.length, 0);
  assert.equal(b.operations!.movements.length, 0);
  assert.equal(b.operations!.inventories![0].groups.length, 4);
  assert.ok(FarmBookSchema.safeParse(b).success);
  assert.match(farmCsv(b), /38 aptas/);
  const partial = applyFarmAction(
    b,
    { ...inventory, complete: false, groups: [inventory.groups[0]] },
    "owner",
    {
      actor: phone,
      messageId: "partial",
      at: now.toISOString(),
      confirmed: true,
    },
    "partial",
  ).book;
  assert.equal(stockAt(partial.operations!, "2026-10-29").count, 202);
  assert.throws(
    () =>
      applyFarmAction(
        b,
        inventory,
        "worker",
        {
          actor: phone,
          messageId: "denied",
          at: now.toISOString(),
          confirmed: true,
        },
        "denied",
      ),
    /perfil/,
  );
});

test("context strips audio wrappers and discards dialogue preceding property selection", () => {
  const context = semanticContext(
    {
      phone,
      messageId: "ctx",
      text: audio("Pode lançar esses animais"),
      mediaType: "audio",
      history: [
        { role: "user", content: "Na outra fazenda tenho 900 vacas" },
        {
          role: "assistant",
          content: "Fazenda selecionada: Estância de Teste.",
        },
        { role: "user", content: audio("Aqui são 66 novilhas") },
      ],
    },
    snapshot(),
    now,
  );
  assert.equal(context.messages.length, 2);
  assert.equal(context.messages[0].content, "Aqui são 66 novilhas");
  assert.equal(context.messages[1].content, "Pode lançar esses animais");
  assert.ok(!JSON.stringify(context).includes("900 vacas"));
});

test("contextual proposals, audio confirmation, SQL replay, audit and panel persistence use real RPCs", async () => {
  const f = await farmIntegration();
  try {
    await f.guardian.commit({
      phone,
      messageId: "create",
      accountVersion: 0,
      propertyId: randomUUID(),
      propertyVersion: null,
      operation: "create",
      book: emptyFarm("Estância de Teste", "Monte Aprazível", "SP"),
      pending: null,
      reply: "Criada",
    });
    const input = {
      phone,
      messageId: "census-proposal",
      text: audio(
        "Por favor, registre o rebanho existente: 66 novilhas, 100 vacas, 20 machos e 16 novilhas Girolando.",
      ),
      mediaType: "audio",
    };
    const interpret: SemanticInterpreter = async (c) => ({
      intent: "propose",
      propertyId: c.propertyId,
      question: "",
      entries: [
        {
          action: inventory,
          evidence: [{ messageIndex: 0, quote: c.messages[0].content }],
        },
      ],
    });
    const proposed = await handleGuardianMessage(input, {
      store: f.guardian,
      now,
      interpret,
    });
    assert.match(proposed!.reply!, /202 animais/);
    assert.equal((await f.guardian.load(phone)).active!.book.operations, undefined);
    const confirmation = {
      phone,
      messageId: "confirm-census",
      text: audio("Confirmer."),
      mediaType: "audio",
    };
    const yes: SemanticInterpreter = async (c) => ({
      intent: "confirm",
      propertyId: c.propertyId,
      question: "",
      entries: [],
    });
    const saved = await handleGuardianMessage(confirmation, {
      store: f.guardian,
      now,
      interpret: yes,
    });
    assert.equal(saved!.persisted, true);
    assert.match(saved!.reply!, /Salvo no painel/);
    let s = await f.guardian.load(phone);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-29").count, 202);
    await handleGuardianMessage(confirmation, {
      store: f.guardian,
      now,
      interpret: async () => {
        throw Error("must replay");
      },
    });
    s = await f.guardian.load(phone);
    assert.equal(s.active!.book.operations!.inventories!.length, 1);
    const audit = (
      await f.db.query<{ details: { confirmedBy: string } }>(
        "select details from guardian_audit where actor=$1 and message_id=$2",
        [phone, "confirm-census"],
      )
    ).rows;
    assert.equal(audit[0].details.confirmedBy, "confirm-census");
    const task = {
      phone,
      messageId: "task-proposal",
      text: audio(
        "Agende na Estância de Teste para amanhã, dia 30/10/2026, a visita do veterinário Emerson, que vai fazer o início da IATF, fazendo o dia zero.",
      ),
      mediaType: "audio",
    };
    const taskAction: GuardianAction = {
      kind: "task_create",
      title: "Visita do veterinário Emerson — início da IATF (Dia 0)",
      dueAt: "2026-10-30T11:00:00.000Z",
    };
    await handleGuardianMessage(task, {
      store: f.guardian,
      now,
      interpret: async (c) => ({
        intent: "propose",
        propertyId: c.propertyId,
        question: "",
        entries: [
          {
            action: taskAction,
            evidence: [{ messageIndex: 0, quote: c.messages[0].content }],
          },
        ],
      }),
    });
    await handleGuardianMessage(
      {
        ...confirmation,
        messageId: "confirm-task",
        text: audio("Isso, pode deixar marcado desse jeito"),
      },
      { store: f.guardian, now, interpret: yes },
    );
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.tasks.length, 1);
    assert.equal(book.tasks[0].title, taskAction.title);
    assert.equal(book.tasks[0].dueAt, "2026-10-30T11:00:00.000Z");
    assert.match(farmReport(book), /Emerson/);
  } finally {
    await f.db.close();
  }
});

test("uncited facts, another property, invalid batches, unavailable interpretation and expired confirmations cannot save", async () => {
  const s = snapshot();
  let writes = 0;
  const store = {
    load: async () => s,
    receipt: async () => null,
    commit: async () => {
      writes++;
      return "committed";
    },
  };
  const input = {
    phone,
    messageId: "blocked",
    text: "Quero registrar os animais",
  };
  const plan = {
    intent: "propose",
    propertyId: "farm-a",
    question: "",
    entries: [
      {
        action: inventory,
        evidence: [{ messageIndex: 0, quote: "Dado inventado" }],
      },
    ],
  };
  const r = await handleSemanticTurn(input, s, store, now, now, async () => plan);
  assert.match((r as { reply: string }).reply, /Nenhum registro/);
  assert.equal(writes, 0);
  await handleSemanticTurn(input, s, store, now, now, async () => ({
    ...plan,
    propertyId: "another-farm",
  }));
  assert.equal(writes, 0);
  await handleSemanticTurn(input, s, store, now, now, async () => {
    throw Error("timeout");
  });
  assert.equal(writes, 0);
  const source = {
    propertyId: "farm-a",
    createdAt: now.toISOString(),
    expiresAt: "2026-10-28T15:00:00Z",
    sourceMessageId: "old",
    action: inventory,
  };
  s.pending = source;
  const expired = await handleSemanticTurn(input, s, store, now, now, async () => ({
    intent: "confirm",
    propertyId: "farm-a",
    question: "",
    entries: [],
  }));
  assert.match((expired as { reply: string }).reply, /Não há uma proposta válida/);
  assert.equal(writes, 0);
  s.pending = {
    ...source,
    expiresAt: "2026-10-29T16:00:00Z",
    actions: [
      inventory,
      {
        kind: "task_create",
        title: "No passado",
        dueAt: "2026-10-28T11:00:00Z",
      },
    ],
  };
  await handleSemanticTurn(input, s, store, now, now, async () => ({
    intent: "confirm",
    propertyId: "farm-a",
    question: "",
    entries: [],
  }));
  assert.equal(writes, 0);
  assert.equal(s.active!.book.operations, undefined);
});

test("a question about registration remains conversational instead of falling into the failed-movement recognizer", async () => {
  const s = snapshot();
  const store = {
    load: async () => s,
    receipt: async () => null,
    commit: async () => {
      throw Error("a question cannot write");
    },
  };
  const result = await handleGuardianMessage(
    {
      phone,
      messageId: "registration-question",
      text: audio("Para você cadastrar esses animais, que dados você precisa?"),
      mediaType: "audio",
    },
    {
      store,
      now,
      interpret: async () => ({ intent: "none", propertyId: "farm-a", question: "", entries: [] }),
    },
  );
  assert.equal(result?.conversational, true);
  assert.equal(result?.reply, null);
  assert.match(result?.context ?? "", /sem brincos/);
});

test("an oversized request is never silently truncated into a partial saved census", async () => {
  const s = snapshot();
  const store = {
    load: async () => s,
    receipt: async () => null,
    commit: async () => {
      throw Error("must not write");
    },
  };
  const r = await handleSemanticTurn(
    { phone, messageId: "too-long", text: "Tenho 66 novilhas. ".repeat(400) },
    s,
    store,
    now,
    now,
    async () => {
      throw Error("must not interpret truncated text");
    },
  );
  assert.match((r as { reply: string }).reply, /envie em partes menores/);
  assert.equal(s.active!.book.operations, undefined);
});

test("abbreviated evidence resolves to the complete original span without accepting invented or assistant facts", () => {
  const c = semanticContext(
    {
      phone,
      messageId: "citations",
      text: "Pode preparar sem código",
      history: [
        {
          role: "user",
          content: "Tenho 66 novilhas, sendo 38 aptas e 28 fora, e também 16 receptoras.",
        },
        { role: "assistant", content: "Existem 900 vacas" },
      ],
    },
    snapshot(),
    now,
  );
  const e = groundSemanticEvidence(c, {
    messageIndex: 0,
    quote: "Tenho 66 novilhas... e também 16 receptoras.",
  });
  assert.equal(e?.quote, "Tenho 66 novilhas, sendo 38 aptas e 28 fora, e também 16 receptoras.");
  assert.equal(
    groundSemanticEvidence(c, { messageIndex: 0, quote: "Tenho 66 novilhas... 800 vacas" }),
    null,
  );
  assert.equal(groundSemanticEvidence(c, { messageIndex: 1, quote: "900 vacas" }), null);
});

test("a concurrent farm selection cannot move a contextual proposal into the new farm", async () => {
  let s = snapshot(),
    interpreted = 0,
    commits = 0;
  const store = {
    load: async () => s,
    receipt: async () => null,
    commit: async () => {
      commits++;
      s = {
        ...snapshot(),
        active: { ...snapshot().active!, id: "farm-b" },
        properties: [{ id: "farm-b", name: "Outra", role: "owner" as const }],
      };
      return "conflict";
    },
  };
  const result = await handleGuardianMessage(
    { phone, messageId: "scope-conflict", text: "Por favor registre os 202 animais" },
    {
      store,
      now,
      interpret: async (c) => {
        interpreted++;
        return {
          intent: "propose",
          propertyId: c.propertyId,
          question: "",
          entries: [
            { action: inventory, evidence: [{ messageIndex: 0, quote: c.messages[0].content }] },
          ],
        };
      },
    },
  );
  assert.equal(interpreted, 1);
  assert.equal(commits, 1);
  assert.match(result?.reply ?? "", /fazenda selecionada mudou/);
  assert.equal(s.active!.book.operations, undefined);
});

test("bounded model context retains authoritative full herd and individual-record totals", () => {
  const s = snapshot();
  const source = {
    actor: phone,
    messageId: "source",
    at: now.toISOString(),
    confirmed: true as const,
  };
  s.active!.book.animals = Array.from({ length: 70 }, (_, i) => ({
    code: "a" + i,
    sex: "unknown" as const,
    weights: [],
    source,
  }));
  s.active!.book.operations = {
    lots: [],
    counts: [{ id: "baseline", count: 100, date: "2026-10-28", source }],
    movements: Array.from({ length: 20 }, (_, i) => ({
      id: "birth" + i,
      type: "birth" as const,
      count: 1,
      date: "2026-10-29",
      description: "nascimento",
      source,
    })),
  };
  const c = semanticContext(
    { phone, messageId: "summary", text: "Quantos animais tenho?" },
    s,
    now,
  );
  assert.equal(c.snapshot.active!.book.animals.length, 50);
  assert.equal(c.snapshot.active!.book.operations!.movements.length, 10);
  assert.equal(c.summary.animalCount, 70);
  assert.equal(c.summary.stockCount, 120);
});
