import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import {
  emptyFarm,
  type GuardianAction,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import { applyFarmAction } from "../src/lib/guardian/book.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import {
  semanticContext,
  groundSemanticEvidence,
  type SemanticContext,
  type SemanticInterpreter,
} from "../src/lib/guardian/semantic.server.ts";
import type { ChatMessage } from "../src/lib/chat/types.ts";

const phone = "000000000000483",
  now = new Date("2026-10-29T18:00:00Z");
const original =
  "Na minha fazenda Tamburi tem 100 bovinos contabilizados, tá? Mas além desses, aqui ainda tem mais duas galinhas, mais cinco gados nelore e mais sete porcos, tá? Se você puder...";
const additional: GuardianAction = {
  kind: "herd_inventory",
  date: "2026-10-29",
  complete: false,
  mode: "additional",
  groups: [
    {
      name: "Gados Nelore",
      species: "cattle",
      count: 5,
      description: "Cinco animais existentes ainda não contabilizados.",
    },
    {
      name: "Porcos",
      species: "pig",
      count: 7,
      description: "Sete animais existentes ainda não contabilizados.",
    },
    {
      name: "Galinhas",
      species: "poultry",
      count: 2,
      description: "Duas aves existentes ainda não contabilizadas.",
    },
  ],
};
async function fixture() {
  const f = await farmIntegration();
  const baseline = applyFarmAction(
    emptyFarm("Tambori", "Tanabi", "SP"),
    {
      kind: "herd_inventory",
      date: "2026-10-29",
      complete: true,
      groups: [
        { name: "Bovinos", species: "cattle", count: 100, description: "Já contabilizados." },
        { name: "Porcos", species: "pig", count: 40, description: "Já contabilizados." },
        { name: "Galinhas", species: "poultry", count: 2, description: "Já contabilizadas." },
      ],
    },
    "owner",
    { actor: phone, messageId: "baseline", at: now.toISOString(), confirmed: true },
    "baseline",
  ).book;
  await f.guardian.commit({
    phone,
    messageId: "create",
    accountVersion: 0,
    propertyId: randomUUID(),
    propertyVersion: null,
    operation: "create",
    pending: null,
    reply: "Criada",
    book: baseline,
  });
  return f;
}
function plan(c: SemanticContext, bad = false) {
  return {
    intent: "apply",
    propertyId: c.propertyId,
    question: "",
    entries: [
      {
        action: additional,
        evidence: [
          {
            messageIndex: c.messages.findIndex((m) => m.content === original),
            quote: bad
              ? "5 bovinos Nelore e 7 porcos"
              : "mais duas galinhas, mais cinco gados nelore e mais sete porcos",
          },
        ],
      },
    ],
  };
}
const send = (
  f: Awaited<ReturnType<typeof fixture>>,
  id: string,
  text: string,
  interpret: SemanticInterpreter,
  history?: ChatMessage[],
) =>
  handleGuardianMessage(
    { phone, messageId: id, text, mediaType: "audio", history },
    { store: f.guardian, now, interpret },
  );
function totals(s: GuardianSnapshot) {
  return ["cattle", "pig", "poultry"].map(
    (species) =>
      stockAt(s.active!.book.operations!, "2026-10-29", undefined, species as "cattle").count,
  );
}

test("a citation failure pins producer facts and the later spoken answer saves the whole request once with real SQL", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const bad = await send(f, "original", original, async (c) => {
      calls++;
      return plan(c, true);
    });
    assert.equal(calls, 2, "one bounded repair, never an interpreter loop");
    assert.equal(bad!.persisted, false);
    let s = await f.guardian.load(phone);
    assert.deepEqual(totals(s), [100, 40, 2]);
    assert.equal(s.pending?.kind, "semantic_draft");
    assert.equal(s.pending!.sourceMessageId, "original");
    assert.ok("messages" in s.pending! && s.pending.messages!.some((m) => m.content === original));
    // A long intervening explanation and rolling window cannot displace the pinned audio.
    const history: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: i % 2 ? "Explicação. ".repeat(200) : "Pergunta intermediária " + i,
    }));
    const saved = await send(
      f,
      "add-answer",
      "É para somar.",
      async (c) => {
        assert.ok(c.messages.some((m) => m.content === original));
        assert.deepEqual(c.summary.stockBySpecies, { cattle: 100, pig: 40, poultry: 2 });
        return plan(c);
      },
      history,
    );
    assert.equal(saved!.persisted, true, saved!.reply!);
    s = await f.guardian.load(phone);
    assert.deepEqual(totals(s), [105, 47, 4]);
    assert.equal(s.pending, null);
    assert.equal(s.active!.book.animals.length, 0);
    assert.equal(s.active!.book.operations!.movements.length, 0);
    assert.equal(s.active!.book.operations!.inventories!.length, 2);
    await send(f, "add-answer", "É para somar.", async () => {
      throw Error("must replay");
    });
    assert.deepEqual(totals(await f.guardian.load(phone)), [105, 47, 4]);
    const audit = (
      await f.db.query<{
        details: {
          sourceMessageId: string;
          executedByMessageId: string;
          evidence: Array<{ quote: string }>;
        };
      }>("select details from guardian_audit where actor=$1 and message_id='add-answer'", [phone])
    ).rows[0].details;
    assert.equal(audit.sourceMessageId, "original");
    assert.equal(audit.executedByMessageId, "add-answer");
    assert.match(audit.evidence[0].quote, /cinco gados/);
  } finally {
    await f.db.close();
  }
});

