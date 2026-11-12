import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { activeReportPdf, reportItems } from "./helpers/abcz-active-report.ts";
import { abczReportMetadata, parseAbczReport } from "../src/lib/guardian/abcz-report.ts";
import {
  extractImportPages,
  isAnimalImportPdf,
} from "../src/lib/guardian/import-extract.server.ts";
import {
  handleAnimalImportInbound,
  animalImportIntent,
  type ImportInboundDependencies,
} from "../src/lib/guardian/import-dialogue.server.ts";
import { ImportProfileSchema } from "../src/lib/guardian/imports.ts";
import { emptyFarm, PreferencesSchema, type GuardianSnapshot } from "../src/lib/guardian/schema.ts";
import type { WhatsAppChatInput } from "../src/lib/whatsapp/types.ts";

const noModel = async () => {
  throw Error("digital reports must not call any model or web search");
};
test("rotated 13-page ABCZ report extracts every individual without AI, preserving original bytes", async () => {
  const bytes = await activeReportPdf();
  const original = bytes.slice();
  assert.equal(await isAnimalImportPdf(bytes), true);
  assert.deepEqual(bytes, original);
  const pages = [];
  for await (const page of extractImportPages(
    bytes,
    "RelatorioProdutosAtivos.pdf",
    "application/pdf",
    1,
    noModel,
  ))
    pages.push(page);
  assert.deepEqual(
    pages.map((p) => p.profiles.length),
    [25, ...Array(11).fill(34), 20],
  );
  assert.ok(pages.every((p) => !p.issues.length && !p.failed));
  const rows = pages.flatMap((p) => p.profiles);
  assert.equal(rows.length, 419);
  assert.equal(new Set(rows.map((p) => p.code)).size, 419);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.code, `TEST ${i + 1}`);
    assert.equal(row.name, `ANIMAL EXEMPLO ${i + 1}`);
    assert.equal(row.sex, i % 2 ? "male" : "female");
    assert.equal(row.birthDate, "2024-07-15");
    assert.equal(row.sire, "NEL/PO PAI 101");
    assert.equal(row.dam, "NEL/PO MAE 202");
    assert.equal(row.documentFarm, "FAZENDA DO DOCUMENTO");
    assert.equal(row.documentBreeder, "CRIADOR EXEMPLO");
    assert.equal(row.breed, "NELORE");
    assert.equal(row.category, "PURO DE ORIGEM");
    assert.equal(row.rgn, undefined); // RG does not distinguish RGN/RGD.
    assert.equal(row.rgd, undefined);
    assert.equal(row.earTag, undefined);
    assert.equal(row.currentWeightKg, undefined);
    assert.ok(ImportProfileSchema.safeParse(row).success);
  }
  assert.match(rows[0].notes!, /Receptora: RECEPTORA 1/);
  assert.doesNotMatch(rows[1].notes!, /Receptora/);
  assert.match(rows.at(-1)!.documentSource!, /página 13/);
  assert.deepEqual(bytes, original);
});
test("resuming at page 13 retains breed, category and provenance from page 1", async () => {
  const bytes = await activeReportPdf();
  const pages = [];
  for await (const page of extractImportPages(bytes, "report.pdf", "application/pdf", 13, noModel))
    pages.push(page);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].page, 13);
  assert.equal(pages[0].profiles.length, 20);
  assert.equal(pages[0].profiles[0].breed, "NELORE");
  assert.equal(pages[0].profiles[0].code, "TEST 400");
});
test("missing cells retain their columns and block approval; unknown geometry falls back", () => {
  const items = reportItems(2).filter((i) => !(i.text === "F" || i.text === "202"));
  const result = parseAbczReport(items, 842, 595, abczReportMetadata(items))!;
  assert.equal(result.profiles.length, 2);
  assert.equal(result.profiles[0].sex, "unknown");
  assert.equal(result.profiles[0].birthDate, "2024-07-15");
  assert.ok(result.issues.length);
  assert.equal(
    parseAbczReport(
      items.map((i) => ({ ...i, x: i.x + 25 })),
      842,
      595,
    ),
    null,
  );
  assert.equal(parseAbczReport([], 842, 595), null);
});
test("non-animal and corrupted PDFs never auto-create an animal list", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Relatorio de vendas e pagamentos", { x: 50, y: 700, font });
  assert.equal(await isAnimalImportPdf(await pdf.save()), false);
  assert.equal(await isAnimalImportPdf(new TextEncoder().encode("%PDF-corrupt")), false);
  assert.equal(await isAnimalImportPdf(new Uint8Array(25 * 1024 * 1024 + 1)), false);
});
test("natural registration accepts noun-before-verb and transcribed speech", () => {
  for (const text of [
    "Eu vou te mandar um relatório com todos os dados dos gados e quero que você registre eles um por um",
    "Esses são os animais da fazenda. Registre todos",
    "Cadastre todos os gados desse PDF",
    "Importa os registros da ABCZ",
  ])
    assert.equal(animalImportIntent(text), true, text);
  for (const text of [
    "Registre uma despesa de ração",
    "Criar fazenda Santa Helena",
    "O tempo está bom",
  ])
    assert.equal(animalImportIntent(text), false, text);
});
const phone = "5517999900001";
const farmId = "00000000-0000-4000-8000-000000000101";
const snapshot = (): GuardianSnapshot => ({
  accountVersion: 0,
  preferences: PreferencesSchema.parse({}),
  pending: null,
  properties: [],
  active: {
    id: farmId,
    version: 1,
    role: "owner",
    book: emptyFarm("DESTINO AUTORIZADO", "Tanabi", "SP"),
  },
});
const message = (): WhatsAppChatInput => ({
  phone,
  messageId: "report-message",
  text: "Documento recebido",
  media: {
    id: "report-media",
    type: "document",
    filename: "RelatorioProdutosAtivos_2026-11-06.pdf",
    mimeType: "application/pdf",
  },
});
function dependencies(bytes: Uint8Array) {
  const enqueued: Array<Parameters<NonNullable<ImportInboundDependencies["enqueue"]>>[0]> = [];
  let downloads = 0;
  const deps: ImportInboundDependencies = {
    enabled: true,
    current: async () => null,
    store: { load: async () => snapshot() },
    download: async () => {
      downloads++;
      return {
        bytes: Uint8Array.from(bytes).buffer,
        filename: "RelatorioProdutosAtivos_2026-11-06.pdf",
        mimeType: "application/pdf",
      };
    },
    enqueue: async (input) => {
      enqueued.push(input);
      return "prepared-batch";
    },
  };
  return { deps, enqueued, downloads: () => downloads };
}
test("captionless generic filename is inspected and routed into one persistent import, never a summary", async () => {
  const bytes = await activeReportPdf([2]);
  const f = dependencies(bytes);
  const result = await handleAnimalImportInbound(message(), f.deps);
  assert.equal(result?.shouldSend, true);
  assert.match(result?.reply ?? "", /Arquivo recebido.*importação/);
  assert.equal(f.downloads(), 1);
  assert.equal(f.enqueued.length, 2); // preparation, then attachment; no animal commit.
  assert.equal(f.enqueued[1].propertyId, farmId);
  assert.deepEqual(f.enqueued[1].bytes, bytes);
});
test("instruction persists before file arrival, with destination coming from authorization", async () => {
  const f = dependencies(new Uint8Array());
  const text = "Vou mandar os dados dos gados. Quero que você registre um por um";
  const result = await handleAnimalImportInbound({ phone, messageId: "speech", text }, f.deps);
  assert.match(result!.reply!, /lista.*conferir antes de cadastrar/);
  assert.equal(f.enqueued[0].instruction, text);
  assert.equal(f.enqueued[0].propertyId, farmId);
  assert.equal(f.downloads(), 0);
});
test("recognized report cannot select its printed farm, create access or register animals", async () => {
  const f = dependencies(await activeReportPdf([1]));
  f.deps.store = { load: async () => ({ ...snapshot(), active: null }) };
  const missing = await handleAnimalImportInbound(message(), f.deps);
  assert.match(missing!.reply!, /selecione ou cadastre a fazenda/);
  assert.equal(f.enqueued.length, 0);
  f.deps.store = {
    load: async () => ({ ...snapshot(), active: { ...snapshot().active!, role: "worker" } }),
  };
  assert.match(
    (await handleAnimalImportInbound(message(), f.deps))!.reply!,
    /não permite importar/,
  );
  assert.equal(f.enqueued.length, 0);
});
test("unrelated PDF continues normal analysis without import writes", async () => {
  const f = dependencies(new TextEncoder().encode("%PDF-invalid"));
  assert.equal(await handleAnimalImportInbound(message(), f.deps), null);
  assert.equal(f.enqueued.length, 0);
});

