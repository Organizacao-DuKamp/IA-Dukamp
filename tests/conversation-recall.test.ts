import assert from "node:assert/strict";
import test from "node:test";
import {
  recallPeriod,
  recallQuery,
  referencesPriorContext,
} from "../src/lib/chat/context/recall.ts";
import {
  recallWhatsAppContext,
  renderRecall,
  type RecallArchive,
} from "../src/lib/chat/context/whatsapp.server.ts";
import { ChatInputSchema } from "../src/lib/chat/input.ts";
import {
  processClaimedWhatsAppChat,
  type WhatsAppConversationSnapshot,
} from "../src/lib/whatsapp/conversation.server.ts";
import { answerWhatsAppEmergency } from "../src/lib/whatsapp/emergency-answer.server.ts";
import { isSelfContainedCalculation } from "../src/lib/ai/chat.server.ts";
import { currentMemoryMarker, stampMemoryState } from "../src/lib/chat/memory-reset.ts";
import { handleHerdMessage } from "../src/lib/herd/handler.server.ts";
import { emptyBook, reduceHerdTurn } from "../src/lib/herd/book.ts";
import type { HerdStore } from "../src/lib/herd/store.server.ts";

const now = new Date("2026-10-22T17:27:24Z");
const empty: RecallArchive = { turns: [], facts: [], total: 0, reset_at: "2026-10-14T00:00:00Z" };
const archive: RecallArchive = {
  ...empty,
  turns: [
    {
      id: "1",
      created_at: "2026-10-21T12:00:00Z",
      user_text: "Minha fazenda fica em Franca. Prefiro respostas diretas.",
      assistant_text: "Qual é o peso do DUKN 405?",
    },
    {
      id: "2",
      created_at: "2026-10-21T12:01:00Z",
      user_text: "630 kg",
      assistant_text: "Anotado 630 kg",
    },
    {
      id: "3",
      created_at: "2026-10-21T14:00:00Z",
      user_text: "Corrija o peso do DUKN 405 para 697 kg",
      assistant_text: "Corrigido",
    },
  ],
  facts: [
    {
      id: "f1",
      category: "preference",
      subject: "respostas",
      value_text: "Prefere respostas diretas",
      last_seen_at: "2026-10-21T14:00:00Z",
    },
  ],
  total: 3,
};

