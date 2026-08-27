import assert from "node:assert/strict";
import test from "node:test";

import { splitWhatsAppOutboundText } from "../src/lib/whatsapp/format.ts";

test("resposta curta continua em uma única bolha", () => {
  assert.deepEqual(splitWhatsAppOutboundText("Resposta curta e direta."), [
    "Resposta curta e direta.",
  ]);
});

test("normaliza títulos markdown para o formato de negrito do WhatsApp", () => {
  assert.deepEqual(splitWhatsAppOutboundText("## Hoje\n\n**Tempo seco** e quente."), [
    "*Hoje*\n\n*Tempo seco* e quente.",
  ]);
});

test("previsão longa é dividida por blocos sem misturar tudo em uma bolha", () => {
  const reply = [
    "*Monte Aprazível — previsão*",
    "",
    "*Hoje (27/08)*\nMáxima de 33 °C e mínima de 27 °C. Tempo predominantemente seco, com baixa chance de chuva durante a tarde.",
    "",
    "*Amanhã (28/08)*\nO calor continua, com máxima perto de 34 °C. A chance de chuva segue baixa e não há indicação de volume significativo.",
    "",
    "*Próximos dias*\nEntre sábado e segunda, as máximas podem ficar entre 35 e 38 °C. A mudança mais provável aparece na terça, quando cresce a chance de chuva.",
    "",
    "*Chuva*\nOs modelos ainda divergem sobre o volume, então a leitura mais segura é de chuva fraca a moderada, sem cravar um único valor.",
    "",
    "_Atualizado em 27/08/2026, 14:11 (Brasília) | Fontes: INMET, ECMWF, GFS e ICON._",
  ].join("\n");

  const chunks = splitWhatsAppOutboundText(reply);
  assert.ok(chunks.length >= 2, `esperava mais de uma bolha, recebi ${chunks.length}`);
  assert.ok(chunks.every((chunk) => chunk.length <= 3500));
  assert.equal(chunks.join("\n\n"), reply);
});

test("texto longo sem parágrafos prefere frases completas em vez de corte cego", () => {
  const sentence =
    "A previsão indica calor forte durante a tarde e baixa chance de chuva no município.";
  const reply = Array.from({ length: 14 }, () => sentence).join(" ");
  const chunks = splitWhatsAppOutboundText(reply);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => /[.!?]$/u.test(chunk)));
  assert.equal(chunks.join(" "), reply);
});

test("nenhuma bolha ultrapassa o limite rígido da Graph API", () => {
  const reply = `${"palavra ".repeat(700)}fim.`;
  const chunks = splitWhatsAppOutboundText(reply, {
    softSplitTriggerChars: 3500,
    softTargetChars: 3500,
    hardMaxChars: 3500,
  });

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 3500));
});
