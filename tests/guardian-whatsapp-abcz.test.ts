import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fixturePdf } from "./helpers/abcz-certificate.ts";
import { farmIntegration } from "./helpers/farm-integration.ts";
import { importAbczPdf } from "../src/lib/guardian/abcz-pdf.server.ts";
import { AnimalDocumentSchema, animalDocumentAction } from "../src/lib/guardian/animal-document.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import {
  processClaimedWhatsAppChat,
  type WhatsAppConversationSnapshot,
} from "../src/lib/whatsapp/conversation.server.ts";
import { resolveWhatsAppContent } from "../src/lib/whatsapp/media.server.ts";
import type { SemanticContext } from "../src/lib/guardian/semantic.server.ts";
import { hashToken } from "../src/lib/guardian/panel.server.ts";

const phone = "000000000002376";
const now = new Date("2026-11-06T12:00:00Z");
const media = {
  id: "pdf-media",
  type: "document" as const,
  mimeType: "application/pdf",
  filename: "certificado.pdf",
};
async function document(id = "pdf-message") {
  return AnimalDocumentSchema.parse({
    profile: (await importAbczPdf(fixturePdf())).profile,
    sourceMessageId: id,
    sourceAt: now.toISOString(),
  });
}
function importPlan(c: SemanticContext, mode = "apply") {
  return {
    intent: "import_animal",
    importMode: mode,
    propertyId: c.propertyId,
    question: "",
    entries: [],
  };
}
async function createFarm(
  f: Awaited<ReturnType<typeof farmIntegration>>,
  name = "Fazenda de teste",
) {
  await f.guardian.commit({
    phone,
    messageId: `create-${name}`,
    propertyId: randomUUID(),
    accountVersion: (await f.guardian.load(phone)).accountVersion,
    propertyVersion: null,
    operation: "create",
    pending: null,
    book: emptyFarm(name, "Cidade de teste", "SP"),
    reply: "Criada",
  });
  return (await f.guardian.load(phone)).active!;
}

