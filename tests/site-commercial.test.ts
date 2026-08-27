import assert from "node:assert/strict";
import test from "node:test";
import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { checkDukampSiteHealth } from "../src/lib/site/health.server.ts";
import {
  executeCommercialLookup,
  querySiteProducts,
  querySiteSellers,
  type SiteLookupDependencies,
} from "../src/lib/site/site-lookup.server.ts";

type Row = Record<string, unknown>;
type Reply = { data?: Row[]; error?: { code?: string; status?: number; message?: string } | null };

class MockQuery implements PromiseLike<Reply> {
  private readonly table: string;
  private readonly owner: MockSupabase;
  constructor(table: string, owner: MockSupabase) {
    this.table = table;
    this.owner = owner;
  }
  select(columns: string) {
    this.owner.selects.push({ table: this.table, columns });
    this.owner.currentSelect = columns;
    return this;
  }
  eq() {
    return this;
  }
  or(expression: string) {
    this.owner.filters.push(expression);
    return this;
  }
  order(column: string) {
    this.owner.orders.push(column);
    return this;
  }
  in() {
    return this;
  }
  limit() {
    return this;
  }
  then<TResult1 = Reply, TResult2 = never>(
    onfulfilled?: ((value: Reply) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.owner.reply(this.table, this.owner.currentSelect)).then(
        onfulfilled,
        onrejected,
      );
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }
}

class MockSupabase {
  calls: string[] = [];
  selects: Array<{ table: string; columns: string }> = [];
  filters: string[] = [];
  orders: string[] = [];
  currentSelect = "";
  private readonly replies: Record<string, Reply | Reply[] | (() => Reply)>;
  constructor(replies: Record<string, Reply | Reply[] | (() => Reply)> = {}) {
    this.replies = replies;
  }
  from(table: string) {
    this.calls.push(table);
    return new MockQuery(table, this);
  }
  reply(table: string, _select: string): Reply {
    const configured = this.replies[table] ?? { data: [] };
    if (typeof configured === "function") return configured();
    if (Array.isArray(configured)) return configured.shift() ?? { data: [] };
    return configured;
  }
}
const deps = (client: MockSupabase): SiteLookupDependencies => ({
  client: client as never,
  configured: true,
});
const product = {
  id: "p1",
  name: "DuKamp 60",
  code: "DK60",
  slug: "dukamp-60",
  price: 99,
  active: true,
  stock: 4,
  featured: true,
  description: "Suplemento mineral indicado para bezerros e recria.",
};
const sellers = [
  {
    id: "s1",
    name: "Ana Souza",
    role: "Consultora",
    region: "São José do Rio Preto",
    phone: null,
    whatsapp: "5517999991111",
    active: true,
    display_order: 1,
  },
  {
    id: "s2",
    name: "Bruno Lima",
    role: "Representante",
    region: "Monte Aprazível",
    phone: "1730002000",
    whatsapp: null,
    active: true,
    display_order: 2,
  },
];

