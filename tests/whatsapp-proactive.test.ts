import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyFollowupSchedule,
  localDateForTimeZone,
  parseFollowupPreference,
  sanitizeMemoryFactKey,
  withinCustomerServiceWindow,
} from "../src/lib/whatsapp/proactive.ts";

function localMinutes(iso: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

test("agenda cria dois horários determinísticos e separados no dia", () => {
  const first = buildDailyFollowupSchedule("5517999999999", "2026-09-21");
  const second = buildDailyFollowupSchedule("5517999999999", "2026-09-21");
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0].slot, 1);
  assert.equal(first[1].slot, 2);

  const morning = localMinutes(first[0].scheduledFor);
  const evening = localMinutes(first[1].scheduledFor);
  assert.ok(morning >= 8 * 60 + 15 && morning <= 12 * 60 + 15);
  assert.ok(evening >= 15 * 60 && evening <= 20 * 60 + 15);
  assert.ok(evening - morning >= 165);
});

test("data local respeita America/Sao_Paulo", () => {
  assert.equal(
    localDateForTimeZone(new Date("2026-09-22T01:30:00.000Z"), "America/Sao_Paulo"),
    "2026-09-21",
  );
});

test("usuário pode pausar e reativar acompanhamento por mensagem", () => {
  assert.equal(parseFollowupPreference("Pode parar o acompanhamento pra mim"), "disable");
  assert.equal(parseFollowupPreference("Não me mande mais essas mensagens"), "disable");
  assert.equal(parseFollowupPreference("Quero reativar o acompanhamento"), "enable");
  assert.equal(parseFollowupPreference("Pode voltar a me mandar os lembretes"), "enable");
  assert.equal(parseFollowupPreference("Meu boi está melhor"), null);
});

test("janela de serviço usa 24 horas desde a última entrada", () => {
  const now = new Date("2026-09-21T15:00:00.000Z");
  assert.equal(withinCustomerServiceWindow("2026-09-20T15:00:01.000Z", now), true);
  assert.equal(withinCustomerServiceWindow("2026-09-20T14:59:59.000Z", now), false);
  assert.equal(withinCustomerServiceWindow(null, now), false);
});

test("fact keys são estáveis e seguras", () => {
  assert.equal(sanitizeMemoryFactKey("Rebanho: Tamanho Atual"), "rebanho:-tamanho-atual");
  assert.equal(sanitizeMemoryFactKey("  Bói Doênte #12  "), "boi-doente-12");
});
