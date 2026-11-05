import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRegistryQuery,
  RegistryQuerySchema,
} from "../src/lib/guardian/animal-registry.ts";
import {
  ABCZ_ENDPOINT,
  abczConfigured,
  RegistryError,
  handleAnimalRegistry,
  lookupAbcz,
  parseAbczGenealogy,
} from "../src/lib/guardian/animal-registry.server.ts";
import {
  hashToken,
  type PanelStore,
  type PanelIdentity,
} from "../src/lib/guardian/panel.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";

const query = { mode: "rgn" as const, series: "QAZZ", rgn: "00100" };
const method = "PesquisarGenealogia";
const propertyId = "synthetic-farm";
const credentials = JSON.stringify({
  [propertyId]: { creatorCode: 123, login: "synthetic<login>", password: "synthetic&password" },
});
const registryEnv = { ABCZ_SOFTWARE_ID: "321", ABCZ_FARM_CREDENTIALS_JSON: credentials };
const primary = `<AnimalParaGenealogia><racasigla>NEL</racasigla><graudesanguesigla>PO</graudesanguesigla><sexo>F</sexo><serie>QAZZ</serie><rgn>100</rgn><rgd>54321</rgd><nome>ANIMAL &amp; TESTE</nome><nascimento>01/02/2020</nascimento><pelagemDescricao>BRANCA</pelagemDescricao><pai><serie>PAIZ</serie><rgn>101</rgn></pai><mae><serie>MAEZ</serie><rgn>102</rgn></mae></AnimalParaGenealogia>`;
const ancestry = `<AnimalParaGenealogia><serie>PAIZ</serie><rgn>101</rgn><nome>PAI SINTÉTICO</nome><sexo>M</sexo><pai><serie>AVOZ</serie><rgn>103</rgn></pai><mae xsi:nil="true" /></AnimalParaGenealogia><AnimalParaGenealogia><serie>MAEZ</serie><rgn>102</rgn><nome>MÃE SINTÉTICA</nome><sexo>F</sexo></AnimalParaGenealogia><AnimalParaGenealogia><serie>AVOZ</serie><rgn>103</rgn><nome>AVÔ SINTÉTICO</nome><sexo>M</sexo><pai><serie>QAZZ</serie><rgn>100</rgn></pai></AnimalParaGenealogia>`;
function envelope(animal = primary, ancestors = ancestry, message = "", operation = method) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soap:Body><${operation}Response xmlns="https://www.abczstat.com.br/softwareterceiros/"><${operation}Result><mensagem>${message}</mensagem><animaisPesquisados>${animal}</animaisPesquisados><animaisDaGenealogia>${ancestors}</animaisDaGenealogia></${operation}Result></${operation}Response></soap:Body></soap:Envelope>`;
}
const complementaryMethod = "PesquisarAnimalQualquerChaveComplementar";
const detailed = `<animalGeralDetalhado><racasigla>NEL</racasigla><graudesanguesigla>PO</graudesanguesigla><sexo>F</sexo><serie>QAZZ</serie><rgn>100</rgn><rgd>54321</rgd><nome>ANIMAL &amp; TESTE</nome><nascimento>01/02/2020</nascimento><pelagemDescricao>BRANCA</pelagemDescricao><nomePai>PAI SINTÉTICO</nomePai><seriePai>PAIZ</seriePai><rgnPai>101</rgnPai><sexoPai>M</sexoPai><nomeMae>MÃE SINTÉTICA</nomeMae><serieMae>MAEZ</serieMae><rgnMae>102</rgnMae><sexoMae>F</sexoMae><mensagem /></animalGeralDetalhado>`;
function complementaryEnvelope(items = detailed) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${complementaryMethod}Response xmlns="https://www.abczstat.com.br/softwareterceiros/"><${complementaryMethod}Result>${items}</${complementaryMethod}Result></${complementaryMethod}Response></soap:Body></soap:Envelope>`;
}
test("the legacy complementary response preserves inherited data and exclusive methods are access errors", () => {
  const result = parseAbczGenealogy(complementaryEnvelope(), query, complementaryMethod);
  assert.equal(result.profile.name, "ANIMAL & TESTE");
  assert.equal(result.profile.birthDate, "2020-02-01");
  assert.equal(result.profile.sire, "PAIZ 101");
  assert.equal(result.profile.dam, "MAEZ 102");
  assert.deepEqual(
    result.profile.pedigree?.map((node) => [node.relation, node.name]),
    [
      ["sire", "PAI SINTÉTICO"],
      ["dam", "MÃE SINTÉTICA"],
    ],
  );
  assert.equal(
    result.profile.pedigree?.length,
    2,
    "never invent grandparents not returned by the source",
  );
  const old = {
    mode: "rgd" as const,
    rgd: "54321",
    breedCode: "NEL",
    category: "PO",
    sex: "female" as const,
  };
  assert.equal(
    parseAbczGenealogy(complementaryEnvelope(), old, complementaryMethod).profile.code,
    "QAZZ 100",
  );
  assert.throws(
    () => parseAbczGenealogy(complementaryEnvelope(""), query, complementaryMethod),
    (error) => error instanceof RegistryError && error.code === "not_found",
  );
  assert.throws(
    () => parseAbczGenealogy(envelope("", "", "MÉTODO EXCLUSIVO DO SISTEMA PRODUZ"), query, method),
    (error) => error instanceof RegistryError && error.code === "access_denied",
  );
  assert.throws(
    () =>
      parseAbczGenealogy(
        complementaryEnvelope(
          "<animalGeralDetalhado><mensagem>SOFTWARE INEXISTENTE</mensagem></animalGeralDetalhado>",
        ),
        query,
        complementaryMethod,
      ),
    (error) => error instanceof RegistryError && error.code === "access_denied",
  );
});
test("registration input distinguishes farm codes from complete series/RGN, preserving serial suffixes", () => {
  assert.deepEqual(normalizeRegistryQuery({ mode: "rgn", rgn: "qazz-00100" }), query);
  assert.deepEqual(normalizeRegistryQuery({ mode: "rgn", code: "QAZZ 100", rgn: "00100" }), query);
  assert.throws(
    () => normalizeRegistryQuery({ mode: "rgn", code: "FARM 999", rgn: "100" }),
    /série/,
  );
  assert.deepEqual(normalizeRegistryQuery({ mode: "rgn", series: "qazz", rgn: "00100A" }), {
    ...query,
    rgn: "00100A",
  });
  assert.throws(() => normalizeRegistryQuery({ mode: "rgn", rgn: "404" }), /série/i);
  assert.throws(
    () => normalizeRegistryQuery({ mode: "rgn", series: "OUTR", rgn: "QAZZ 100" }),
    /não correspondem/,
  );
  assert.equal(RegistryQuerySchema.safeParse({ ...query, software: 999 }).success, false);
  assert.throws(() =>
    normalizeRegistryQuery({ mode: "rgd", rgd: "123", breedCode: "", category: "PO", sex: "male" }),
  );
});
test("SOAP imports the exact primary animal and links bounded ancestry without guessing farm, money or performance data", () => {
  const result = parseAbczGenealogy(envelope(), query, method, new Date("2026-11-05T16:00:00Z"));
  assert.equal(result.provider, "ABCZ");
  assert.equal(result.profile.name, "ANIMAL & TESTE");
  assert.equal(result.profile.code, "QAZZ 100");
  assert.equal(result.profile.sex, "female");
  assert.equal(result.profile.birthDate, "2020-02-01");
  assert.equal(result.profile.breed, "NEL");
  assert.equal(result.profile.sire, "PAIZ 101");
  assert.equal(result.profile.dam, "MAEZ 102");
  assert.equal(
    parseAbczGenealogy(
      envelope(primary, ancestry, "Consulta realizada pelo software autorizado"),
      query,
      method,
    ).profile.rgn,
    "100",
  );
  assert.deepEqual(
    result.profile.pedigree?.map((node) => [node.relation, node.code]),
    [
      ["sire", "PAIZ 101"],
      ["sire.sire", "AVOZ 103"],
      ["dam", "MAEZ 102"],
    ],
  );
  for (const key of [
    "currentWeightKg",
    "purchasePriceCents",
    "salePriceCents",
    "lot",
    "responsible",
    "origin",
    "dailyIntakeKg",
  ])
    assert.ok(!(key in result.profile), key);
});
test("ancestors and neighboring fichas never masquerade as the requested animal; conflicting primary results are rejected", () => {
  const other = primary.replaceAll("QAZZ", "OUTR");
  assert.throws(
    () => parseAbczGenealogy(envelope(other, primary), query, method),
    (error) => error instanceof RegistryError && error.code === "not_found",
  );
  assert.throws(
    () => parseAbczGenealogy(envelope(primary + primary), query, method),
    (error) => error instanceof RegistryError && error.code === "ambiguous",
  );
  assert.throws(
    () => parseAbczGenealogy(envelope("", "", "Software não autorizado"), query, method),
    (error) => error instanceof RegistryError && error.code === "access_denied",
  );
  const old = {
    mode: "rgd" as const,
    rgd: "54321",
    breedCode: "NEL",
    category: "PO",
    sex: "female" as const,
  };
  assert.equal(
    parseAbczGenealogy(
      envelope(primary, "", "", "PesquisarAnimalRGD_GEN"),
      old,
      "PesquisarAnimalRGD_GEN",
    ).profile.rgn,
    "100",
  );
  assert.throws(
    () =>
      parseAbczGenealogy(
        envelope(primary, "", "", "PesquisarAnimalRGD_GEN"),
        { ...old, sex: "male" },
        "PesquisarAnimalRGD_GEN",
      ),
    /Não foi encontrada/,
  );
});
test("malformed XML, entities, excessive nesting and forged SOAP bodies cannot populate a card", () => {
  for (const xml of [
    "<html>Site indisponível</html>",
    "<xml><broken></xml>",
    '<!DOCTYPE a [<!ENTITY private SYSTEM "file:///private">]>' + envelope(),
    "<a>".repeat(65) + "</a>".repeat(65),
    envelope().replace(method + "Response", "OtherResponse"),
  ])
    assert.throws(() => parseAbczGenealogy(xml, query, method), RegistryError);
  const missing = parseAbczGenealogy(
    envelope(
      primary.replace("01/02/2020", "31/02/2020").replace("<sexo>F</sexo>", "<sexo>?</sexo>"),
    ),
    query,
    method,
  );
  assert.ok(!("birthDate" in missing.profile));
  assert.ok(!("sex" in missing.profile));
});
test("the authenticated genealogy contract uses only the software and creator account assigned to this farm", async () => {
  let calls = 0;
  const fetchImpl = (async (url, init) => {
    calls++;
    assert.equal(url, ABCZ_ENDPOINT);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.match(String(init?.body), /<seriealfa>QAZZ<\/seriealfa>/);
    assert.match(String(init?.body), /<rgn>00100<\/rgn>/);
    assert.match(String(init?.body), /<software>321<\/software>/);
    assert.match(
      String((init?.headers as Record<string, string>).SOAPAction),
      /PesquisarGenealogia/,
    );
    assert.match(String(init?.body), /<criador_codigo>123<\/criador_codigo>/);
    assert.match(String(init?.body), /<login>synthetic&lt;login&gt;<\/login>/);
    assert.match(String(init?.body), /<senha>synthetic&amp;password<\/senha>/);
    assert.ok(!String(init?.body).includes("_GEN"));
    assert.ok(!String(init?.body).includes("Complementar"));
    return new Response(envelope(), { headers: { "content-type": "text/xml" } });
  }) as typeof fetch;
  for (const software of [undefined, "", "0", "2147483648", "not-an-id"])
    await assert.rejects(
      lookupAbcz(query, {
        propertyId,
        env: { ...registryEnv, ABCZ_SOFTWARE_ID: software },
        fetchImpl,
      }),
      (error) => error instanceof RegistryError && error.code === "not_configured",
    );
  assert.equal(calls, 0);
  for (const env of [
    { ABCZ_SOFTWARE_ID: "321" },
    { ...registryEnv, ABCZ_FARM_CREDENTIALS_JSON: "invalid-json" },
    {
      ...registryEnv,
      ABCZ_FARM_CREDENTIALS_JSON: JSON.stringify({
        [propertyId]: { creatorCode: 0, login: "a", password: "b" },
      }),
    },
    {
      ...registryEnv,
      ABCZ_FARM_CREDENTIALS_JSON: JSON.stringify({
        [propertyId]: { creatorCode: 123, login: "a", password: "" },
      }),
    },
  ]) {
    assert.equal(abczConfigured(propertyId, env), false);
    await assert.rejects(
      lookupAbcz(query, { propertyId, env, fetchImpl }),
      (error) => error instanceof RegistryError && error.code === "not_configured",
    );
  }
  assert.equal(abczConfigured(propertyId, registryEnv), true);
  assert.equal(abczConfigured("other-farm", registryEnv), false);
  await assert.rejects(
    lookupAbcz(query, { propertyId: "other-farm", env: registryEnv, fetchImpl }),
    (error) => error instanceof RegistryError && error.code === "not_configured",
  );
  await assert.rejects(
    lookupAbcz(query, { env: registryEnv, fetchImpl }),
    (error) => error instanceof RegistryError && error.code === "not_configured",
  );
  assert.equal(calls, 0, "missing or mismatched account must not send a network request");
  assert.equal(
    (await lookupAbcz(query, { propertyId, env: registryEnv, fetchImpl })).profile.rgn,
    "100",
  );
  assert.equal(calls, 1);
  const rgdQuery = {
    mode: "rgd" as const,
    rgd: "54321",
    breedCode: "NEL",
    category: "PO",
    sex: "female" as const,
  };
  const rgdFetch = (async (_url, init) => {
    const body = String(init?.body);
    for (const [key, value] of Object.entries({
      seriealfa: "",
      rgn: "",
      raca_sigla: "NEL",
      graudesangue_sigla: "PO",
      sexo: "F",
      rgd: "54321",
    }))
      assert.ok(body.includes(`<${key}>${value}</${key}>`), key);
    return new Response(envelope());
  }) as typeof fetch;
  assert.equal(
    (await lookupAbcz(rgdQuery, { propertyId, env: registryEnv, fetchImpl: rgdFetch })).profile.rgd,
    "54321",
  );
  const denied = (async () =>
    new Response("private internal error", { status: 403 })) as typeof fetch;
  await assert.rejects(
    lookupAbcz(query, { propertyId, env: registryEnv, fetchImpl: denied }),
    (error) =>
      error instanceof RegistryError &&
      error.code === "access_denied" &&
      !error.message.includes("private internal"),
  );
  const oversized = (async () =>
    new Response("<a/>", { headers: { "content-length": "3000000" } })) as typeof fetch;
  await assert.rejects(
    lookupAbcz(query, { propertyId, env: registryEnv, fetchImpl: oversized }),
    (error) => error instanceof RegistryError && error.code === "invalid_response",
  );
  const invalidLogin = (async () =>
    new Response(envelope("", "", "Login ou senha inválidos"))) as typeof fetch;
  await assert.rejects(
    lookupAbcz(query, { propertyId, env: registryEnv, fetchImpl: invalidLogin }),
    (error) =>
      error instanceof RegistryError &&
      error.code === "access_denied" &&
      !error.message.includes("synthetic"),
  );
});
test("lookup API reauthorizes browser/native sessions, blocks CSRF/oversize/cross-farm inputs and never saves data", async () => {
  const token = "a".repeat(64),
    phone = "000000000000088";
  let installed = false,
    attempts = 0,
    calls = 0;
  let identity: PanelIdentity | null = {
    phone,
    propertyId: "synthetic-farm",
    version: 1,
    role: "owner",
    expiresAt: "2027-01-01T00:00:00Z",
    book: emptyFarm("Fazenda QA", "Tanabi", "SP"),
  };
  const store: PanelStore = {
    authorize: async (hash, mode) => {
      installed = !!mode;
      return hash === hashToken(token) ? identity : null;
    },
    attempt: async () => ++attempts < 3,
    exchange: async () => {
      throw Error("not called");
    },
    revoke: async () => {
      throw Error("not called");
    },
    replay: async () => {
      throw Error("not called");
    },
    commit: async () => {
      throw Error("must never save");
    },
  };
  const lookup: typeof lookupAbcz = async (_query, options) => {
    calls++;
    assert.equal(options?.propertyId, "synthetic-farm");
    return parseAbczGenealogy(envelope(), query, method);
  };
  const deps = { store, enabled: true, configured: true, lookup };
  function request(method = "POST", body: unknown = query, app = false) {
    return new Request("https://tpecia.example/api/public/farm-panel/animal-registry", {
      method,
      headers: {
        origin: "https://tpecia.example",
        "content-type": "application/json",
        "x-tpec-panel": "1",
        "x-tpec-panel-mode": app ? "installed" : "browser",
        cookie: `${app ? "tpec_farm_app_session" : "tpec_farm_session"}=${token}`,
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  }
  const anonymous = request();
  anonymous.headers.delete("cookie");
  assert.equal((await handleAnimalRegistry(anonymous, deps)).status, 401);
  const cross = request();
  cross.headers.set("origin", "https://untrusted.example");
  assert.equal((await handleAnimalRegistry(cross, deps)).status, 403);
  identity.role = "worker";
  assert.equal((await handleAnimalRegistry(request(), deps)).status, 403);
  assert.equal((await handleAnimalRegistry(request("GET"), deps)).status, 403);
  assert.equal(calls, 0);
  identity.role = "owner";
  assert.equal(
    (await handleAnimalRegistry(request("POST", { ...query, propertyId: "outside" }), deps)).status,
    400,
  );
  assert.equal(
    (await handleAnimalRegistry(request("POST", { ...query, rgn: "1".repeat(3000) }), deps)).status,
    413,
  );
  assert.equal((await handleAnimalRegistry(request("POST", query), deps)).status, 200);
  assert.equal(installed, false);
  assert.equal((await handleAnimalRegistry(request("POST", query, true), deps)).status, 200);
  assert.equal(installed, true);
  assert.equal((await handleAnimalRegistry(request(), deps)).status, 429);
  assert.equal(calls, 2);
  const status = await handleAnimalRegistry(request("GET"), deps);
  assert.equal(status.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await status.json(), {
    configured: true,
    publicUrl: "https://www.abcz.org.br/produtos-e-servicos/consulta-publica-de-animais",
  });
  identity = null;
  assert.equal((await handleAnimalRegistry(request("GET"), deps)).status, 401);
});
