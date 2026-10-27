import assert from "node:assert/strict";
import test from "node:test";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { stockAt, farmIndicators } from "../src/lib/guardian/operations.ts";
import { processClaimedWhatsAppChat } from "../src/lib/whatsapp/conversation.server.ts";
import {
  extractAnimalRegistrations,
  resolveAnimalRegistryTurn,
} from "../src/lib/chat/animal-registry.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { moneyValue } from "../src/lib/guardian/record-dialogue.ts";

const phone = "5517999991111",
  now = new Date("2026-10-27T17:25:00Z");
const noAI = async () => {
  throw new Error("No search or extraction should be needed");
};
async function seed(f: Awaited<ReturnType<typeof farmIntegration>>) {
  await f.observe(
    phone,
    "baseline",
    "Minha fazenda fica em Tanabi e tenho 84 cabeças.",
    "2026-10-25T15:00:00Z",
  );
}
const send = (f: Awaited<ReturnType<typeof farmIntegration>>, messageId: string, text: string) =>
  handleGuardianMessage({ phone, messageId, text }, { store: f.guardian, now, extract: noAI });

test("a count of animals with identification never becomes a fictitious registry series", () => {
  const text = "Apenas 1 gado tem:\nDUKN 401";
  assert.deepEqual(
    extractAnimalRegistrations(text).map((r) => r.code),
    ["DUKN 401"],
  );
  assert.equal(resolveAnimalRegistryTurn(text).active, false);
  assert.equal(resolveAnimalRegistryTurn("Pesquise a raça do DUKN 401").active, true);
});

test("the exact purchase followup saves one identifier, respects that only one has it, then confirms the RGN in context", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "purchase", "Tpec, eu comprei novos 4 gados para o rebanho ok");
    const result = await send(f, "one", "Apenas 1 gado tem:\nDUKN 401");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    assert.match(result!.reply!, /outros 3 ficam sem identificação/);
    assert.doesNotMatch(result!.reply!, /ABCZ|fontes p[uú]blicas|Faltam identificar 4/);
    let s = await f.guardian.load(phone);
    assert.equal(s.active!.book.animals.length, 1);
    assert.equal(s.active!.book.animals[0].code, "DUKN 401");
    assert.equal(s.active!.book.animals[0].rgn, undefined);
    const yes = await send(f, "yes-rgn", "sim, é o mesmo");
    assert.equal(yes!.persisted, true, yes!.reply ?? "");
    await send(f, "yes-rgn", "sim, é o mesmo");
    s = await f.guardian.load(phone);
    assert.equal(s.active!.book.animals[0].rgn, "DUKN 401");
    assert.equal(s.pending, null);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 88);
    assert.equal(s.active!.book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("availability, bare identifiers and registry-only values are retained across short replies", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "buy", "Hoje comprei mais 4 vacas");
    const count = await send(f, "availability", "Só um possui identificação");
    assert.match(count!.reply!, /Qual é a identificação/);
    const bare = await send(f, "bare", "DUKN 402");
    assert.equal(bare!.persisted, true);
    await send(f, "no-rgn", "não");
    assert.equal((await f.guardian.load(phone)).pending, null);
    await send(f, "birth", "Hoje nasceram mais 2 bezerros");
    const registry = await send(f, "registry-only", "RGN: KBU 501");
    assert.match(registry!.reply!, /Qual é o código/);
    await send(f, "primary", "código B01");
    const s = await f.guardian.load(phone);
    assert.equal(s.active!.book.animals.find((a) => a.code === "B01")!.rgn, "KBU 501");
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-27").count, 90);
  } finally {
    await f.db.close();
  }
});

test("identity help and explicit public lookup do not overwrite a pending farm registration", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "buy", "Hoje comprei mais 4 vacas");
    const help = await send(f, "help", "O que é RGN?");
    assert.match(help!.reply!, /registro genealógico de nascimento/);
    const external = await send(f, "lookup", "Pesquise a raça do DUKN 401 na ABCZ");
    assert.equal(external!.reply, null);
    assert.equal((await f.guardian.load(phone)).pending!.kind, "herd_identification");
  } finally {
    await f.db.close();
  }
});

