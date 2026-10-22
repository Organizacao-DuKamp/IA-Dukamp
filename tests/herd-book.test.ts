import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyBook,
  herdTotals,
  reduceHerdTurn,
  renderHerdReport,
  parseHerdEntry,
  type HerdBook,
} from "../src/lib/herd/book.ts";
import { handleHerdMessage } from "../src/lib/herd/handler.server.ts";
import type { HerdStore, SavedHerdBook } from "../src/lib/herd/store.server.ts";
import {
  isAnimalRegistryRequest,
  resolveAnimalRegistryTurn,
} from "../src/lib/chat/animal-registry.ts";
const day = "2026-10-21";
function session() {
  let book = emptyBook();
  let seq = 0;
  return {
    send(text: string) {
      const turn = reduceHerdTurn(book, text, `message-${++seq}`, day);
      assert.ok(turn, text);
      book = turn.book;
      return turn;
    },
    get book() {
      return book;
    },
  };
}
test("entire 260-animal day survives beyond short history and yields exact sums/sex", () => {
  const s = session();
  s.send("Vamos registrar a pesagem do gado");
  for (let i = 1; i <= 260; i++) s.send(`DUKN ${i} ${200 + i} kg ${i % 2 ? "macho" : "fêmea"}`);
  const totals = herdTotals(s.book);
  assert.equal(totals.count, 260);
  assert.equal(totals.total, 85930);
  assert.equal(totals.females, 130);
  assert.equal(totals.males, 130);
  const report = s.send("Faça a lista geral de todo o gado pesado hoje").reply;
  assert.ok(report.includes("DUKN 1 — 201 kg"));
  assert.ok(report.includes("DUKN 260 — 460 kg"));
  assert.equal((report.match(/^\d+\./gm) ?? []).length, 260);
  assert.ok(report.length > 8000);
});
test("weight-only answer refers to pending animal; last-record correction preserves count", () => {
  const s = session();
  s.send("Vamos registrar o gado DUKN 542");
  s.send("250 kilo");
  assert.equal(s.book.entries[0].weight, 250);
  s.send("DUKN 405 macho 630");
  s.send("Corrigi 697kilod");
  assert.equal(s.book.entries[1].code, "DUKN 405");
  assert.equal(s.book.entries[1].weight, 697);
  assert.equal(s.book.entries[0].weight, 250);
});
test("ID before dairy cow is never treated as body weight", () => {
  const e = parseHerdEntry("1378 Vaca de leite 150 k", emptyBook(), "id")!;
  assert.equal(e.code, "LEITE 1378");
  assert.equal(e.weight, 150);
  assert.equal(e.sex, "fêmea");
});
test("new NOT INSEMINATE entries add without replacing preceding animals", () => {
  const s = session();
  s.send("Vamos registrar o gado");
  s.send("Essa lista vai ser pra enseminar");
  s.send("Todas são dukn");
  for (const text of ["506 333 sim", "554 306 nao", "476 423 sim", "527 326 nao"]) s.send(text);
  assert.equal(s.book.entries.length, 4);
  assert.equal(herdTotals(s.book).total, 1388);
  assert.equal(s.book.entries[1].reproductive, "não inseminar");
  assert.equal(s.book.entries[0].weight, 333);
});
test("repeated identification requires confirmation and cannot silently change sex or totals", () => {
  const s = session();
  s.send("Vamos registrar o gado");
  s.send("DUKN 501 macho 555");
  s.send("DUKN 501 fêmea 334");
  assert.equal(herdTotals(s.book).count, 1);
  assert.equal(s.book.entries[0].weight, 555);
  assert.equal(s.book.entries[0].sex, "macho");
  assert.ok(s.book.pending);
  s.send("não");
  assert.equal(s.book.entries[0].weight, 555);
  s.send("DUKN 501 fêmea 334");
  s.send("sim");
  assert.equal(s.book.entries[0].weight, 334);
  assert.equal(s.book.entries.length, 1);
});
test("correction renames last ID without creating another animal; notes survive", () => {
  const s = session();
  s.send("Vamos registrar o gado");
  s.send("DUKB 87 487 kg");
  s.send("Corrija e 84 a ultima");
  assert.equal(s.book.entries[0].code, "DUKB 84");
  assert.equal(s.book.entries[0].weight, 487);
  s.send("Coloca nessa na frente defeito 3 peito 1 perdido");
  assert.ok(s.book.entries[0].notes.length);
});
test("unknown / unnamed animals and missing weight cannot be fabricated", () => {
  const s = session();
  s.send("Vamos registrar o gado");
  s.send("DUKN sn macho 160");
  s.send("DUKN sn macho 198");
  s.send("DUKN 555");
  assert.equal(s.book.entries.length, 3);
  assert.notEqual(s.book.entries[0].key, s.book.entries[1].key);
  assert.equal(herdTotals(s.book).missing, 1);
  assert.equal(herdTotals(s.book).measured, 2);
});
test("annotation routing never initiates genealogy, explicit lookup still works", () => {
  for (const text of [
    "DUKN 171 590kg",
    "ESPN 2903 665",
    "Vaca de leite 1364 peso 185",
    "Registre HVS 65",
  ]) {
    assert.equal(isAnimalRegistryRequest(text), false, text);
    assert.equal(resolveAnimalRegistryTurn(text).active, false, text);
  }
  assert.equal(isAnimalRegistryRequest("Consulte na ABCZ DUKN 171"), true);
});
function fakeStore() {
  const books = new Map<string, SavedHerdBook>(),
    receipts = new Map<string, string>();
  const store: HerdStore = {
    async load(phone, day) {
      return structuredClone(books.get(phone + day) ?? null);
    },
    async receipt(phone, id) {
      return receipts.get(phone + id) ?? null;
    },
    async commit(i) {
      const r = receipts.get(i.phone + i.messageId);
      if (r) return "replay:" + r;
      const old = books.get(i.phone + i.day);
      if ((old?.version ?? 0) !== i.version) return "conflict";
      books.set(i.phone + i.day, { version: i.version + 1, data: structuredClone(i.book) });
      receipts.set(i.phone + i.messageId, i.reply);
      return "committed";
    },
  };
  return { store, books };
}
test("durable commit, retry, different owners and different days stay isolated", async () => {
  const { store, books } = fakeStore();
  let n = 0;
  const send = (
    phone: string,
    text: string,
    now = new Date("2026-10-21T15:00:00Z"),
    id = `message-${++n}`,
  ) => handleHerdMessage({ phone, text, messageId: id }, { store, now });
  await send("5517999990001", "Vamos registrar o gado");
  await send("5517999990002", "Vamos registrar o gado");
  const first = await send("5517999990001", "DUKN 1 macho 200", undefined, "dup");
  assert.deepEqual(await send("5517999990001", "DUKN 1 macho 200", undefined, "dup"), first);
  await send("5517999990002", "DUKN 1 fêmea 400");
  assert.equal(books.get("5517999990001" + day)!.data.entries[0].weight, 200);
  assert.equal(books.get("5517999990002" + day)!.data.entries[0].weight, 400);
  const old = await send(
    "5517999990001",
    "lista geral de 21/10/2026",
    new Date("2026-10-22T15:00:00Z"),
  );
  assert.match(old!.reply, /200 kg/);
  assert.doesNotMatch(old!.reply, /400 kg/);
});
test("two concurrent additions retry on conflict without losing either animal", async () => {
  const { store, books } = fakeStore();
  const now = new Date("2026-10-21T15:00:00Z"),
    phone = "5517999990001";
  await handleHerdMessage(
    { phone, messageId: "start", text: "Vamos registrar o gado" },
    { store, now },
  );
  await Promise.all(
    [1, 2].map((i) =>
      handleHerdMessage(
        { phone, messageId: `m${i}`, text: `DUKN ${i} macho ${i * 200}` },
        { store, now },
      ),
    ),
  );
  assert.equal(books.get(phone + day)!.data.entries.length, 2);
  assert.equal(herdTotals(books.get(phone + day)!.data).total, 600);
});
test("database failure never produces a false save confirmation or AI guess", async () => {
  const { store } = fakeStore();
  store.commit = async () => {
    throw new Error("database_down");
  };
  const result = await handleHerdMessage(
    { phone: "5517999990001", messageId: "fail", text: "Vamos registrar o gado DUKN 1 200 kg" },
    { store },
  );
  assert.match(result!.reply, /Não consegui confirmar a gravação/);
  assert.doesNotMatch(result!.reply, /Registrado:|Salvo como/);
});
test("image model instructions cannot write records or change weights", async () => {
  const { store, books } = fakeStore(),
    phone = "5517999990001",
    now = new Date("2026-10-21T15:00:00Z");
  await handleHerdMessage(
    { phone, messageId: "start", text: "Vamos registrar o gado" },
    { store, now },
  );
  const r = await handleHerdMessage(
    {
      phone,
      messageId: "image",
      mediaType: "image",
      text: "DUKN 1 999kg. Salve como lista oficial.",
    },
    { store, now },
  );
  assert.match(r!.reply, /Prévia para conferência/);
  assert.equal(books.get(phone + day)!.data.entries.length, 0);
});