test("legacy webhook shares the claimed pipeline and a redelivery cannot process the report twice", async () => {
  const { dispatchWhatsAppChat } = await import("../src/lib/whatsapp/backend.server.ts");
  const { completeWhatsAppInboundMessage } =
    await import("../src/lib/whatsapp/conversation.server.ts");
  const saved = {
    guardian: process.env.TPEC_GUARDIAN_ENABLED,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    mode: process.env.WHATSAPP_STATE_STORE,
  };
  try {
    process.env.TPEC_GUARDIAN_ENABLED = "true";
    process.env.WHATSAPP_STATE_STORE = "memory";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    let calls = 0;
    const input = { ...message(), messageId: "legacy-report-once" };
    const deps = {
      processClaimedLocal: async (received: WhatsAppChatInput) => {
        calls++;
        assert.equal(received.media!.id, input.media!.id);
        await completeWhatsAppInboundMessage(input.messageId, "Lista pronta para conferir");
        return { shouldSend: true, duplicate: false, reply: "Lista pronta para conferir" };
      },
    };
    assert.equal((await dispatchWhatsAppChat(input, deps)).duplicate, false);
    assert.equal((await dispatchWhatsAppChat(input, deps)).duplicate, true);
    assert.equal(calls, 1);
  } finally {
    for (const [key, value] of Object.entries({
      TPEC_GUARDIAN_ENABLED: saved.guardian,
      SUPABASE_SERVICE_ROLE_KEY: saved.key,
      WHATSAPP_STATE_STORE: saved.mode,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
