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

test("previsão normal permanece em uma mensagem mas ganha separação visual", () => {
  const reply = [
    "## Monte Aprazível — previsão",
    "• 27/08 — tempo com muitas nuvens; mínima ~16–17 °C, máxima ~29–33 °C; chuva fraca isolada (~1–1,5 mm); vento fraco a moderado.",
    "• 28–31/08 — sequência de dias quentes e secos; máximas entre ~34–37 °C; chance de chuva muito baixa.",
    "• 01/09 — maior chance de chuva; probabilidade até ~60%; acumulado moderado possível.",
    "",
    "**Pecuária**",
    "O principal ponto de atenção é o calor da tarde. Água disponível e sombra são importantes para reduzir o estresse térmico.",
    "",
    "Atualizado em 27/08/2026, 14:11 (Brasília). Fontes: INMET, ECMWF, GFS e ICON.",
  ].join("\n");

  const chunks = splitWhatsAppOutboundText(reply);
  assert.equal(chunks.length, 1);
  const formatted = chunks[0] ?? "";
  assert.match(formatted, /^\*Monte Aprazível — previsão\*/u);
  assert.match(formatted, /• \*27\/08\*\n  tempo com muitas nuvens;\n  mínima/u);
  assert.match(formatted, /vento fraco a moderado\.\n\n• \*28–31\/08\*/u);
  assert.match(formatted, /\n\n\*Pecuária\*\n/u);
  assert.match(formatted, /\n\nAtualizado em 27\/08\/2026/u);
});

test("itens longos ficam escaneáveis sem reescrever o conteúdo", () => {
  const reply =
    "• Hoje — calor forte à tarde; umidade mais baixa; vento moderado; sem chuva significativa.";
  const [formatted] = splitWhatsAppOutboundText(reply);

  assert.equal(
    formatted,
    "• *Hoje*\n  calor forte à tarde;\n  umidade mais baixa;\n  vento moderado;\n  sem chuva significativa.",
  );
});

test("texto acima do limite é dividido em fronteiras legíveis", () => {
  const sentence =
    "A previsão indica calor forte durante a tarde e baixa chance de chuva no município.";
  const reply = Array.from({ length: 55 }, () => sentence).join(" ");
  const chunks = splitWhatsAppOutboundText(reply);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 3500));
  assert.ok(chunks.every((chunk) => /[.!?]$/u.test(chunk)));
});

test("nenhuma bolha ultrapassa o limite rígido configurado", () => {
  const reply = `${"palavra ".repeat(700)}fim.`;
  const chunks = splitWhatsAppOutboundText(reply, { hardMaxChars: 3500 });

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => Array.from(chunk).length <= 3500));
});