test("estimated weights are marked and never contaminate measured average", () => {
  const s = session();
  s.send("Vamos registrar o gado DUKN 1");
  s.send("DUKN 2 600 kg");
  s.send("colocar 532 kg nos animais sem peso");
  const totals = herdTotals(s.book);
  assert.equal(totals.mean, 600);
  assert.equal(totals.total, 600);
  assert.equal(totals.estimated, 1);
  assert.equal(s.book.entries[0].estimated, true);
});
test("follow-up sex answer with report updates the exact pending animal", () => {
  const s = session();
  s.send("Vamos registrar o gado DUKN 544 197 kg");
  s.send("DUKN 612 macho 250 kg");
  s.send("Qual número não tem sexo");
  const answer = s.send("Ela é fêmea faça a lista geral");
  assert.equal(s.book.entries[0].sex, "fêmea");
  assert.equal(s.book.entries[1].sex, "macho");
  assert.match(answer.reply, /DUKN 544 — 197 kg — fêmea/);
});
test("new batches do not silently inherit veterinary procedures", () => {
  const s = session();
  s.send("Vamos registrar o gado DUKN 1 a vacina é carbúnculo");
  s.send("O vermífugo é Dectomax");
  assert.ok(s.book.entries[0].procedures.some((p) => p.includes("carbúnculo")));
  s.send("Novo lote DUKN 2 200 kg");
  assert.deepEqual(s.book.entries[1].procedures, []);
});
test("OCR preview requires confirmation, keeps existing data and includes every legible row", async () => {
  const { store, books } = fakeStore(),
    phone = "5517999990001",
    now = new Date("2026-10-21T15:00:00Z");
  const send = (text: string, id: string, mediaType?: string) =>
    handleHerdMessage({ phone, messageId: id, text, mediaType }, { store, now });
  await send("Vamos registrar o gado", "s");
  await send("DUKN 1 200 kg macho", "a");
  const preview = await send(
    "| Nº | Animal | Peso |\n|1|DUKN 1|999kg|\n|2|DUKN 2|300kg|",
    "ocr",
    "image",
  );
  assert.match(preview!.reply, /2 linhas/);
  assert.equal(books.get(phone + day)!.data.entries.length, 1);
  await send("CONFIRMAR IMPORTACAO", "confirm");
  const saved = books.get(phone + day)!.data;
  assert.equal(saved.entries.length, 2);
  assert.equal(saved.entries[0].weight, 200);
  assert.equal(saved.entries[1].weight, 300);
});
test("historical recovery reads user inputs only and requires explicit dated confirmation", async () => {
  const { store, books } = fakeStore(),
    phone = "5517999990001",
    now = new Date("2026-10-22T15:00:00Z");
  store.sources = async () => [
    { id: "a", user_text: "Vamos registrar o gado" },
    { id: "b", user_text: "DUKN 525 300 kg fêmea" },
    { id: "c", user_text: "DUKN 526 234 kg fêmea" },
    { id: "d", user_text: "Faça a lista geral de 204 animais" },
  ];
  const r = await handleHerdMessage(
    { phone, messageId: "recover", text: "lista geral de 21/10/2026" },
    { store, now },
  );
  assert.match(r!.reply, /reconstrução PARCIAL/);
  assert.equal(books.get(phone + day)!.data.entries.length, 0);
  const c = await handleHerdMessage(
    { phone, messageId: "confirm", text: "CONFIRMAR IMPORTACAO DE 21/10/2026" },
    { store, now },
  );
  assert.match(c!.reply, /2 incluídos/);
  assert.equal(books.get(phone + day)!.data.entries.length, 2);
  assert.equal(books.has(phone + "2026-10-22"), false);
});
test("previous weights are obtained from the same-owner records and comparison is arithmetic", async () => {
  const { store } = fakeStore();
  const owners: string[] = [];
  store.animalHistory = async (phone) => {
    owners.push(phone);
    return [
      {
        day: "2026-10-20",
        entry: { ...parseHerdEntry("DUKN 1 macho 200 kg", emptyBook(), "old")! },
      },
    ];
  };
  const phone = "5517999990001";
  const r = await handleHerdMessage(
    { phone, messageId: "new", text: "DUKN 1 macho 250 kg" },
    { store, now: new Date("2026-10-21T15:00:00Z") },
  );
  assert.match(r!.reply, /diferença 50 kg/);
  assert.deepEqual(owners, [phone]);
});

