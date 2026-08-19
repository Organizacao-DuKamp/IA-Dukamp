import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWhatsAppProgressPlan,
  WHATSAPP_PROGRESS_TEMPLATE_COUNT,
} from "../src/lib/whatsapp/presence.ts";

test("biblioteca de presença contém exatamente 60 templates", () => {
  assert.equal(WHATSAPP_PROGRESS_TEMPLATE_COUNT, 60);
});

test("conversa casual curta responde direto sem fingir consulta", () => {
  for (const text of [
    "Ah que legak",
    "Ah que legal",
    "Que? Não entendi",
    "Como assim?",
    "Entendi",
    "Interessante",
  ]) {
    assert.deepEqual(
      buildWhatsAppProgressPlan(text, `wamid.casual-${text}`),
      [],
      `não deveria gerar presença para: ${text}`,
    );
  }
});

test("conversa geral sem busca responde direto mesmo fora da lista de small talk", () => {
  assert.deepEqual(
    buildWhatsAppProgressPlan(
      "Me explica de um jeito mais simples",
      "wamid.general-no-lookup",
    ),
    [],
  );
});

test("panorama de mercado recebe linguagem de mercado, não de estoque da DuKamp", () => {
  const plan = buildWhatsAppProgressPlan(
    "Como está o mercado de carnes no Brasil hoje?",
    "wamid.market-overview-library",
  );
  const joined = plan.map((item) => item.text).join(" ");

  assert.equal(plan.length, 2);
  assert.match(joined, /mercado|indicadores|tendência|fontes|referências/i);
  assert.doesNotMatch(joined, /estoque|cadastro oficial da DuKamp|catálogo/i);
});

test("cotação recebe linguagem própria de preço, data, praça e fonte", () => {
  const plan = buildWhatsAppProgressPlan(
    "Qual a cotação do boi gordo hoje em São Paulo?",
    "wamid.quote-library",
  );
  const joined = plan.map((item) => item.text).join(" ");

  assert.match(joined, /cotação|preço|valor/i);
  assert.match(joined, /data|praça|fonte|referência/i);
});

test("produto da DuKamp usa presença comercial interna sem fingir pesquisa externa", () => {
  const plan = buildWhatsAppProgressPlan(
    "Qual suplemento da DuKamp vocês recomendam para bezerro?",
    "wamid.product-library",
  );
  const joined = plan.map((item) => item.text).join(" ");

  assert.match(joined, /DuKamp|produto|catálogo|cadastro/i);
  assert.doesNotMatch(joined, /fonte externa|notícia|publicação mais recente/i);
});

test("sanidade recebe mensagem cuidadosa específica para saúde animal", () => {
  const plan = buildWhatsAppProgressPlan(
    "Meu bezerro está com diarreia e febre, o que pode ser?",
    "wamid.health-library",
  );
  const joined = plan.map((item) => item.text).join(" ");

  assert.match(joined, /saúde animal|sanidade|segurança/i);
});

test("manejo e nutrição usam contextos diferentes", () => {
  const management = buildWhatsAppProgressPlan(
    "Como melhorar o manejo do pasto na seca?",
    "wamid.management-library",
  );
  const nutrition = buildWhatsAppProgressPlan(
    "Posso dar milho junto com suplemento mineral para o gado?",
    "wamid.nutrition-library",
  );

  assert.match(management.map((item) => item.text).join(" "), /manejo/i);
  assert.match(nutrition.map((item) => item.text).join(" "), /nutri|aliment/i);
});

test("a mesma categoria varia entre mensagens diferentes sem repetir primeiro e segundo aviso", () => {
  const variants = new Set<string>();

  for (let index = 0; index < 18; index += 1) {
    const plan = buildWhatsAppProgressPlan(
      "Como está o mercado de carnes no Brasil hoje?",
      `wamid.variant-${index}`,
    );
    assert.notEqual(plan[0]?.text, plan[1]?.text);
    for (const item of plan) variants.add(item.text);
  }

  assert.ok(variants.size >= 4, `esperava variedade real; encontrei ${variants.size} frases`);
});
