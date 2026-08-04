import assert from "node:assert/strict";
import test from "node:test";

import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { resolveSiteConfiguration } from "../src/lib/site/site-client.server.ts";

for (const question of [
  "quais produtos vocês têm?",
  "quais suplementos vocês têm?",
  "liste o catálogo da DuKamp",
  "mostre as rações que vocês vendem",
]) {
  test(`pergunta comercial é classificada como product: ${question}`, () => {
    assert.equal(classifyDomainIntent(question).intent, "product");
  });
}

test("pedido de contatos comerciais é classificado como vendedor", () => {
  assert.equal(classifyDomainIntent("quero os contatos comerciais").intent, "seller_contact");
});

test("configuração pública de leitura existe como fallback server-side", () => {
  const oldUrl = process.env.DUKAMP_SITE_SUPABASE_URL;
  const oldKey = process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  delete process.env.DUKAMP_SITE_SUPABASE_URL;
  delete process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  try {
    const config = resolveSiteConfiguration();
    assert.equal(config.source, "public_fallback");
    assert.match(config.url, /^https:\/\/.+\.supabase\.co$/);
    assert.ok(config.key.length > 40);
  } finally {
    if (oldUrl === undefined) delete process.env.DUKAMP_SITE_SUPABASE_URL;
    else process.env.DUKAMP_SITE_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
    else process.env.DUKAMP_SITE_SUPABASE_ANON_KEY = oldKey;
  }
});
