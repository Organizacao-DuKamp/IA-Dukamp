import assert from "node:assert/strict";
import test from "node:test";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { automaticFarmEvent } from "../src/lib/guardian/automatic.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { FarmBookSchema } from "../src/lib/guardian/schema.ts";
import { managementDialogue } from "../src/lib/guardian/management-dialogue.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import { handleFarmPanel, hashToken, PANEL_COOKIE } from "../src/lib/guardian/panel.server.ts";
import type { ChatMessage } from "../src/lib/chat/types.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "5517999991111",
  now = new Date("2026-10-27T18:25:00Z");
const noAI = async () => {
  throw new Error("A structured management request must not reach search or general chat");
};
const audio = (t: string) =>
  `[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: ${t}`;
type Fixture = Awaited<ReturnType<typeof farmIntegration>>;
async function seed(f: Fixture) {
  await f.observe(
    phone,
    "baseline",
    "Minha fazenda fica em Tanabi e tenho 88 cabeças.",
    "2026-10-25T15:00:00Z",
  );
}
function turn(f: Fixture, id: string, text: string, history?: ChatMessage[], mediaType?: string) {
  return handleGuardianMessage(
    { phone, messageId: id, text, history, mediaType },
    { store: f.guardian, now, extract: noAI },
  );
}
async function calves(f: Fixture) {
  await turn(f, "birth", "Hoje nasceram mais dois bezerros");
  await turn(f, "identities", "código b01, RGN DKN 404\ncódigo b02, RGN DKN 406");
}

test("real spoken birth requests retain the event through commands, number words and speech fillers", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const snapshot = await f.guardian.load(phone);
    for (const text of [
      "Como faço para mover o animal b01 para o lote 2?",
      "Se eu pedir, coloque o animal b01 no lote 2",
      "Não mova o animal b01 para o lote 2",
    ])
      assert.equal(managementDialogue({ text, phone, at: now }, snapshot), null, text);
    for (const text of [
      "Repente, adicione mais dois bezerros que nasceram hoje, tá? no rebanho, por favor.",
      "Não, eu quero que você adicione mais dois bezerros que nasceram hoje na fazenda.",
      "Tpec, por favor, adicione mais dois bezerros que nasceram hoje.",
      "Adicione mais 2 bezerros que nasceram hoje na minha fazenda",
    ]) {
      const result = automaticFarmEvent(
        { text: audio(text), mediaType: "audio", at: now },
        snapshot,
      );
      assert.equal(result.status, "action", text + ": " + JSON.stringify(result));
      if (result.status === "action") {
        assert.equal(result.action.kind, "herd_event");
        if (result.action.kind === "herd_event") assert.equal(result.action.count, 2);
      }
    }
    const reply = await turn(
      f,
      "spoken",
      audio("Repente, adicione mais dois bezerros que nasceram hoje, tá? no rebanho, por favor."),
      undefined,
      "audio",
    );
    assert.equal(reply!.persisted, true, reply!.reply ?? "");
    await turn(f, "spoken", "same webhook retry");
    const s = await f.guardian.load(phone);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 90);
    assert.equal(s.active!.book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("lists with a natural yes header save all codes without a mandatory template", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await turn(f, "birth", "Nasceu 2 bezerros hoje na fazenda");
    const result = await turn(f, "list", "Sim, eles tem:\n\nDUKN 402\nDUKN 404");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    const s = await f.guardian.load(phone);
    assert.deepEqual(
      s.active!.book.animals.map((a) => a.code),
      ["DUKN 402", "DUKN 404"],
    );
    assert.ok(s.active!.book.animals.every((a) => !a.rgn));
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 90);
  } finally {
    await f.db.close();
  }
});