test("an invalid model citation is repaired using the original audio, never assistant paraphrases", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const r = await send(f, "repair", original, async (c) => {
      calls++;
      if (!c.validation) return plan(c, true);
      assert.equal(c.validation.invalidEvidence.length, 1);
      return plan(c);
    });
    assert.equal(calls, 2);
    assert.equal(r!.persisted, true);
    assert.deepEqual(totals(await f.guardian.load(phone)), [105, 47, 4]);
  } finally {
    await f.db.close();
  }
});

test("a draft survives 31 minutes and a mistaken confirm is reinterpreted as a contextual apply", async () => {
  const f = await fixture();
  try {
    await send(f, "clarify", original, async (c) => ({
      intent: "clarify",
      propertyId: c.propertyId,
      question: "É para somar aos animais já contabilizados?",
      entries: [],
    }));
    let calls = 0;
    const r = await handleGuardianMessage(
      { phone, messageId: "exactly", text: "Exatamente.", mediaType: "audio" },
      {
        store: f.guardian,
        now: new Date(now.getTime() + 31 * 60000),
        interpret: async (c) => {
          calls++;
          assert.equal(c.snapshot.pending?.kind, "semantic_draft");
          assert.ok(c.messages.some((m) => m.content === original));
          return c.validation
            ? plan(c)
            : { intent: "confirm", propertyId: c.propertyId, question: "", entries: [] };
        },
      },
    );
    assert.equal(calls, 2);
    assert.equal(r!.persisted, true, r!.reply!);
    assert.deepEqual(totals(await f.guardian.load(phone)), [105, 47, 4]);
  } finally {
    await f.db.close();
  }
});

test("number words stay literal, unique misplaced indices resolve, and invented/ambiguous/assistant-only quotes fail", async () => {
  const f = await fixture();
  try {
    const c = semanticContext(
      {
        phone,
        messageId: "cite",
        text: "É para somar",
        history: [
          { role: "user", content: original },
          { role: "assistant", content: "5 bovinos Nelore, 7 porcos e 2 galinhas" },
        ],
      },
      await f.guardian.load(phone),
      now,
    );
    assert.equal(
      groundSemanticEvidence(c, { messageIndex: 2, quote: "CINCO   gados nelore" })?.quote,
      "cinco gados nelore",
    );
    assert.equal(groundSemanticEvidence(c, { messageIndex: 0, quote: "5 bovinos Nelore" }), null);
    assert.equal(groundSemanticEvidence(c, { messageIndex: 1, quote: "7 porcos" }), null);
    c.messages.push({ role: "user", content: original });
    assert.equal(groundSemanticEvidence(c, { messageIndex: 1, quote: "cinco gados nelore" }), null);
  } finally {
    await f.db.close();
  }
});

test("a repeated utterance is preserved in chronological order and current indices are explicit", async () => {
  const f = await fixture();
  try {
    const c = semanticContext(
      {
        phone,
        messageId: "order",
        text: "Exatamente",
        history: [
          { role: "user", content: "Sim" },
          { role: "assistant", content: "Uma pergunta" },
          { role: "user", content: "Sim" },
          { role: "assistant", content: "Outra pergunta" },
        ],
      },
      await f.guardian.load(phone),
      now,
    );
    assert.equal(c.messages.filter((m) => m.content === "Sim").length, 2);
    assert.deepEqual(
      c.messages.map((m) => m.messageIndex),
      [0, 1, 2, 3, 4],
    );
  } finally {
    await f.db.close();
  }
});

test("additional existing animals require a known baseline, and failed batches leave every species unchanged", async () => {
  const f = await fixture();
  try {
    const s = await f.guardian.load(phone);
    assert.throws(
      () =>
        applyFarmAction(
          emptyFarm("Unknown", null, null),
          additional,
          "owner",
          { actor: phone, messageId: "unknown", at: now.toISOString(), confirmed: true },
          "unknown",
        ),
      /contagem anterior/,
    );
    assert.deepEqual(totals(s), [100, 40, 2]);
    assert.equal(s.active!.book.operations!.inventories!.length, 1);
  } finally {
    await f.db.close();
  }
});
