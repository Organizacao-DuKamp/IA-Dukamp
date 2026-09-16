import assert from "node:assert/strict";
import test from "node:test";
import { formatWhatsAppReply, splitWhatsAppReply } from "../src/lib/whatsapp/reply-format.ts";

test("research citations do not create a second WhatsApp message", () => {
  const answer = "Para Monte Aprazível, a previsão indica tempo seco.";
  const refs = Array.from(
    { length: 60 },
    (_, i) => `[Fonte ${i}](https://example.com/previsao/${i})`,
  ).join("");
  assert.deepEqual(splitWhatsAppReply(answer + refs + "\n\nFontes consultadas:\n" + refs), [
    answer,
  ]);
});

test("plain URLs and numeric references are removed without changing factual prose", () => {
  assert.equal(
    formatWhatsAppReply("GMD: 0,78 kg/dia [1].\nhttps://example.com\n\nConfira o peso."),
    "GMD: 0,78 kg/dia.\n\nConfira o peso.",
  );
});

test("long substantive replies retain all content and avoid splitting words or emoji", () => {
  const text = "Manejo 🐂 e nutrição. ".repeat(400).trim();
  const chunks = splitWhatsAppReply(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => Array.from(c).length <= 3500));
  assert.equal(chunks.join(" "), text);
});