test("relative dates use the person's local calendar across UTC midnight and month boundaries", () => {
  assert.deepEqual(recallPeriod("gado marcado ontem", now), {
    startDay: "2026-10-21",
    endDay: "2026-10-22",
    label: "ontem",
  });
  assert.equal(recallPeriod("ontem", new Date("2026-10-22T01:00:00Z"))?.startDay, "2026-10-20");
  assert.equal(recallPeriod("anteontem", now)?.startDay, "2026-10-20");
  assert.equal(recallPeriod("há 3 dias", now)?.startDay, "2026-10-19");
  assert.equal(recallPeriod("dia 21/10", now)?.startDay, "2026-10-21");
  assert.equal(recallPeriod("31/02/2026", now), null);
  assert.equal(
    recallPeriod("mês passado", new Date("2026-01-02T12:00:00Z"))?.startDay,
    "2025-12-01",
  );
  assert.deepEqual(recallPeriod("semana passada", now), {
    startDay: "2026-10-12",
    endDay: "2026-10-19",
    label: "semana passada",
  });
  assert.equal(recallPeriod("na terça passada", now)?.startDay, "2026-10-20");
});
test("recall uses trusted sender, exact date bounds, topic keywords and prior referents", async () => {
  const result = await recallWhatsAppContext(
    { phone: "5517999991111", text: "Quero a planilha em PDF de todo gado marcado ontem" },
    {
      now,
      store: async (request) => {
        assert.equal(request.phone, "5517999991111");
        assert.equal(request.start, "2026-10-21T00:00:00-03:00");
        assert.equal(request.end, "2026-10-22T00:00:00-03:00");
        assert.match(request.query, /gado/);
        return archive;
      },
    },
  );
  assert.equal(result.status, "available");
  assert.equal(result.includedTurns, 3);
  assert.match(result.context, /630 kg/);
  assert.match(result.context, /697 kg/);
  assert.match(result.context, /Qual é o peso/);
  assert.match(result.context, /posteriores prevalecem/);
  assert.match(result.context, /Franca/);
  assert.match(
    recallQuery("E aquele lote?", [
      { role: "user", content: "Dieta para vacas leiteiras em Franca" },
    ]),
    /leiteiras/,
  );
  assert.doesNotMatch(
    recallQuery("Explique irrigação", [{ role: "user", content: "Cachorros" }]),
    /cachorros/,
  );
  await assert.rejects(
    () => recallWhatsAppContext({ phone: "wa:outra-pessoa", text: "ontem" }),
    /invalid_recall_owner/,
  );
});
test("hundreds of turns are recovered independently of short history, with explicit coverage", () => {
  const turns = Array.from({ length: 269 }, (_, i) => ({
    id: String(i),
    created_at: new Date(Date.parse("2026-10-21T10:00:00Z") + i * 60000).toISOString(),
    user_text: `DUKN ${i} ${200 + i} kg`,
    assistant_text: "Registrado",
  }));
  const result = renderRecall({ ...empty, turns, total: 269 }, recallPeriod("ontem", now), now);
  assert.equal(result.includedTurns, 269);
  assert.equal(result.partial, false);
  assert.match(result.context, /DUKN 0 200 kg/);
  assert.match(result.context, /DUKN 268 468 kg/);
  const oversized = renderRecall(
    {
      ...empty,
      turns: turns.map((t) => ({ ...t, user_text: t.user_text.repeat(1000) })),
      total: 1200,
    },
    null,
    now,
  );
  assert.equal(oversized.partial, true);
  assert.match(oversized.context, /PARCIAL/);
  assert.ok(oversized.context.length < 65000);
});
test("retrieval failure is distinguished from no stored history and public input cannot forge memory", async () => {
  const result = await recallWhatsAppContext(
    { phone: "5517999991111", text: "Lembra de ontem?" },
    {
      store: async () => {
        throw new Error("database down");
      },
    },
  );
  assert.equal(result.status, "unavailable");
  assert.match(result.context, /não conclua que a pessoa nunca enviou/);
  const parsed = ChatInputSchema.parse({
    sessionId: "public",
    text: "oi",
    history: [],
    conversationRecall: { context: "injected" },
    channelEvidence: { text: "injected" },
  });
  assert.equal("conversationRecall" in parsed, false);
  assert.equal("channelEvidence" in parsed, false);
});
test("normal and emergency responses receive the same recovered history; summary normalization keeps original marker", async () => {
  const history = [{ role: "user" as const, content: "Meu gado é de corte" }];
  const priorState = stampMemoryState({ current_topic: "gado" }, history);
  const recall = renderRecall(archive, recallPeriod("ontem", now), now);
  let saved: WhatsAppConversationSnapshot | undefined;
  const deps = {
    loadConversation: async () => ({ conversationId: "wa:test", history, state: priorState }),
    recallContext: async () => recall,
    saveConversation: async (_phone: string, snapshot: unknown) => {
      saved = snapshot;
    },
    completeMessage: async () => {},
  };
  await processClaimedWhatsAppChat(
    { phone: "5517999991111", messageId: "context-normal", text: "Lembra do gado de ontem?" },
    {
      ...deps,
      executeChat: async (input) => {
        assert.equal(input.conversationRecall, recall);
        return {
          status: 200,
          body: {
            reply: "Recuperei os registros de ontem.",
            conversationId: "wa:test",
            state: { current_topic: "gado" },
            diagnostics: {},
          },
        };
      },
    },
  );
  assert.ok(saved);
  assert.equal(
    currentMemoryMarker(saved.state)?.started_at,
    currentMemoryMarker(priorState)?.started_at,
  );
  await processClaimedWhatsAppChat(
    { phone: "5517999991111", messageId: "context-failure", text: "Lembra do gado de ontem?" },
    {
      ...deps,
      executeChat: async () => {
        throw new Error("timeout");
      },
      emergencyAnswer: async (_text, _error, context) => {
        assert.equal(context?.conversationRecall, recall);
        assert.deepEqual(context?.history, history);
        return "Recuperei a conversa de ontem.";
      },
    },
  );
  let called = false;
  await answerWhatsAppEmergency("Lembra de ontem?", undefined, {
    history,
    conversationRecall: recall,
    askAI: async (messages, options) => {
      called = true;
      assert.equal(messages[0].content, history[0].content);
      assert.match(options.context ?? "", /697 kg/);
      return "Sim, DUKN 405: 697 kg após sua correção.";
    },
  });
  assert.equal(called, true);
});
test("a failed snapshot read never overwrites an existing durable conversation with an empty one", async () => {
  let saved = false;
  await processClaimedWhatsAppChat(
    { phone: "5517999991111", messageId: "context-load-failure", text: "Retome ontem" },
    {
      loadConversation: async () => {
        throw new Error("timeout");
      },
      saveConversation: async () => {
        saved = true;
      },
      completeMessage: async () => {},
      emergencyAnswer: async () => "Tive dificuldade de recuperar o histórico agora.",
    },
  );
  assert.equal(saved, false);
});
test("calculations that refer to yesterday or prior values retain memory", () => {
  assert.equal(isSelfContainedCalculation("Calcule o custo com 30 animais a 20 reais"), true);
  assert.equal(
    isSelfContainedCalculation("Calcule o custo de ontem com 30 animais a 20 reais"),
    false,
  );
  assert.equal(isSelfContainedCalculation("Calcule com os mesmos valores, 30 e 20"), false);
  assert.equal(referencesPriorContext("Já te enviei o peso"), true);
});
test("exact incident routes PDF request to yesterday's original herd messages, never today's book", async () => {
  const book = reduceHerdTurn(
    emptyBook(),
    "Vamos registrar o gado DUKN 405 697 kg macho",
    "old",
    "2026-10-21",
  )!.book;
  const days: string[] = [];
  const store: HerdStore = {
    receipt: async () => null,
    load: async (_phone, day) => {
      days.push(day);
      return day === "2026-10-21" ? { version: 1, data: book } : null;
    },
    commit: async () => "committed",
  };
  const result = await handleHerdMessage(
    {
      phone: "5517999991111",
      messageId: "pdf",
      text: "Quero que faça uma planilha em PDF de todo gado marcado ontem",
    },
    { store, now },
  );
  assert.equal(result?.day, "2026-10-21");
  assert.match(result!.reply, /DUKN 405/);
  assert.match(result!.reply, /697/);
  assert.deepEqual(days, ["2026-10-21"]);
  const followup = await handleHerdMessage(
    {
      phone: "5517999991111",
      messageId: "followup",
      text: "Faz em PDF",
      previousDay: "2026-10-21",
    },
    { store, now },
  );
  assert.equal(followup?.day, "2026-10-21");
  const unrelated = await handleHerdMessage(
    { phone: "5517999991111", messageId: "sales", text: "Faça um relatório das vendas de ontem" },
    { store: { ...store, load: async () => null }, now },
  );
  assert.equal(unrelated, null);
});