test("an unlabeled second identifier asks one contextual question and accepts a simple yes", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await turn(f, "birth", "Nasceu 2 bezerros hoje na fazenda");
    const proposal = await turn(f, "pairs", "Código b01, DUKN 401\nCódigo b02, DUKN 404");
    assert.match(proposal!.reply!, /código b01, RGN DUKN 401/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
    const saved = await turn(f, "yes", "sim", [{ role: "assistant", content: proposal!.reply! }]);
    assert.equal(saved!.persisted, true, saved!.reply ?? "");
    const s = await f.guardian.load(phone);
    assert.deepEqual(
      s.active!.book.animals.map((a) => [a.code, a.rgn]),
      [
        ["b01", "DUKN 401"],
        ["b02", "DUKN 404"],
      ],
    );
    assert.equal(s.pending, null);
  } finally {
    await f.db.close();
  }
});

test("the exact last-two lot request changes the actual animals, preserves RGN and never adds births", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    const text =
      "Sabe esses dois últimos animais registrados? Então, coloque eles no lote 2 da fazenda por favor";
    const moved = await turn(f, "move", text);
    assert.equal(moved!.persisted, true, moved!.reply ?? "");
    assert.match(moved!.reply!, /b01.*lote 2/);
    assert.doesNotMatch(moved!.reply!, /anotad[oa]|como cadastrar|têm código|Faltam identificar/);
    await turn(f, "move", text);
    await turn(f, "move-again", text);
    const s = await f.guardian.load(phone),
      b = s.active!.book;
    assert.deepEqual(
      b.animals.map((a) => [a.code, a.rgn, a.lot]),
      [
        ["b01", "DKN 404", "2"],
        ["b02", "DKN 406", "2"],
      ],
    );
    assert.equal(b.records.filter((r) => r.type === "movement").length, 2);
    assert.equal(stockAt(b.operations!, "2026-10-27").count, 90);
    assert.equal(b.operations!.movements.length, 1);
    assert.ok(b.operations!.lots.some((l) => l.name === "2"));
    FarmBookSchema.parse(b);
  } finally {
    await f.db.close();
  }
});

test("the exact audio refers to the just-identified calves instead of being parsed as a new birth", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    const result = await processClaimedWhatsAppChat(
      { phone, messageId: "wa-move", text: "audio", media: { type: "audio", id: "fixture-audio" } },
      {
        loadConversation: async () => null,
        resolveUserText: async () =>
          audio(
            "Faça o seguinte, esses dois novos bezerros que nasceu na fazenda, que eles estão numerados, coloque ele no lote 2 da fazenda, tá bom?",
          ),
        processGuardian: (i) => handleGuardianMessage(i, { store: f.guardian, now, extract: noAI }),
        processHerd: noAI,
        executeChat: noAI,
        saveConversation: async () => {},
        completeMessage: async () => {},
      },
    );
    assert.match(result.reply!, /b02.*lote 2/);
    const b = (await f.guardian.load(phone)).active!.book;
    assert.ok(b.animals.every((a) => a.lot === "2"));
    assert.equal(b.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("a recurring financial statement from audio goes directly to finance with its actual amount and object", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const text = audio(
      "Olha, registra pra mim que a minha fazenda, ela tem cinco mil de despesas todos os meses, tá? E só com cana de açúcar.",
    );
    const saved = await turn(f, "monthly-cane", text, undefined, "audio");
    assert.equal(saved!.persisted, true, saved!.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.ledger.length, 1);
    assert.equal(b.ledger[0].amountCents, 500000);
    assert.match(b.ledger[0].description, /cana de a[cç][uú]car/i);
    assert.equal(b.ledger[0].recurrence, "monthly");
    assert.equal(
      b.ledger[0].periodMonth,
      undefined,
      "An itemized cost is not the total of the entire farm",
    );
    assert.equal(b.records.length, 0);
    const reference = await turn(f, "save-that", "Registre essa despesa", [
      { role: "user", content: text },
      { role: "assistant", content: saved!.reply! },
      { role: "user", content: audio("Exatamente.") },
    ]);
    assert.match(reference!.reply!, /já está salvo/);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
    await turn(f, "explicit-other-farm", "Registre essa despesa", [
      {
        role: "user",
        content: "A fazenda Santa Rita tem cinco mil de despesas todos os meses com cana",
      },
    ]);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
  } finally {
    await f.db.close();
  }
});

