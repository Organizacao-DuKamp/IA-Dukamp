import assert from "node:assert/strict";
import test from "node:test";

import { weatherSourceDirective } from "../src/lib/chat/weather.ts";

test("previsão do tempo não se reapresenta e privilegia leitura rápida", () => {
  const directive = weatherSourceDirective("Monte Aprazível, SP");

  assert.match(directive, /NÃO se apresente espontaneamente/i);
  assert.match(directive, /A identidade só deve ser dita quando o usuário perguntar/i);
  assert.match(directive, /Comece diretamente pela previsão/i);
  assert.match(directive, /leitura rápida em celular\/WhatsApp/i);
  assert.match(directive, /AGRUP(E|A) dias consecutivos/i);
  assert.match(directive, /Não despeje todas as variáveis/i);
  assert.match(directive, /uma única linha curta no final/i);
});

test("previsão mantém transparência sem virar relatório técnico", () => {
  const directive = weatherSourceDirective("Monte Aprazível, SP");

  assert.match(directive, /data explícita com ano/i);
  assert.match(directive, /horário\/fuso/i);
  assert.match(directive, /fontes/i);
  assert.match(directive, /ECMWF\/GFS\/ICON/i);
  assert.match(directive, /não como um dump de banco de dados/i);
});