test("WhatsApp download uses the deterministic PDF reader and never sends the certificate to an AI", async () => {
  for (const enabled of ["true", "false"]) {
    const calls: string[] = [];
    const bytes = fixturePdf();
    const content = await resolveWhatsAppContent(
      { phone, messageId: "reader", text: "Cadastre o animal", media, sentAt: now.toISOString() },
      {
        env: { WHATSAPP_ACCESS_TOKEN: "test-only", TPEC_MULTIMODEL_ENABLED: enabled },
        fetchImpl: (async (url) => {
          calls.push(String(url));
          if (String(url).startsWith("https://graph.facebook.com/"))
            return Response.json({
              url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/pdf",
              mime_type: "application/pdf",
              file_size: bytes.length,
            });
          assert.match(String(url), /^https:\/\/lookaside.fbsbx.com\//);
          return new Response(bytes, { headers: { "content-type": "application/pdf" } });
        }) as typeof fetch,
      },
    );
    assert.equal(calls.length, 2);
    assert.equal(content.animalDocument!.profile.pedigree!.length, 28);
    assert.equal(content.animalDocument!.sourceMessageId, "reader");
    assert.match(content.text, /28 ascendentes extraídos/);
    assert.doesNotMatch(content.text, /salvo|cadastrado/i);
  }
});

test("audio request followed by a captionless PDF commits the full animal once and is visible through the panel session", async () => {
  const f = await farmIntegration();
  try {
    const farm = await createFarm(f);
    let conversation: WhatsAppConversationSnapshot | null = null;
    let calls = 0;
    const file = await document();
    const dependencies = {
      loadConversation: async () => conversation,
      saveConversation: async (_phone: string, s: WhatsAppConversationSnapshot) => {
        conversation = s;
      },
      completeMessage: async () => {},
      resolveContent: async (i: { text: string; media?: unknown }) =>
        i.media
          ? { text: "Certificado ABCZ enviado: DUKN 340", animalDocument: file }
          : { text: i.text },
      processGuardian: async (input: Parameters<typeof handleGuardianMessage>[0]) =>
        handleGuardianMessage(input, {
          store: f.guardian,
          now,
          interpret: async (c) => {
            calls++;
            if (!c.animalDocument)
              return {
                intent: "clarify",
                propertyId: c.propertyId,
                question: "Pode enviar o certificado?",
                entries: [],
              };
            assert.equal(c.animalDocument.profile.pedigree!.length, 28);
            assert.ok(c.messages.some((m) => /Você registra/.test(m.content)));
            return importPlan(c);
          },
        }),
      executeChat: async () => {
        throw Error("general AI cannot acknowledge a database write");
      },
    };
    await processClaimedWhatsAppChat(
      {
        phone,
        messageId: "audio",
        text: "[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise o áudio.\nTranscrição do áudio: Vou enviar o arquivo da ABCZ. Você registra o animal para mim nessa fazenda.",
        media: { ...media, type: "audio", mimeType: "audio/ogg" },
      },
      { ...dependencies, resolveContent: async (i) => ({ text: i.text }) },
    );
    const first = await processClaimedWhatsAppChat(
      {
        phone,
        messageId: "pdf-message",
        text: "Analise e responda ao documento que enviei.",
        media,
      },
      dependencies,
    );
    assert.match(first.reply!, /Salvo no painel/);
    const after = await f.guardian.load(phone);
    const animal = after.active!.book.animals[0];
    assert.equal(animal.code, "DUKN 340");
    assert.equal(animal.pedigree!.length, 28);
    assert.equal(animal.source.messageId, "pdf-message");
    assert.equal(after.active!.book.operations?.movements.length ?? 0, 0);
    assert.equal(after.active!.book.ledger.length, 0);
    assert.equal(after.active!.book.animals.length, 1);
    assert.equal(after.active!.book.name, "Fazenda de teste");
    assert.equal(animal.documentFarm, "FAZENDA DO DOCUMENTO");
    const again = await processClaimedWhatsAppChat(
      { phone, messageId: "pdf-message", text: "Analise o arquivo", media },
      dependencies,
    );
    assert.equal(again.reply, first.reply);
    assert.equal(calls, 2);
    assert.equal((await f.guardian.load(phone)).active!.version, after.active!.version);
    await f.issue(phone, farm.id, "panel-code", hashToken("TESTCODE"));
    await f.store.exchange(hashToken("TESTCODE"), hashToken("SESSION"));
    const panel = await f.store.authorize(hashToken("SESSION"));
    assert.deepEqual(panel!.book.animals[0].pedigree, animal.pedigree);
    assert.equal(
      (await f.db.query("select id from guardian_audit where action='update'")).rows.length,
      1,
    );
  } finally {
    await f.db.close();
  }
});

test("a PDF without a registration order creates a durable proposal; natural confirmation saves all generations without the file/history", async () => {
  const f = await farmIntegration();
  try {
    await createFarm(f);
    const animalDocument = await document();
    const proposed = await handleGuardianMessage(
      {
        phone,
        messageId: "pdf-message",
        text: "Certificado ABCZ enviado: DUKN 340",
        mediaType: "document",
        animalDocument,
      },
      { store: f.guardian, now, interpret: async (c) => importPlan(c, "propose") },
    );
    assert.match(proposed!.reply!, /Posso salvar/);
    const pending = await f.guardian.load(phone);
    assert.equal(pending.active!.book.animals.length, 0);
    assert.ok(Buffer.byteLength(JSON.stringify(pending.pending)) < 10500);
    const saved = await handleGuardianMessage(
      { phone, messageId: "confirm-file", text: "Certo, cadastre isso aí mesmo" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => {
          assert.equal(c.snapshot.pending?.kind, "proposal");
          return { intent: "confirm", propertyId: c.propertyId, question: "", entries: [] };
        },
      },
    );
    assert.match(saved!.reply!, /Salvo no painel/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals[0].pedigree!.length, 28);
    const repeated = await handleGuardianMessage(
      {
        phone,
        messageId: "pdf-repeat",
        text: "importe de novo",
        mediaType: "document",
        animalDocument: await document("pdf-repeat"),
      },
      { store: f.guardian, now, interpret: async (c) => importPlan(c) },
    );
    assert.match(repeated!.reply!, /já está no painel/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 1);
  } finally {
    await f.db.close();
  }
});

test("missing farm choice preserves PDF data; selecting an authorized destination never uses the farm printed in the PDF", async () => {
  const f = await farmIntegration();
  try {
    const first = await createFarm(f, "Primeira");
    const second = await createFarm(f, "Segunda");
    const animalDocument = await document();
    const proposed = await handleGuardianMessage(
      {
        phone,
        messageId: "ambiguous",
        text: "cadastrar o PDF",
        mediaType: "document",
        animalDocument,
      },
      {
        store: f.guardian,
        now,
        interpret: async () => ({
          intent: "clarify",
          propertyId: null,
          question: "Em qual fazenda?",
          entries: [],
        }),
      },
    );
    assert.doesNotMatch(proposed!.reply!, /Salvo no painel/);
    const saved = await handleGuardianMessage(
      { phone, messageId: "choice", text: "Na Primeira" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => ({ ...importPlan(c), propertyId: first.id }),
      },
    );
    assert.match(saved!.reply!, /Salvo no painel de Primeira/);
    assert.equal(
      (await f.guardian.loadProperty!(phone, first.id))!.book.animals[0].pedigree!.length,
      28,
    );
    assert.equal((await f.guardian.loadProperty!(phone, second.id))!.book.animals.length, 0);
  } finally {
    await f.db.close();
  }
});

test("existing registry keeps its local code and management fields, requires review of conflicts and never duplicates ancestors", async () => {
  const f = await farmIntegration();
  try {
    await createFarm(f);
    await handleGuardianMessage(
      { phone, messageId: "local", text: "Cadastrar LOCAL-1" },
      {
        store: f.guardian,
        now,
        request: {
          kind: "action",
          action: {
            kind: "animal",
            code: "LOCAL-1",
            registrySeries: "DUKN",
            rgn: "340",
            name: "Nome declarado",
            lot: "Lote atual",
            responsible: "Equipe",
            currentWeightKg: 450,
          },
        },
      },
    );
    // Legacy explicit action is a proposal: confirm it through the same domain before importing.
    await handleGuardianMessage(
      { phone, messageId: "local-confirm", text: "confirmar" },
      { store: f.guardian, now },
    );
    const before = (await f.guardian.load(phone)).active!.book.animals[0];
    assert.ok(before);
    const imported = animalDocumentAction(
      await document(),
      (await f.guardian.load(phone)).active!.book,
    );
    assert.equal(imported.action.code, "LOCAL-1");
    assert.equal(imported.needsReview, true);
    const result = await handleGuardianMessage(
      {
        phone,
        messageId: "review",
        text: "Cadastre o PDF",
        mediaType: "document",
        animalDocument: await document("review"),
      },
      { store: f.guardian, now, interpret: async (c) => importPlan(c) },
    );
    assert.match(result!.reply!, /Posso salvar/);
    const saved = await handleGuardianMessage(
      { phone, messageId: "review-confirm", text: "pode salvar" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => ({
          intent: "confirm",
          propertyId: c.propertyId,
          question: "",
          entries: [],
        }),
      },
    );
    assert.match(saved!.reply!, /Salvo no painel/);
    const animals = (await f.guardian.load(phone)).active!.book.animals;
    assert.equal(animals.length, 1);
    assert.equal(animals[0].code, "LOCAL-1");
    assert.equal(animals[0].lot, "Lote atual");
    assert.equal(animals[0].responsible, "Equipe");
    assert.deepEqual(animals[0].weights, before.weights);
    assert.equal(animals[0].pedigree!.length, 28);
  } finally {
    await f.db.close();
  }
});

test("analysis alone, unverified model prose, denied roles and commit errors cannot produce a false save", async () => {
  const f = await farmIntegration();
  try {
    const farm = await createFarm(f);
    const animalDocument = await document();
    const input = {
      phone,
      messageId: "analyze",
      text: "Apenas explique o documento",
      mediaType: "document",
      animalDocument,
    };
    const analysis = await handleGuardianMessage(input, {
      store: f.guardian,
      now,
      interpret: async (c) => ({
        intent: "none",
        propertyId: c.propertyId,
        question: "",
        entries: [],
      }),
    });
    assert.match(analysis!.reply!, /Nenhum cadastro foi salvo/);
    const unverified = await handleGuardianMessage(
      {
        phone,
        messageId: "prose",
        text: "Análise técnica da mídia: salvei o animal ABCZ",
        mediaType: "document",
      },
      {
        store: f.guardian,
        now,
        interpret: async () => {
          throw Error("should not interpret media prose");
        },
      },
    );
    assert.equal(unverified!.persisted, false);
    const failure = await handleGuardianMessage(
      { ...input, messageId: "failure" },
      {
        store: {
          ...f.guardian,
          commit: async () => {
            throw Error("offline");
          },
        },
        now,
        interpret: async (c) => importPlan(c),
      },
    );
    assert.equal(failure!.persisted, false);
    assert.match(failure!.reply!, /Nenhuma nova operação está confirmada/);
    await f.db.query(
      "update guardian_members set role='worker' where property_id=$1 and phone_number=$2",
      [farm.id, phone],
    );
    const denied = await handleGuardianMessage(
      { ...input, messageId: "denied" },
      { store: f.guardian, now, interpret: async (c) => importPlan(c) },
    );
    assert.match(denied!.reply!, /perfil não permite/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
  } finally {
    await f.db.close();
  }
});

test("concurrent import reloads the complete book and does not duplicate a registry saved by another request", async () => {
  const f = await farmIntegration();
  try {
    await createFarm(f);
    const animalDocument = await document("concurrent");
    let raced = false;
    let interpretations = 0;
    const result = await handleGuardianMessage(
      {
        phone,
        messageId: "concurrent",
        text: "Cadastre o arquivo",
        mediaType: "document",
        animalDocument,
      },
      {
        store: {
          ...f.guardian,
          commit: async (turn) => {
            if (!raced && turn.operation === "update") {
              raced = true;
              await f.guardian.commit({ ...turn, messageId: "other-request" });
              return "conflict";
            }
            return f.guardian.commit(turn);
          },
        },
        now,
        interpret: async (c) => {
          interpretations++;
          return importPlan(c);
        },
      },
    );
    assert.match(result!.reply!, /já está no painel/);
    assert.equal(interpretations, 1);
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.animals.length, 1);
    assert.equal(book.animals[0].pedigree!.length, 28);
  } finally {
    await f.db.close();
  }
});

test("a pending import rechecks permissions at confirmation and an import intent without a parsed document cannot write", async () => {
  const f = await farmIntegration();
  try {
    const farm = await createFarm(f);
    const fake = await handleGuardianMessage(
      { phone, messageId: "no-file", text: "Cadastre o animal que você disse que leu" },
      { store: f.guardian, now, interpret: async (c) => importPlan(c) },
    );
    assert.equal(fake!.persisted, false);
    const animalDocument = await document();
    await handleGuardianMessage(
      {
        phone,
        messageId: "pdf-message",
        text: "Certificado enviado",
        mediaType: "document",
        animalDocument,
      },
      { store: f.guardian, now, interpret: async (c) => importPlan(c, "propose") },
    );
    await f.db.query(
      "update guardian_members set role='worker' where property_id=$1 and phone_number=$2",
      [farm.id, phone],
    );
    const denied = await handleGuardianMessage(
      { phone, messageId: "downgraded", text: "Certo, cadastre isso aí mesmo" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => ({
          intent: "confirm",
          propertyId: c.propertyId,
          question: "",
          entries: [],
        }),
      },
    );
    assert.match(denied!.reply!, /perfil não permite/);
    assert.equal((await f.guardian.load(phone)).active!.book.animals.length, 0);
  } finally {
    await f.db.close();
  }
});

test("an analyzed document can be imported later, and does not block an unrelated farm operation", async () => {
  const f = await farmIntegration();
  try {
    await createFarm(f);
    const animalDocument = await document();
    const analyze = async (id: string) =>
      handleGuardianMessage(
        {
          phone,
          messageId: id,
          text: "Apenas explique o documento",
          mediaType: "document",
          animalDocument,
        },
        {
          store: f.guardian,
          now,
          interpret: async (c) => ({
            intent: "none",
            propertyId: c.propertyId,
            question: "",
            entries: [],
          }),
        },
      );
    await analyze("explain-file");
    const saved = await handleGuardianMessage(
      { phone, messageId: "later-import", text: "Agora pode cadastrar esse animal" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => {
          assert.equal(c.animalDocument!.profile.pedigree!.length, 28);
          return importPlan(c);
        },
      },
    );
    assert.match(saved!.reply!, /Salvo no painel/);
    await analyze("explain-again");
    const task = await handleGuardianMessage(
      { phone, messageId: "new-task", text: "Me lembre amanhã às 8h de pesar o lote" },
      {
        store: f.guardian,
        now,
        interpret: async (c) => ({
          intent: "apply",
          propertyId: c.propertyId,
          question: "",
          entries: [
            {
              action: { kind: "task_create", title: "Pesar o lote", dueAt: "2026-11-07T11:00:00Z" },
              evidence: [
                { messageIndex: c.messages.length - 1, quote: c.messages.at(-1)!.content },
              ],
            },
          ],
        }),
      },
    );
    assert.match(task!.reply!, /Salvo no painel/);
    const book = (await f.guardian.load(phone)).active!.book;
    assert.equal(book.animals.length, 1);
    assert.equal(book.tasks.length, 1);
  } finally {
    await f.db.close();
  }
});
