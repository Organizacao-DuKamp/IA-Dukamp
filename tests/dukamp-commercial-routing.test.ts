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

for (const question of [
  "quais os vendedores da DuKamp?",
  "não, os vendedores",
  "me refiro aos vendedores como Brenda e Andressa",
  "quero os contatos comerciais",
]) {
  test(`pedido comercial é classificado como vendedor: ${question}`, () => {
    assert.equal(classifyDomainIntent(question).intent, "seller_contact");
  });
}

test("usa configuração pública somente quando o runtime não recebeu env", () => {
  const previous = {
    url: process.env.DUKAMP_SITE_SUPABASE_URL,
    anon: process.env.DUKAMP_SITE_SUPABASE_ANON_KEY,
    publishable: process.env.DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY,
    viteUrl: process.env.VITE_DUKAMP_SITE_SUPABASE_URL,
    viteAnon: process.env.VITE_DUKAMP_SITE_SUPABASE_ANON_KEY,
    vitePublishable: process.env.VITE_DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY,
  };
  delete process.env.DUKAMP_SITE_SUPABASE_URL;
  delete process.env.DUKAMP_SITE_SUPABASE_ANON_KEY;
  delete process.env.DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.VITE_DUKAMP_SITE_SUPABASE_URL;
  delete process.env.VITE_DUKAMP_SITE_SUPABASE_ANON_KEY;
  delete process.env.VITE_DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const config = resolveSiteConfiguration();
    assert.equal(config.source, "public_fallback");
    assert.match(config.url ?? "", /^https:\/\/.+\.supabase\.co$/);
    assert.ok((config.key?.length ?? 0) > 40);
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("DUKAMP_SITE_SUPABASE_URL", previous.url);
    restore("DUKAMP_SITE_SUPABASE_ANON_KEY", previous.anon);
    restore("DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY", previous.publishable);
    restore("VITE_DUKAMP_SITE_SUPABASE_URL", previous.viteUrl);
    restore("VITE_DUKAMP_SITE_SUPABASE_ANON_KEY", previous.viteAnon);
    restore("VITE_DUKAMP_SITE_SUPABASE_PUBLISHABLE_KEY", previous.vitePublishable);
  }
});