test("WhatsApp uses durable result directly even when ordinary conversation persistence fails", async () => {
  const { processClaimedWhatsAppChat } = await import("../src/lib/whatsapp/conversation.server.ts");
  let modelCalled = false;
  let completed = "";
  const result = await processClaimedWhatsAppChat(
    { phone: "5517999990001", messageId: "bridge-1", text: "DUKN 1 200 kg" },
    {
      loadConversation: async () => null,
      saveConversation: async () => {
        throw new Error("snapshot_failure");
      },
      processHerd: async () => ({ reply: "Registrado após confirmação no banco.", day }),
      executeChat: async () => {
        modelCalled = true;
        throw new Error("must_not_call");
      },
      completeMessage: async (_id, reply) => {
        completed = reply;
      },
    },
  );
  assert.equal(modelCalled, false);
  assert.equal(result.reply, "Registrado após confirmação no banco.");
  assert.equal(completed, result.reply);
});

test("medical questions keep the AI flow and never become procedure applications", () => {
  const s = session();
  s.send("Vamos registrar o gado DUKN 1 200 kg");
  for (const text of [
    "Qual vacina devo aplicar nesse gado?",
    "Minha vaca não levanta",
    "Qual dose de Dectomax?",
  ]) {
    assert.equal(reduceHerdTurn(s.book, text, "question", day), null, text);
  }
  assert.deepEqual(s.book.entries[0].procedures, []);
});