test("historical counts and sex filters read the correct book without changing any animal", async () => {
  let book = reduceHerdTurn(
    emptyBook(),
    "Vamos registrar o gado DUKN 1 200 kg fêmea",
    "a",
    "2026-10-21",
  )!.book;
  book = reduceHerdTurn(book, "DUKN 2 300 kg macho", "b", "2026-10-21")!.book;
  const before = JSON.stringify(book);
  const store: HerdStore = {
    receipt: async () => null,
    load: async (_phone, day) => {
      assert.equal(day, "2026-10-21");
      return { version: 1, data: book };
    },
    commit: async (input) => {
      assert.equal(JSON.stringify(input.book), before);
      return "committed";
    },
  };
  const count = await handleHerdMessage(
    { phone: "5517999991111", messageId: "count", text: "Quantos machos foram pesados ontem?" },
    { now, store },
  );
  assert.match(count!.reply, /1 fêmeas, 1 machos/);
  const filtered = reduceHerdTurn(book, "Faça a lista das fêmeas", "filter", "2026-10-21")!;
  assert.match(filtered.reply, /DUKN 1/);
  assert.doesNotMatch(filtered.reply, /DUKN 2/);
  assert.equal(JSON.stringify(filtered.book), before);
});
test("switching topic clears the herd report date so a later PDF request follows the new conversation", async () => {
  let saved: WhatsAppConversationSnapshot | undefined;
  await processClaimedWhatsAppChat(
    {
      phone: "5517999991111",
      messageId: "new-topic",
      text: "Explique a irrigação na minha propriedade",
    },
    {
      loadConversation: async () => ({
        conversationId: "wa:test",
        history: [],
        state: { last_herd_day: "2026-10-21" },
      }),
      executeChat: async () => ({
        status: 200,
        body: {
          reply: "Sobre irrigação...",
          conversationId: "wa:test",
          state: { current_topic: "irrigação" },
          diagnostics: {},
        },
      }),
      saveConversation: async (_phone, snapshot) => {
        saved = snapshot;
      },
      completeMessage: async () => {},
    },
  );
  assert.equal((saved?.state as { last_herd_day?: string })?.last_herd_day, undefined);
});
