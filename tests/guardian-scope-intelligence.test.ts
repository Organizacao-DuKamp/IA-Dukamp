import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyFarm,
  PreferencesSchema,
  type GuardianAction,
  type GuardianSnapshot,
} from "../src/lib/guardian/schema.ts";
import { resolveProperty } from "../src/lib/guardian/property-scope.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import {
  semanticContext,
  ProviderPlanSchema,
  type SemanticInterpreter,
} from "../src/lib/guardian/semantic.server.ts";
import { applyFarmAction, farmReport } from "../src/lib/guardian/book.ts";
import { stockAt } from "../src/lib/guardian/operations.ts";
import { farmCsv } from "../src/lib/guardian/export.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
const phone = "000000000000376",
  now = new Date("2026-10-29T17:00:00Z");
const state = (): GuardianSnapshot => ({
  accountVersion: 0,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  active: null,
  properties: [
    { id: "a", name: "Eduardo", role: "owner" },
    { id: "b", name: "Tambori", role: "owner" },
  ],
});
const mixed: GuardianAction = {
  kind: "herd_inventory",
  date: "2026-10-29",
  complete: true,
  groups: [
    {
      name: "Gado PO",
      count: 20,
      species: "cattle",
      description: "Registro declarado; identificadores serão informados depois.",
    },
    {
      name: "Gado comum",
      count: 40,
      species: "cattle",
      description: "Não PO; registro declarado, sem identificadores por enquanto.",
    },
    {
      name: "Vacas solteiras",
      count: 20,
      species: "cattle",
      description: "Adicionais aos grupos anteriores.",
    },
    {
      name: "Bois Nelore",
      count: 20,
      species: "cattle",
      description: "Adicionais aos grupos anteriores.",
    },
    { name: "Porcos", count: 40, species: "pig", description: "Animais já existentes." },
    { name: "Galinhas", count: 2, species: "poultry", description: "Animais já existentes." },
  ],
};
const census =
  "Registre na fazenda Tamburi meus animais existentes: 20 gados PO, 40 comuns sem ser PO, além desses 20 vacas solteiras e 20 bois Nelore, e também 40 porcos e 2 galinhas. Não vou informar os registros individuais agora.";