test("financial amounts use Brazilian currency without losing the pending object or date", async () => {
  assert.equal(moneyValue("foi 1.250,50 reais"), 125050);
  assert.equal(moneyValue("quinhentos"), 50000);
  const f = await farmIntegration();
  try {
    await seed(f);
    const q = await send(f, "feed-expense", "Paguei a ração");
    assert.match(q!.reply!, /Qual foi o valor da despesa/);
    const date = await send(f, "expense-date", "foi ontem");
    assert.match(date!.reply!, /Qual foi o valor/);
    const result = await send(f, "expense-value", "foi 1.250,50 reais");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    await send(f, "expense-value", "foi 1.250,50 reais");
    const s = await f.guardian.load(phone),
      row = s.active!.book.ledger[0];
    assert.equal(s.active!.book.ledger.length, 1);
    assert.equal(row.amountCents, 125050);
    assert.equal(row.direction, "expense");
    assert.equal(row.date, "2026-10-26");
    assert.match(row.description, /ra[cç][aã]o/i);
    assert.equal(row.source.messageId, "feed-expense");
    assert.equal(s.active!.book.records.length, 0);
    assert.equal(s.pending, null);
  } finally {
    await f.db.close();
  }
});

test("income without a description requests only that description and native complete transactions save in the ledger", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const q = await send(f, "income", "Recebi R$ 500 hoje");
    assert.match(q!.reply!, /refere esse lançamento/);
    const saved = await send(f, "income-description", "Foi com a venda de leite");
    assert.equal(saved!.persisted, true, saved!.reply ?? "");
    const second = await send(f, "expense", "Hoje paguei R$ 150 com adubo");
    assert.equal(second!.persisted, true, second!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.ledger.length, 2);
    assert.match(book.ledger[0].description, /venda de leite/);
    assert.match(book.ledger[1].description, /adubo/);
    assert.equal(farmIndicators(book, "2026-10-01", "2026-10-27").finances.balanceCents, 35000);
  } finally {
    await f.db.close();
  }
});

test("monthly revenue and expense reports keep both amounts when the next reply supplies the period", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const q = await send(f, "monthly", "Minha receita foi de 100 mil e minha despesa de 80 mil");
    assert.match(q!.reply!, /qual dia ou mês/);
    const result = await send(f, "period", "nesse mês");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.ledger.length, 2);
    assert.deepEqual(
      book.ledger.map((r) => [r.amountCents, r.periodMonth]),
      [
        [10000000, "2026-10"],
        [8000000, "2026-10"],
      ],
    );
    assert.equal(book.records.length, 0);
  } finally {
    await f.db.close();
  }
});

test("field notes retain the activity while the user supplies lot and day in either order", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const q = await send(f, "repair", "Consertei a cerca semana passada");
    assert.match(q!.reply!, /Em qual dia/);
    const lot = await send(f, "repair-lot", "no lote 3");
    assert.match(lot!.reply!, /Em qual dia/);
    const result = await send(f, "repair-day", "foi ontem");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.records.length, 1);
    assert.match(book.records[0].description, /Consertei a cerca/);
    assert.equal(book.records[0].lot, "3");
    assert.equal(book.records[0].date, "2026-10-26");
    assert.equal(book.records[0].source.messageId, "repair");
    assert.equal(book.ledger.length, 0);
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 84);
  } finally {
    await f.db.close();
  }
});

test("field note content can be supplied after the user names the notebook", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const q = await send(f, "notebook", "Registre no caderno de campo");
    assert.match(q!.reply!, /O que aconteceu/);
    const result = await send(f, "note", "A cerca do pasto 2 foi reparada");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    assert.match(
      (await f.guardian.load(phone)).active!.book.records[0].description,
      /cerca do pasto 2/,
    );
  } finally {
    await f.db.close();
  }
});