test("variáveis ausentes produzem health check seguro", async () => {
  const health = await checkDukampSiteHealth({ configured: false });
  assert.equal(health.configured, false);
  assert.equal(health.products_query.code, "not_configured");
});
test("produto encontrado vem do cliente Supabase", async () => {
  const client = new MockSupabase({ products: { data: [product] } });
  const result = await querySiteProducts("DuKamp 60", 8, deps(client));
  assert.equal(result.status, "ok");
  assert.equal(result.data[0]?.price, 99);
  assert.deepEqual(client.calls, ["products"]);
});
test("produto não encontrado é empty_result", async () => {
  const result = await querySiteProducts(
    "inexistente",
    8,
    deps(new MockSupabase({ products: { data: [] } })),
  );
  assert.equal(result.status, "empty_result");
  assert.deepEqual(result.data, []);
});
test("pequeno erro de digitação usa fallback e encontra nome oficial", async () => {
  const client = new MockSupabase({
    products: [{ data: [] }, { data: [product] }],
  });
  const result = await querySiteProducts("Dukmp 60", 8, deps(client));
  assert.equal(result.status, "ok");
  assert.equal(result.data[0]?.name, "DuKamp 60");
  assert.equal(client.calls.length, 2);
});
test("erro de RLS é unauthorized e não vira lista vazia silenciosa", async () => {
  const result = await querySiteProducts(
    "DuKamp",
    8,
    deps(new MockSupabase({ products: { error: { code: "42501", status: 403 } } })),
  );
  assert.equal(result.status, "unauthorized");
  assert.equal(result.errorCode, "access_denied");
});
test("chave inválida é diferenciada de bloqueio RLS", async () => {
  const result = await querySiteProducts(
    "DuKamp",
    8,
    deps(new MockSupabase({ products: { error: { code: "PGRST301", status: 401 } } })),
  );
  assert.equal(result.status, "unauthorized");
  assert.equal(result.errorCode, "invalid_key");
});
test("coluna opcional inexistente refaz produtos com colunas comerciais essenciais", async () => {
  const client = new MockSupabase({
    products: [
      { error: { code: "42703", message: "column description does not exist" } },
      {
        data: [
          {
            id: "p1",
            name: "DuKamp 60",
            code: "DK60",
            slug: null,
            price: 99,
            active: true,
            stock: 4,
            featured: true,
          },
        ],
      },
    ],
  });
  const result = await querySiteProducts("DuKamp 60", 8, deps(client));
  assert.equal(result.status, "ok");
  assert.equal(result.data[0]?.price, 99);
  assert.equal(client.calls.length, 2);
  assert.match(client.selects[0]!.columns, /description,images,brand/);
  assert.equal(client.selects[1]!.columns, "id,name,code,slug,price,active,stock,featured");
});
test("lista de vendedores consulta colunas reais e retorna ativos", async () => {
  const client = new MockSupabase({ sellers: { data: sellers } });
  const result = await querySiteSellers("lista de vendedores", 30, deps(client));
  assert.equal(result.status, "ok");
  assert.equal(result.data.length, 2);
  assert.match(client.selects[0]!.columns, /display_order/);
});
test("vendedor por região é filtrado depois da consulta real", async () => {
  const result = await querySiteSellers(
    "vendedor de Rio Preto",
    30,
    deps(new MockSupabase({ sellers: { data: sellers } })),
  );
  assert.deepEqual(
    result.data.map((seller) => seller.name),
    ["Ana Souza"],
  );
});
test("display_order ausente usa ordenação por nome", async () => {
  const client = new MockSupabase({
    sellers: [
      { error: { code: "PGRST204", message: "column display_order missing" } },
      { data: sellers },
    ],
  });
  const result = await querySiteSellers("lista", 30, deps(client));
  assert.equal(result.status, "ok");
  assert.ok(client.orders.includes("name"));
  assert.equal(client.calls.length, 2);
});
test("lista vazia verdadeira é empty_result", async () => {
  const result = await querySiteSellers(
    "lista",
    30,
    deps(new MockSupabase({ sellers: { data: [] } })),
  );
  assert.equal(result.status, "empty_result");
});
test("erro de conexão é internal_error", async () => {
  const result = await querySiteProducts(
    "DuKamp",
    8,
    deps(
      new MockSupabase({
        products: () => {
          throw Object.assign(new Error("offline"), { code: "ECONNRESET" });
        },
      }),
    ),
  );
  assert.equal(result.status, "internal_error");
  assert.equal(result.errorCode, "ECONNRESET");
});
test("timeout é diferenciado de erro interno", async () => {
  const result = await querySiteProducts(
    "DuKamp",
    8,
    deps(new MockSupabase({ products: { error: { code: "TIMEOUT" } } })),
  );
  assert.equal(result.status, "timeout");
});
for (const question of ["quais produtos a DuKamp tem?", "tem produto para bezerro?"])
  test(`intenção executa products no Supabase: ${question}`, async () => {
    const client = new MockSupabase({ products: { data: [product] } });
    const execution = await executeCommercialLookup(
      classifyDomainIntent(question),
      question,
      deps(client),
    );
    assert.ok(client.calls.includes("products"));
    assert.equal(execution.lookup.products?.[0]?.name, "DuKamp 60");
  });
test("product_recommendation executa products no Supabase", async () => {
  const question = "me recomende um suplemento";
  const client = new MockSupabase({ products: { data: [product] } });
  await executeCommercialLookup(classifyDomainIntent(question), question, deps(client));
  assert.deepEqual(client.calls, ["products"]);
});
for (const question of ["me passe a lista de vendedores", "quero o contato dos vendedores"])
  test(`seller_contact executa sellers no Supabase: ${question}`, async () => {
    const client = new MockSupabase({ sellers: { data: sellers } });
    const execution = await executeCommercialLookup(
      classifyDomainIntent(question),
      question,
      deps(client),
    );
    assert.ok(client.calls.includes("sellers"));
    assert.equal(execution.lookup.sellers?.length, 2);
  });
test("health check consulta quatro tabelas sem retornar registros", async () => {
  const client = new MockSupabase({
    products: { data: [product] },
    sellers: { data: sellers },
    categories: { data: [{ name: "Bovinos" }] },
    site_settings: { data: [{ key: "footer" }] },
  });
  const health = await checkDukampSiteHealth(deps(client));
  assert.equal(health.configured, true);
  assert.deepEqual(client.calls.sort(), ["categories", "products", "sellers", "site_settings"]);
  assert.equal("data" in health.products_query, false);
});