test("register-that uses producer history, never an assistant-invented amount or another farm's conversation", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const history: ChatMessage[] = [
      {
        role: "user",
        content: "Minha fazenda tem cinco mil de despesas todos os meses com cana de açúcar",
      },
      { role: "assistant", content: "Entendi, R$ 9000 por mês." },
      { role: "user", content: "Exatamente" },
    ];
    const result = await turn(f, "reference", "Registre essa despesa", history);
    assert.equal(result!.persisted, true, result!.reply ?? "");
    assert.equal((await f.guardian.load(phone)).active!.book.ledger[0].amountCents, 500000);
    await turn(f, "other-farm-reference", "Registre essa despesa", [
      ...history,
      { role: "assistant", content: "Fazenda selecionada: Santa Rita." },
    ]);
    await turn(f, "assistant-only", "Registre essa despesa", [
      { role: "assistant", content: "R$ 9000 com combustível" },
    ]);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 1);
  } finally {
    await f.db.close();
  }
});

test("financial and field corrections update the chosen record with history instead of adding another row", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await turn(f, "expense", "Hoje paguei R$ 500 com cana");
    await turn(f, "field", "Hoje consertei a cerca");
    const money = await turn(f, "edit-money", "Corrija a última despesa para 600 reais");
    assert.equal(money!.persisted, true, money!.reply ?? "");
    const note = await turn(f, "edit-note", "Altere a última anotação para o lote 2, foi ontem");
    assert.equal(note!.persisted, true, note!.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.ledger.length, 1);
    assert.equal(b.records.length, 1);
    assert.equal(b.ledger[0].amountCents, 60000);
    assert.equal(b.ledger[0].revisions![0].before.amountCents, 50000);
    assert.equal(b.ledger[0].source.messageId, "expense");
    assert.equal(b.records[0].date, "2026-10-26");
    assert.equal(b.records[0].lot, "2");
    assert.equal(b.records[0].revisions![0].before.date, "2026-10-27");
    FarmBookSchema.parse(b);
  } finally {
    await f.db.close();
  }
});

test("missing edit details and ambiguous animal references survive separate messages without selecting arbitrary animals", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    const q = await turn(f, "ambiguous", "Coloque os bezerros no lote 2");
    assert.match(q!.reply!, /Quais animais/);
    assert.ok((await f.guardian.load(phone)).active!.book.animals.every((a) => !a.lot));
    const completed = await turn(f, "which", "os dois últimos cadastrados");
    assert.equal(completed!.persisted, true, completed!.reply ?? "");
    const other = await turn(f, "missing-lot", "Mude o último animal de lote");
    assert.match(other!.reply!, /Para qual lote.*b02/);
    const moved = await turn(f, "lot", "no lote 3");
    assert.equal(moved!.persisted, true, moved!.reply ?? "");
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.animals[0].lot, "2");
    assert.equal(b.animals[1].lot, "3");
  } finally {
    await f.db.close();
  }
});

test("edits enforce permissions, explicit farm scope, inactive animals and atomic batches", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    await turn(f, "wrong-scope", "Na fazenda Santa Rita coloque os dois últimos animais no lote 2");
    assert.ok((await f.guardian.load(phone)).active!.book.animals.every((a) => !a.lot));
    const s = await f.guardian.load(phone);
    await f.db.query(
      "update guardian_properties set book=jsonb_set(book, '{animals,1,status}', '\"dead\"') where id=$1",
      [s.active!.id],
    );
    const failed = await turn(f, "inactive", "Coloque os dois últimos animais no lote 2");
    assert.equal(failed!.persisted, false);
    assert.ok((await f.guardian.load(phone)).active!.book.animals.every((a) => !a.lot));
    await turn(f, "finance", "Paguei R$ 500 com cana hoje");
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    const denied = await turn(f, "employee-edit", "Corrija a última despesa para 900 reais");
    assert.equal(denied!.persisted, undefined);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger[0].amountCents, 50000);
    await turn(f, "field", "Hoje consertei a cerca");
    const allowed = await turn(f, "worker-note", "Corrija a última anotação para o lote 3");
    assert.equal(allowed!.persisted, true, allowed!.reply ?? "");
  } finally {
    await f.db.close();
  }
});

