import assert from "node:assert/strict";
import test from "node:test";
import {
  ABCZ_PUBLIC_CONSULTATION,
  extractAnimalRegistrations,
  resolveAnimalRegistryTurn,
  animalRegistryDirective,
  validateAnimalRegistryReply,
  animalRegistryUnconfirmedReply,
} from "../src/lib/chat/animal-registry.ts";
import { classifyDomainIntent } from "../src/lib/chat/intent.ts";
import { toolsForIntent } from "../src/lib/chat/tools.ts";
import { researchChatGPT, researchProfileForQuery } from "../src/lib/chat/perplexity.server.ts";
import { formatReplyForUser } from "../src/lib/chat/response-format.ts";
import { askOpenAI } from "../src/lib/chat/openai.server.ts";
import { orchestrateAI } from "../src/lib/ai/orchestrator.server.ts";
import { getAIUsageEvents, withAIUsageContext } from "../src/lib/chat/usage.server.ts";
import { animalRegistryCases } from "./evals/animal-registry-cases.ts";

const source =
  "https://aguamilagrosa.com.br/noticias/touros-da-gua-milagrosa-o-grande-campeo-e-o-reservado-grande-campeo-da-exposio-de-cascavel-pr/";
const animal = extractAnimalRegistrations("GTRT 2551");
const identified = "GTRT 2551: Mufla FIV de Tabapuã, raça Tabapuã, fêmea.";

for (const scenario of animalRegistryCases) {
  test(`registro: ${scenario.message}`, () => {
    const intent = classifyDomainIntent(scenario.message);
    assert.equal(intent.intent, scenario.intent);
    assert.equal(intent.needs_web_search, scenario.web);
    assert.deepEqual(intent.entities, scenario.codes);
  });
}

test("não confunde unidades, quantidade de animais, produto ou número isolado", () => {
  for (const message of [
    "Tenho 100 bois de 420 kg",
    "GMD 1200",
    "dose 10 ml",
    "RGD 2551",
    "2551",
    "Produto ABC 123",
    "CPF 12345",
    "Preço R$ 300",
    "PDF 2026",
    "DuKamp 40 S",
    "GTRT 255100",
  ]) {
    assert.deepEqual(extractAnimalRegistrations(message), [], message);
  }
});

test("preserva zeros e letras do número e separa registros parecidos", () => {
  assert.equal(extractAnimalRegistrations("CA 1511")[0]?.code, "CA 1511");
  assert.equal(extractAnimalRegistrations("registro da vaca ca1511")[0]?.code, "CA 1511");
  assert.equal(extractAnimalRegistrations("registro a 100").length, 0);
  assert.deepEqual(
    extractAnimalRegistrations("registro ABC 0025A e GTRT-2552").map(({ code }) => code),
    ["ABC 0025A", "GTRT 2552"],
  );
});

test("raça e genealogia em continuação conservam o registro sem contaminar outro assunto", () => {
  const history = [{ role: "user" as const, content: "GTRT 2551" }];
  assert.deepEqual(resolveAnimalRegistryTurn("e a raça?", history).registrations, animal);
  assert.deepEqual(resolveAnimalRegistryTurn("e a genealogia?", history).registrations, animal);
  assert.deepEqual(resolveAnimalRegistryTurn("qual a raça?", history).registrations, animal);
  assert.deepEqual(
    resolveAnimalRegistryTurn("e a mãe?", history, "GTRT 2551").registrations,
    animal,
  );
  assert.deepEqual(
    resolveAnimalRegistryTurn("qual o sexo?", [{ role: "user", content: "e a mãe?" }], "GTRT 2551")
      .registrations,
    animal,
  );
  assert.equal(resolveAnimalRegistryTurn("vai chover amanhã?", history, "GTRT 2551").active, false);
  assert.equal(resolveAnimalRegistryTurn("qual ração usar?", history, "GTRT 2551").active, false);
  assert.equal(
    resolveAnimalRegistryTurn("qual a raça?", [{ role: "user", content: "previsão em Rio Preto" }])
      .active,
    false,
  );
  assert.deepEqual(
    resolveAnimalRegistryTurn("e GTRT 2552?", history, "GTRT 2551").registrations.map(
      ({ code }) => code,
    ),
    ["GTRT 2552"],
  );
});

test("registro expõe busca externa e plano obrigatório com grafias e fontes primárias", async () => {
  assert.ok(
    toolsForIntent(classifyDomainIntent("GTRT 2551")).some(
      ({ name }) => name === "search_current_information",
    ),
  );
  assert.equal(researchProfileForQuery("GTRT 2551"), "animal_registry");
  const plan = await researchChatGPT("Qual a raça do GTRT 2551?");
  for (const token of [
    "CHATGPT_WEB_SEARCH_REQUIRED",
    "animal_registry",
    "GTRT 2551",
    "GTRT-2551",
    "GTRT2551",
    "ABCZ",
    "criatorio",
    "pai",
  ]) {
    assert.ok(
      plan
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(token),
      token,
    );
  }
  assert.match(plan, /NÃO codifica a raça/);
  assert.match(plan, /CAPTCHA/);
  assert.doesNotMatch(plan, /Mufla|raça Tabapuã/);
  assert.match(animalRegistryDirective([]), /peça a identificação completa/);
});

