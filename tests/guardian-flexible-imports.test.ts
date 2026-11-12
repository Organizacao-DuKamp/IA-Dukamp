import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { animalActionFromForm } from "../src/lib/guardian/animal-profile.ts";
import {
  extractImportPages,
  isAnimalImportPdf,
  isAnimalImportSpreadsheet,
  parseImportTable,
  validatePageJson,
} from "../src/lib/guardian/import-extract.server.ts";
import { handleAnimalImportInbound } from "../src/lib/guardian/import-dialogue.server.ts";
import { fixturePdf } from "./helpers/abcz-certificate.ts";
import { swipePanelTab } from "../src/lib/guardian/panel-navigation.ts";
import { applyFarmAction, describeAction } from "../src/lib/guardian/book.ts";
import { ActionSchema, emptyFarm, FarmBookSchema } from "../src/lib/guardian/schema.ts";
import { FarmPhotoSchema } from "../src/lib/guardian/operations.ts";

const output = (animals: unknown[]) =>
  JSON.stringify({ complete: true, declaredCount: animals.length, animals, warnings: [] });
async function collect(bytes: Uint8Array, name: string, model = async () => output([]), start = 1) {
  const pages = [];
  for await (const page of extractImportPages(
    bytes,
    name,
    name.endsWith("pdf") ? "application/pdf" : "application/octet-stream",
    start,
    model,
  ))
    pages.push(page);
  return pages;
}
const spreadsheet = (rows: string[][], second?: string[][]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Animais");
  if (second) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(second), "Outro lote");
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
};
test("manual registration derives identity without asking for a duplicate code and preserves existing keys", () => {
  assert.equal(
    animalActionFromForm({ registrySeries: "dkn", rgn: "00404", name: "Estrela" }).code,
    "DKN 00404",
  );
  assert.equal(animalActionFromForm({ rgn: "DKN 404" }).code, "DKN 404");
  assert.equal(animalActionFromForm({ earTag: "A-12" }).code, "A-12");
  assert.equal(
    animalActionFromForm({ code: "local1", registrySeries: "DKN", rgn: "404" }).code,
    "local1",
  );
  assert.throws(() => animalActionFromForm({ name: "Sem identificação" }));
});
test("a combined PDF imports each ABCZ certificate instead of limiting the document to one animal", async () => {
  const source = await PDFDocument.load(fixturePdf()),
    doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage((await doc.copyPages(source, [0]))[0]);
  const bytes = await doc.save();
  const pages = await collect(bytes, "combinado.pdf", async () => {
    throw Error("certificate should be parsed locally");
  });
  assert.equal(pages.length, 3);
  assert.ok(pages.every((p) => p.profiles.length === 1 && !p.failed));
  assert.equal((await collect(bytes, "combinado.pdf", undefined, 2)).length, 2);
});
test("third-party PDFs route from content and keep multiple animals on each page, with source pages", async () => {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage();
    page.drawText(
      "Fazenda Exemplo - Relatorio de animais: brinco, nascimento, sexo. Lista de matrizes e dados de manejo de terceiros.",
      { x: 30, y: 700, font, size: 8 },
    );
  }
  const bytes = await doc.save();
  assert.equal(await isAnimalImportPdf(bytes), true);
  let calls = 0;
  const pages = await collect(bytes, "terceiros.pdf", async (a?: unknown) => {
    assert.ok(a);
    calls++;
    return output([{ registrySeries: "QA", rgn: String(calls * 2) }, { earTag: `B${calls}` }]);
  });
  assert.deepEqual(
    pages.map((p) => p.page),
    [1, 2],
  );
  assert.deepEqual(
    pages.map((p) => p.profiles.length),
    [2, 2],
  );
  assert.equal(pages[0].profiles[0].code, "QA 2");
  assert.equal(pages[0].profiles[1].code, "B1");
});
test("Excel accepts header aliases, two-column sheets and multiple tabs without model calls", async () => {
  const bytes = spreadsheet(
    [
      ["Série ABCZ", "RGN", "Nome do animal"],
      ["QA", "1", "Lua"],
      ["QA", "2", "Sol"],
    ],
    [
      ["Número do brinco", "Sexo"],
      ["003", "F"],
    ],
  );
  assert.equal(await isAnimalImportSpreadsheet(bytes), true);
  const pages = await collect(bytes, "animais.xlsx", async () => {
    throw Error("recognized headers should be parsed locally");
  });
  assert.deepEqual(
    pages.map((p) => p.profiles.map((a) => a.code)),
    [["QA 1", "QA 2"], ["003"]],
  );
  assert.equal(pages[1].profiles[0].sex, "female");
  assert.equal(
    parseImportTable([
      ["Brinco", "Peso (kg)"],
      ["A", "450,5"],
    ])?.[0].currentWeightKg,
    450.5,
  );
});
test("unfamiliar Excel layouts use model extraction and retain good tabs when another block fails", async () => {
  const bytes = spreadsheet(
    [["Controle individual fora do modelo"], ["Matriz número A21 nascida em 2024"]],
    [["Cadastro B"], ["Matriz A22"]],
  );
  let calls = 0;
  const pages = await collect(bytes, "terceiros.xlsx", async () => {
    if (++calls === 2) throw Error("provider timeout");
    return output([{ earTag: "A21", sex: "female" }]);
  });
  assert.equal(pages[0].profiles[0].code, "A21");
  assert.equal(pages[1].failed, true);
  assert.equal(pages[1].profiles.length, 0);
});
test("incomplete extraction blocks approval, and injected permissions never become farm actions", () => {
  const page = validatePageJson(
    JSON.stringify({
      complete: false,
      declaredCount: 4,
      animals: [{ earTag: "A1" }],
      warnings: [],
    }),
  );
  assert.equal(page.profiles[0].code, "A1");
  assert.equal(page.issues.length, 2);
  assert.throws(() => ActionSchema.parse({ kind: "animal", code: "A1", role: "owner" }));
});
test("WhatsApp gives a useful response after a failed import instead of swallowing the file", async () => {
  const result = await handleAnimalImportInbound(
    {
      phone: "5517000000001",
      messageId: "failure",
      text: "Cadastre este animal",
      media: {
        type: "document",
        id: "test",
        mimeType: "application/pdf",
        filename: "terceiro.pdf",
      },
    },
    {
      enabled: true,
      current: async () => {
        throw Error("storage unavailable");
      },
    },
  );
  assert.equal(result?.shouldSend, true);
  assert.match(result?.reply ?? "", /Nenhum novo cadastro está confirmado/);
});
test("swipes traverse the five main areas without hijacking vertical scroll or leaving bounds", () => {
  assert.equal(swipePanelTab("overview", -130, 20, 200), "herd");
  assert.equal(swipePanelTab("finance", -130, 10, 200), "more");
  assert.equal(swipePanelTab("team", 130, 10, 200), "finance");
  assert.equal(swipePanelTab("overview", 130, 0, 200), null);
  assert.equal(swipePanelTab("more", -130, 0, 200), null);
  assert.equal(swipePanelTab("tasks", -80, 90, 200), null);
  assert.equal(swipePanelTab("tasks", -130, 0, 2000), null);
});
test("farm photo uses the existing authorized and audited action without exposing the binary in its description", () => {
  const photo = "data:image/jpeg;base64,/9j/AA==";
  assert.ok(FarmPhotoSchema.safeParse(photo).success);
  for (const bad of [
    "data:image/svg+xml;base64,PHN2Zz4=",
    "https://example.org/picture.jpg",
    photo + "a".repeat(12000),
  ])
    assert.equal(FarmPhotoSchema.safeParse(bad).success, false);
  const book = emptyFarm("Teste", "Tanabi", "SP"),
    action = ActionSchema.parse({ kind: "property_update", photo });
  const source = {
    actor: "5517000000001",
    messageId: "photo",
    at: new Date().toISOString(),
    confirmed: true as const,
  };
  const changed = applyFarmAction(book, action, "owner", source, "photo").book;
  assert.equal(FarmBookSchema.parse(changed).photo, photo);
  assert.doesNotMatch(describeAction(action), /base64/);
  assert.throws(() => applyFarmAction(book, action, "worker", source, "denied"));
  assert.equal(
    applyFarmAction(changed, { kind: "property_update", photo: null }, "owner", source, "remove")
      .book.photo,
    null,
  );
});