test("financial proposal corrections preserve amount and object until the user confirms the revised date", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "proposal", "Despesa R$ 150 com ração hoje");
    const correction = await send(f, "date-correction", "foi ontem");
    assert.match(correction!.reply!, /Atualizei a proposta/);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    await send(f, "confirm", "confirmar");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.ledger[0].amountCents, 15000);
    assert.equal(book.ledger[0].date, "2026-10-26");
    assert.match(book.ledger[0].description, /ração/);
  } finally {
    await f.db.close();
  }
});

test("the actual WhatsApp adapter handles natural identifier answers locally instead of searching external sources", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "buy", "Hoje comprei mais 4 vacas");
    const result = await processClaimedWhatsAppChat(
      { phone, messageId: "wa-id", text: "Apenas 1 gado tem:\nDUKN 401" },
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
    assert.match(result.reply!, /Salvei DUKN 401/);
    assert.doesNotMatch(result.reply!, /ABCZ|fontes p[uú]blicas/);
  } finally {
    await f.db.close();
  }
});

test("a new cattle purchase and its stated payment are saved together without losing either section", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const result = await send(f, "purchase-paid", "Hoje comprei 4 bois e paguei R$ 3000");
    assert.equal(result!.persisted, true, result!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(stockAt(book.operations!, "2026-10-27").count, 88);
    assert.equal(book.ledger.length, 1);
    assert.equal(book.ledger[0].amountCents, 300000);
    assert.equal(book.operations!.movements.length, 1);
  } finally {
    await f.db.close();
  }
});

test("financial and field drafts keep farm scope and do not grant financial write access to employees", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    const wrong = await send(f, "wrong-farm", "Na fazenda Santa Rita hoje paguei R$ 150 com ração");
    assert.equal(wrong!.persisted, false);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    await f.db.query("update guardian_members set role='worker' where phone_number=$1", [phone]);
    const denied = await send(f, "employee", "Paguei a ração");
    assert.equal(denied!.persisted, false);
    assert.match(denied!.reply!, /perfil não permite/);
    const note = await send(f, "employee-note", "Hoje consertei a cerca");
    assert.equal(note!.persisted, true, note!.reply ?? "");
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.records.length, 1);
    assert.equal(book.ledger.length, 0);
  } finally {
    await f.db.close();
  }
});

test("a yes/no after an unrelated question cannot silently confirm an older RGN or financial proposal", async () => {
  const f = await farmIntegration();
  const history = [
    { role: "user" as const, content: "Vai chover?" },
    { role: "assistant" as const, content: "Você quer a previsão para amanhã?" },
  ];
  try {
    await seed(f);
    await send(f, "buy", "Hoje comprei mais 4 vacas");
    await send(f, "one", "Apenas 1 gado tem:\nDUKN 401");
    const unrelated = await handleGuardianMessage(
      { phone, messageId: "weather-yes", text: "sim", history },
      { store: f.guardian, now, extract: noAI },
    );
    assert.equal(unrelated!.reply, null);
    assert.equal((await f.guardian.load(phone)).active!.book.animals[0].rgn, undefined);
    await send(f, "explicit-rgn", "O RGN é o mesmo");
    await send(f, "finance-proposal", "Despesa R$ 150 com ração hoje");
    await handleGuardianMessage(
      { phone, messageId: "weather-yes-again", text: "sim", history },
      { store: f.guardian, now, extract: noAI },
    );
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
  } finally {
    await f.db.close();
  }
});

test("an unrelated short numeric reply does not fill a financial amount asked before a topic change", async () => {
  const f = await farmIntegration();
  try {
    await seed(f);
    await send(f, "expense", "Paguei a ração");
    const result = await handleGuardianMessage(
      {
        phone,
        messageId: "weather-number",
        text: "150",
        history: [{ role: "assistant", content: "Quantos milímetros choveu ontem?" }],
      },
      { store: f.guardian, now, extract: noAI },
    );
    assert.equal(result!.persisted, false);
    assert.equal(result!.reply, null);
    assert.equal((await f.guardian.load(phone)).active!.book.ledger.length, 0);
    const resumed = await send(f, "amount-resume", "o valor foi 150 reais");
    assert.equal(resumed!.persisted, true, resumed!.reply ?? "");
  } finally {
    await f.db.close();
  }
});