const source = { actor: phone, messageId: "census", at: now.toISOString(), confirmed: true };
async function farms() {
  const f = await farmIntegration();
  for (const name of ["Tambori", "Eduardo"]) {
    const s = await f.guardian.load(phone);
    assert.equal(
      await f.guardian.commit({
        phone,
        messageId: "create-" + name,
        accountVersion: s.accountVersion,
        propertyId: randomUUID(),
        propertyVersion: null,
        operation: "create",
        book: emptyFarm(name, "Tanabi", "SP"),
        pending: null,
        reply: "Criada",
      }),
      "committed",
    );
  }
  return f;
}
function plan(
  c: Parameters<SemanticInterpreter>[0],
  intent: string,
  propertyId: string,
  action?: GuardianAction,
) {
  return {
    intent,
    propertyId,
    question: "",
    entries: action
      ? [
          {
            action,
            evidence: [
              {
                messageIndex: c.messages.findIndex(
                  (m) => m.role === "user" && m.content === census,
                ),
                quote: census,
              },
            ],
          },
        ]
      : [],
  };
}
test("canonical resolution tolerates speech errors only among authorized properties and asks about competing candidates", () => {
  for (const name of ["Tamburi", "Tamborim", "Fazenda Tambori", "Estância Tâmbori", "Tamobri"]) {
    const r = resolveProperty(name, state());
    assert.equal(r.status, "resolved", name);
    if (r.status === "resolved") assert.equal(r.property.name, "Tambori");
  }
  const s = state();
  s.properties.push({ id: "c", name: "Tambora", role: "owner" });
  assert.equal(resolveProperty("Tamburi", s).status, "ambiguous");
  assert.equal(resolveProperty("Tambori", s).status, "resolved");
  assert.equal(resolveProperty(randomUUID(), s).status, "missing");
  assert.equal(resolveProperty("Fazenda inacessível", s).status, "missing");
});
test("spoken selection changes the actual RPC selection and returns the canonical persisted name; replay is idempotent", async () => {
  const f = await farms();
  try {
    const before = await f.guardian.load(phone);
    assert.equal(before.active?.book.name, "Eduardo");
    const input = {
      phone,
      messageId: "select-spoken",
      text: "Tepeque, selecione a Fazenda Tamburi, por favor.",
      mediaType: "audio",
    };
    const interpret: SemanticInterpreter = async (c) => plan(c, "select", "Tamburi");
    const result = await handleGuardianMessage(input, { store: f.guardian, now, interpret });
    assert.equal((await f.guardian.load(phone)).active?.book.name, "Tambori");
    assert.equal(result?.reply, "Fazenda selecionada: Tambori.");
    const after = await f.guardian.load(phone);
    assert.equal(
      (await handleGuardianMessage(input, { store: f.guardian, now, interpret }))?.reply,
      result?.reply,
    );
    assert.equal((await f.guardian.load(phone)).accountVersion, after.accountVersion);
  } finally {
    await f.db.close();
  }
});
test("one combined order reloads the target before applying all species and never changes the previous farm", async () => {
  const f = await farms();
  try {
    const before = await f.guardian.load(phone),
      prior = before.active!.book,
      seen: string[] = [];
    const interpret: SemanticInterpreter = async (c) => {
      seen.push(c.snapshot.active!.book.name!);
      return plan(c, "apply", "Tamburi", mixed);
    };
    const input = { phone, messageId: "combined-order", text: census, mediaType: "audio" };
    const result = await handleGuardianMessage(input, { store: f.guardian, now, interpret });
    assert.deepEqual(seen, ["Eduardo", "Tambori"]);
    assert.match(result!.reply!, /Salvo no painel de Tambori/);
    const saved = await f.guardian.load(phone),
      b = saved.active!.book;
    for (const [species, count] of [
      ["cattle", 100],
      ["pig", 40],
      ["poultry", 2],
    ] as const)
      assert.equal(stockAt(b.operations!, "2026-10-29", undefined, species).count, count);
    assert.equal(b.animals.length, 0);
    assert.equal(b.operations!.movements.length, 0);
    assert.equal(b.operations!.inventories!.length, 1);
    const old = await f.guardian.loadProperty!(phone, before.active!.id);
    assert.deepEqual(old!.book, prior);
    await handleGuardianMessage(input, { store: f.guardian, now, interpret });
    assert.equal((await f.guardian.load(phone)).active!.book.operations!.inventories!.length, 1);
    const audit = await f.db.query<{ property_id: string }>(
      "select property_id from guardian_audit where message_id=$1",
      [input.messageId],
    );
    assert.ok(audit.rows.length);
    assert.ok(audit.rows.every((r) => r.property_id === saved.active!.id));
    assert.match(farmCsv(b), /Suínos/);
    assert.match(farmReport(b, { kind: "query" }), /40/);
  } finally {
    await f.db.close();
  }
});
test("clarification retains the original facts across farm selection, so a natural answer can finish the order", async () => {
  const f = await farms();
  try {
    const target = (await f.guardian.load(phone)).properties.find((p) => p.name === "Tambori")!;
    await handleGuardianMessage(
      { phone, messageId: "need-scope", text: census },
      {
        store: f.guardian,
        now,
        interpret: async () => ({
          intent: "clarify",
          propertyId: null,
          question: "Qual fazenda?",
          entries: [],
        }),
      },
    );
    assert.equal((await f.guardian.load(phone)).pending?.kind, "semantic_draft");
    let calls = 0;
    const result = await handleGuardianMessage(
      { phone, messageId: "scope-answer", text: "É a Tamborim mesmo. Pode registrar." },
      {
        store: f.guardian,
        now,
        interpret: async (c) => {
          calls++;
          assert.ok(c.messages.some((m) => m.content === census));
          return plan(
            c,
            c.propertyId === target.id ? "apply" : "select",
            target.id,
            c.propertyId === target.id ? mixed : undefined,
          );
        },
      },
    );
    assert.equal(calls, 2);
    assert.match(result!.reply!, /Salvo no painel de Tambori/);
    const s = await f.guardian.load(phone);
    assert.equal(s.pending, null);
    assert.equal(stockAt(s.active!.book.operations!, "2026-10-29").count, 100);
    assert.equal(s.active!.book.operations!.inventories![0].source.messageId, "need-scope");
  } finally {
    await f.db.close();
  }
});
test("selection also works when properties exist without any active selection, and failed persistence cannot acknowledge selection", async () => {
  const f = await farms();
  try {
    await f.db.query("update guardian_accounts set active_property_id=null where phone_number=$1", [
      phone,
    ]);
    const result = await handleGuardianMessage(
      { phone, messageId: "no-active", text: "Vamos usar a Tamburi" },
      { store: f.guardian, now, interpret: async (c) => plan(c, "select", "Tamburi") },
    );
    assert.equal(result?.reply, "Fazenda selecionada: Tambori.");
    const s = await f.guardian.load(phone);
    assert.equal(s.active?.book.name, "Tambori");
    const broken = {
      ...f.guardian,
      commit: async () => {
        throw Error("unavailable");
      },
    };
    const failed = await handleGuardianMessage(
      { phone, messageId: "fail-select", text: "Selecione Eduardo" },
      { store: broken, now, interpret: async (c) => plan(c, "select", "Eduardo") },
    );
    assert.ok(!/Fazenda selecionada: Eduardo/.test(failed?.reply ?? ""));
    assert.equal((await f.guardian.load(phone)).active?.book.name, "Tambori");
  } finally {
    await f.db.close();
  }
});
test("species accounting keeps independent balances, preserves old cattle records and rejects cross-species negative stock", () => {
  let b = applyFarmAction(emptyFarm("Teste", "Tanabi", "SP"), mixed, "owner", source, "mixed").book;
  b = applyFarmAction(
    b,
    {
      kind: "herd_event",
      species: "pig",
      type: "birth",
      count: 5,
      date: "2026-10-30",
      description: "Leitões nascidos",
    },
    "owner",
    { ...source, at: "2026-10-30T17:00:00Z" },
    "pig-birth",
  ).book;
  assert.equal(stockAt(b.operations!, "2026-10-30").count, 100);
  assert.equal(stockAt(b.operations!, "2026-10-30", undefined, "pig").count, 45);
  assert.throws(
    () =>
      applyFarmAction(
        b,
        {
          kind: "herd_event",
          species: "poultry",
          type: "sale",
          count: 3,
          date: "2026-10-30",
          description: "Venda",
        },
        "owner",
        { ...source, at: "2026-10-30T17:00:00Z" },
        "bad-sale",
      ),
    /negativ|saldo/i,
  );
  const partial = { ...mixed, complete: false, groups: [mixed.groups[0]] };
  b = applyFarmAction(b, partial, "owner", source, "partial").book;
  assert.equal(stockAt(b.operations!, "2026-10-30").count, 100);
  const old = applyFarmAction(
    emptyFarm("Antiga", "Tanabi", "SP"),
    { kind: "herd_count", date: "2026-10-29", count: 90 },
    "owner",
    source,
    "legacy",
  ).book;
  assert.equal(stockAt(old.operations!, "2026-10-29").count, 90);
  const c = semanticContext(
    { phone, messageId: "context", text: "Quantos porcos?" },
    { ...state(), active: { id: "b", version: 1, role: "owner", book: b } },
    now,
  );
  assert.deepEqual(c.summary.stockBySpecies, { cattle: 100, pig: 40, poultry: 2 });
  assert.equal(
    ProviderPlanSchema.safeParse({
      intent: "apply",
      propertyId: "b",
      question: "",
      entries: [
        {
          action: { ...mixed, groups: [{ name: "Porcos", count: 40, description: "Suínos" }] },
          evidence: [{ messageIndex: 0, quote: "porcos" }],
        },
      ],
    }).success,
    false,
  );
});
test("a legacy guess about selection cannot fall through to a chatbot acknowledgement", async () => {
  const s = state();
  s.active = { id: "a", version: 1, role: "owner", book: emptyFarm("Eduardo", "Tanabi", "SP") };
  const r = await handleGuardianMessage(
    { phone, messageId: "legacy-guess", text: "Vamos ficar na Tamburim" },
    {
      store: {
        load: async () => s,
        receipt: async () => null,
        commit: async () => {
          throw Error("must not mutate");
        },
      },
      now,
      interpret: async () => ({ intent: "legacy", propertyId: null, question: "", entries: [] }),
    },
  );
  assert.match(r!.reply!, /Não executei nenhuma seleção/);
  assert.equal(r!.conversational, undefined);
});
