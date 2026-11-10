import assert from "node:assert/strict";
import test from "node:test";
import {
  canExecuteWithoutSemanticAI,
  explainPreviousFarmFailure,
  farmSelectionRequest,
  isFreshActionAfterErrorQuestion,
} from "../src/lib/guardian/conversation-fastpath.ts";
import { emptyFarm, PreferencesSchema, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";

const phone = "5517999900001";
const date = new Date("2026-11-10T17:20:00.000Z");

const snapshot = (): GuardianSnapshot => ({
  accountVersion: 1,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  properties: [{ id: "farm", name: "Eduardo", role: "owner" }],
  active: {
    id: "farm",
    version: 1,
    role: "owner",
    book: emptyFarm("Eduardo", "Monte Aprazível", "SP"),
  },
});

test("producer can select a farm naturally without model interpretation", () => {
  assert.deepEqual(farmSelectionRequest("Selecionar fazenda"), { kind: "choose" });
  assert.deepEqual(farmSelectionRequest("Usar a fazenda Eduardo"), {
    kind: "named",
    name: "eduardo",
  });
  assert.deepEqual(farmSelectionRequest("Trocar para fazenda Tambori"), {
    kind: "named",
    name: "tambori",
  });
  assert.equal(farmSelectionRequest("Como selecionar uma fazenda?"), null);
  assert.equal(farmSelectionRequest("Mover dois animais para a fazenda Tambori"), null);
  assert.equal(
    farmSelectionRequest("Selecione a fazenda Eduardo. Hoje comprei 4 bois."),
    null,
  );
  assert.equal(
    farmSelectionRequest("Selecione a fazenda Eduardo e adicione gados."),
    null,
  );
});

test("direct execution accepts only literal, complete financial and herd events", () => {
  const s = snapshot();
  for (const text of [
    "Hoje nasceram 2 bezerros",
    "A minha fazenda teve receita de 100 mil e despesa de 80 mil neste mes",
    "Gasto 20000 R$ com combustivel todo mes",
  ]) {
    assert.equal(canExecuteWithoutSemanticAI({ text, at: date }, s), true, text);
  }
  for (const text of [
    "Se nascerem 2 bezerros, quanto terei?",
    "Previsao de despesa de 20 mil todo mes com combustivel",
    "Qual foi o custo de ração?",
    "Por que deu problema?",
  ]) {
    assert.equal(canExecuteWithoutSemanticAI({ text, at: date }, s), false, text);
  }
  s.pending = {
    kind: "semantic_draft",
    createdAt: date.toISOString(),
    expiresAt: "2026-11-11T17:20:00.000Z",
    propertyId: "farm",
    sourceMessageId: "pending",
    sourceAt: date.toISOString(),
    messages: [],
    question: "Confirma a correção anterior?",
  };
  assert.equal(
    canExecuteWithoutSemanticAI({ text: "Hoje nasceram 2 bezerros", at: date }, s),
    false,
  );
  assert.equal(
    isFreshActionAfterErrorQuestion({ text: "Hoje nasceram 2 bezerros", at: date }, s),
    false,
  );
  s.pending.question = "Qual problema você quer verificar? Diga em qual cadastro, tarefa ou informação ocorreu.";
  assert.equal(
    isFreshActionAfterErrorQuestion({ text: "Hoje nasceram 2 bezerros", at: date }, s),
    true,
  );
  assert.equal(
    isFreshActionAfterErrorQuestion({ text: "Confirmar", at: date }, s),
    false,
  );
});

test("previous failure can be explained without an extra semantic model call", () => {
  const history = [
    { role: "user" as const, content: "Registra 20000 de combustível na fazenda" },
    { role: "assistant" as const, content: "Opa, deu um problema aqui e não consegui concluir a resposta." },
  ];
  const reply = explainPreviousFarmFailure("Por que deu problema?", history);
  assert.match(reply ?? "", /falha técnica/);
  assert.match(reply ?? "", /não confirmou a gravação/);
  assert.equal(explainPreviousFarmFailure("Cria uma tarefa", history), null);
  assert.equal(
    explainPreviousFarmFailure("Por que deu problema?", [
      { role: "assistant", content: "Despesa registrada com sucesso." },
    ]),
    null,
  );
  const diverted = explainPreviousFarmFailure("O que aconteceu?", [
    { role: "user", content: "Nasceu 2 bezerros, registra isso" },
    { role: "assistant", content: "Posso registrar, preciso confirmar" },
    { role: "user", content: "Confirmar" },
    {
      role: "assistant",
      content: "Nenhuma linha desta seleção está pronta para cadastrar. Confira as pendências no painel.",
    },
  ]);
  assert.match(diverted ?? "", /importação/);
  assert.match(diverted ?? "", /não tenho recibo/i);
});

test("integration: selecting the only authorized farm succeeds without LLM or new farm", async () => {
  const f = await farmIntegration();
  try {
    const initial = await f.guardian.load(phone);
    const id = "00000000-0000-4000-8000-000000000021";
    assert.equal(
      await f.guardian.commit({
        phone,
        messageId: "create-p2",
        accountVersion: initial.accountVersion,
        propertyId: id,
        propertyVersion: null,
        operation: "create",
        book: emptyFarm("Eduardo", "Monte Aprazível", "SP"),
        pending: null,
        reply: "Fazenda criada",
      }),
      "committed",
    );
    const before = await f.guardian.load(phone);
    const result = await handleGuardianMessage(
      { phone, messageId: "select-p2", text: "Selecionar fazenda" },
      { store: f.guardian, now: date },
    );
    assert.match(result?.reply ?? "", /já está selecionada/i);
    const after = await f.guardian.load(phone);
    assert.equal(after.active?.id, id);
    assert.equal(after.properties.length, before.properties.length);
  } finally {
    await f.db.close();
  }
});