test("panel HTTP sees WhatsApp lot edits and supports audited record corrections with existing SQL permissions", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    const s = await f.guardian.load(phone),
      session = "a".repeat(64),
      code = "ABCD2345EFGH6789";
    await f.issue(phone, s.active!.id, "code", hashToken(code));
    assert.equal(await f.store.exchange(hashToken(code), hashToken(session)), true);
    await turn(f, "move", "Coloque os dois últimos animais no lote 2");
    await turn(f, "finance", "Paguei R$ 500 com cana hoje");
    const get = () =>
      handleFarmPanel(
        new Request("https://farm.test/api/public/farm-panel", {
          headers: { cookie: `${PANEL_COOKIE}=${session}` },
        }),
        { store: f.store, enabled: true },
      );
    const data = await (await get()).json();
    assert.ok(data.book.animals.every((a: { lot: string }) => a.lot === "2"));
    const res = await handleFarmPanel(
      new Request("https://farm.test/api/public/farm-panel", {
        method: "POST",
        headers: {
          cookie: `${PANEL_COOKIE}=${session}`,
          origin: "https://farm.test",
          "content-type": "application/json",
          "x-tpec-panel": "1",
        },
        body: JSON.stringify({
          kind: "action",
          version: data.version,
          requestId: "00000000-0000-4000-8000-000000000099",
          action: {
            kind: "edit_record",
            section: "ledger",
            id: data.book.ledger[0].id,
            changes: { amountCents: 55000 },
          },
        }),
      }),
      { store: f.store, enabled: true },
    );
    assert.equal(res.status, 200, await res.text());
    const updated = await (await get()).json();
    assert.equal(updated.book.ledger[0].amountCents, 55000);
    assert.equal(updated.book.ledger[0].revisions[0].before.amountCents, 50000);
    assert.equal(JSON.stringify(updated).includes(phone), false);
  } finally {
    await f.db.close();
  }
});

test("lot numbers never select numeric animal codes, and unknown members prevent partial edits", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await calves(f);
    await turn(f, "numeric-codes", "código 2; código 3");
    const snapshot = await f.guardian.load(phone);
    for (const text of [
      "Coloque os bezerros no lote 2",
      "Coloque b01 e B99 no lote 2",
      "Coloque o animal B99 no lote 2",
    ])
      assert.deepEqual(managementDialogue({ text, phone, at: now }, snapshot)?.targets, [], text);
    assert.deepEqual(
      managementDialogue({ text: "Coloque o animal 3 no lote 2", phone, at: now }, snapshot)
        ?.targets,
      ["3"],
    );
    const result = await turn(f, "unknown-pair", "Coloque b01 e B99 no lote 2");
    assert.equal(result!.persisted, false);
    assert.ok((await f.guardian.load(phone)).active!.book.animals.every((a) => !a.lot));
  } finally {
    await f.db.close();
  }
});

test("missing financial correction details remain attached to the selected row and future dates do not write", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await turn(f, "expense", "Paguei R$ 500 com cana hoje");
    const q = await turn(f, "edit", "Corrija a última despesa");
    assert.match(q!.reply!, /O que devo corrigir/);
    const answered = await turn(f, "amount", "600 reais", [
      { role: "assistant", content: q!.reply! },
    ]);
    assert.equal(answered!.persisted, true, answered!.reply ?? "");
    const bad = await turn(f, "future", "Corrija a última despesa para o dia 30/10/2026");
    assert.equal(bad!.persisted, false);
    const b = (await f.guardian.load(phone)).active!.book;
    assert.equal(b.ledger.length, 1);
    assert.equal(b.ledger[0].amountCents, 60000);
    assert.equal(b.ledger[0].date, "2026-10-27");
  } finally {
    await f.db.close();
  }
});