test("guard exige código exato e fonte recuperada para identificação positiva", () => {
  assert.deepEqual(validateAnimalRegistryReply(`${identified} ${source}`, animal, [source]), []);
  assert.ok(
    validateAnimalRegistryReply(identified, animal, []).includes("animal_source_link_missing"),
  );
  assert.ok(
    validateAnimalRegistryReply(`${identified} https://inventado.invalid/ficha`, animal, [
      source,
    ]).includes("animal_source_not_retrieved"),
  );
  assert.ok(
    validateAnimalRegistryReply(`GTRT 2552: Mufla, raça Tabapuã. ${source}`, animal, [
      source,
    ]).includes("animal_registration_missing"),
  );
  assert.ok(
    validateAnimalRegistryReply(`${identified} ${ABCZ_PUBLIC_CONSULTATION}`, animal, [
      ABCZ_PUBLIC_CONSULTATION,
    ]).includes("animal_source_not_retrieved"),
  );
  assert.ok(
    validateAnimalRegistryReply(
      "Não consegui consultar, mas GTRT 2551 é da raça Tabapuã.",
      animal,
      [],
    ).includes("animal_source_not_retrieved"),
  );
});

test("guard rejeita adiar consulta ou deduzir raça pelas letras", () => {
  assert.ok(
    validateAnimalRegistryReply("GTRT 2551: posso pesquisar na ABCZ.", animal).includes(
      "animal_lookup_deferred",
    ),
  );
  assert.ok(
    validateAnimalRegistryReply(
      `O prefixo GTRT indica Tabapuã, portanto GTRT 2551 é Tabapuã. ${source}`,
      animal,
      [source],
    ).includes("breed_inferred_from_series"),
  );
});

test("ausência pública oferece certificado e não afirma inexistência", () => {
  const reply = animalRegistryUnconfirmedReply(animal);
  assert.deepEqual(validateAnimalRegistryReply(reply, animal, []), []);
  assert.match(reply, /não significa que o registro não exista/);
  assert.match(reply, /foto legível do certificado/);
  assert.doesNotMatch(reply, /Mufla|Tabapuã/);
});

test("WhatsApp verifica evidência internamente e só mostra fontes quando solicitadas", () => {
  const rawReply = `${identified}\nFontes consultadas:\n- [Criatório](${source})`;
  assert.deepEqual(validateAnimalRegistryReply(rawReply, animal, [source]), []);
  const reply = formatReplyForUser(rawReply, "GTRT 2551");
  assert.equal(reply, identified);
  assert.doesNotMatch(reply, /Fontes|https?:\/\//);
  const requestedReply = formatReplyForUser(rawReply, "GTRT 2551, mostre as fontes");
  assert.ok(requestedReply.includes(source));
  assert.match(requestedReply, /Fontes:/);
});

test("fluxo OpenAI exige web e conserva anotações reais, sem aceitar URL inventada", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-registry-key";
  try {
    await withAIUsageContext(async () => {
      let body: Record<string, unknown> = {};
      const reply = await askOpenAI([{ role: "user", content: "GTRT 2551" }], {
        channel: "whatsapp",
        context: await researchChatGPT("GTRT 2551"),
        sourcePolicy: animalRegistryDirective(animal),
        researchDepth: "medium",
        preserveSourceLinks: true,
        fetchImpl: async (_input, init) => {
          body = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              status: "completed",
              output: [
                { type: "web_search_call", action: { sources: [{ url: source }] } },
                {
                  type: "message",
                  content: [
                    {
                      type: "output_text",
                      text: `${identified} https://inventado.invalid`,
                      annotations: [{ type: "url_citation", url: source, title: "Criatório" }],
                    },
                  ],
                },
              ],
            }),
          );
        },
      });
      assert.equal(body.tool_choice, "required");
      assert.ok(reply.includes(source));
      assert.ok(!reply.includes("https://inventado.invalid"));
      const urls = getAIUsageEvents().flatMap(
        (event) => event.citations?.map(({ url }) => url) ?? [],
      );
      assert.deepEqual(validateAnimalRegistryReply(reply, animal, urls), []);
    });
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("multimodelo pesquisa via Perplexity e mantém a citação sem pedido de links", async () => {
  const result = await orchestrateAI(
    {
      message: "GTRT 2551",
      messages: [{ role: "user", content: "GTRT 2551" }],
      webRequired: true,
      preserveSourceLinks: true,
      sourcePolicy: animalRegistryDirective(animal),
    },
    {
      env: { PERPLEXITY_API_KEY: "test-perplexity" },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "sonar-pro",
            choices: [{ message: { content: `${identified} [1]` } }],
            citations: [source],
            usage: { prompt_tokens: 10, completion_tokens: 10 },
          }),
        ),
    },
  );
  assert.equal(result.provider, "perplexity");
  assert.deepEqual(
    validateAnimalRegistryReply(
      result.text,
      animal,
      result.citations.map(({ url }) => url),
    ),
    [],
  );
});
