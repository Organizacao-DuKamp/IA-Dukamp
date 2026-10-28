// Integration harness: real browser, public route, HTTP handler and isolated PostgreSQL.
// No production credentials, messages or databases are used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { farmIntegration } from "../tests/helpers/farm-integration.ts";
import { handleFarmPanel, handlePanelCodeRequest } from "../src/lib/guardian/panel.server.ts";
import { handleGuardianMessage } from "../src/lib/guardian/handler.server.ts";

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const origin = process.env.FARM_PANEL_TEST_ORIGIN ?? "http://127.0.0.1:8080";
const f = await farmIntegration();
const phone = "5517999991111",
  code = "ABCD2345EFGH6789";
let browser, testPage;
const browserErrors = [];
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await handleFarmPanel(
      new Request(new URL(req.url, origin), {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
      }),
      { store: f.store, enabled: true },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end("integration_handler_error");
  }
});
try {
  await f.observe(
    phone,
    "initial",
    "Minha fazenda fica em Tanabi e tenho 40 cabeças.",
    "2026-10-24T15:00:00Z",
  );
  const issued = await handlePanelCodeRequest(
    { phone, messageId: "browser-code", text: "gerar código do painel" },
    { load: f.guardian.load, issue: f.issue, code: () => code },
  );
  assert.match(issued, /ABCD-2345-EFGH-6789/);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const backend = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage(),
    errors = browserErrors;
  testPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  // Route the application's HTTP boundary to the isolated integration database.
  // Business logic and SQL are the same implementations used by the real API.
  await page.route("**/api/public/farm-panel", async (route) => {
    const response = await route.fetch({ url: backend + "/api/public/farm-panel" });
    await route.fulfill({ response });
  });
  await page.goto(origin + "/painelfazenda", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Acesse sua fazenda" }).waitFor();
  await page.getByLabel("Código de acesso", { exact: true }).fill("AAAA-AAAA-AAAA-AAAA");
  await page.getByRole("button", { name: "Entrar no painel", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Código inválido" }).waitFor();
  await page.getByLabel("Código de acesso", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Entrar no painel", exact: true }).click();
  await page.getByRole("heading", { name: "Propriedade sem nome — Tanabi", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("article")
      .filter({ hasText: "Rebanho calculado" })
      .innerText()
      .then((text) => text.includes("40")),
    true,
  );
  await page.getByRole("button", { name: "Novo registro", exact: true }).click();
  await page.getByRole("combobox").first().selectOption("expense");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("150.50");
  await page.getByLabel("Descrição", { exact: true }).fill("Ração registrada pelo painel");
  await page.getByRole("button", { name: "Revisar antes de salvar", exact: true }).click();
  assert.equal((await f.guardian.load(phone)).active.book.ledger.length, 0);
  await page.getByRole("button", { name: "Confirmar e salvar", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Lançamento" }).waitFor();
  assert.equal((await f.guardian.load(phone)).active.book.ledger[0].amountCents, 15050);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Propriedade sem nome — Tanabi", exact: true }).waitFor();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByText("Ração registrada pelo painel", { exact: true }).waitFor();
  // Natural WhatsApp reports must reach the same database and visible sections.
  const reportAt = new Date();
  const financial = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-finance",
      text: "A minha fazenda tem uma receita de 100 mil e uma despesa de 80 mil nesse mês, registre isso",
    },
    {
      store: f.guardian,
      now: reportAt,
      extract: async () => {
        throw new Error("unexpected extraction");
      },
    },
  );
  assert.equal(financial.persisted, true);
  const herd = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-herd",
      text: "Nasceu 4 bezerros na fazenda hoje, mas hoje também morreu 2\nUm dos bezerros já tem código e rgn: KBU 491",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(herd.persisted, true);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page
    .getByText(/100\.000,00/)
    .first()
    .waitFor();
  await page
    .getByText(/80\.000,00/)
    .first()
    .waitFor();
  await page.getByText("Já incluído no total", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  assert.match(
    await page.getByRole("article").filter({ hasText: "Rebanho calculado" }).innerText(),
    /42/,
  );
  await page.locator("summary").filter({ hasText: "KBU 491" }).click();
  await page.getByText(/RGN informado: KBU 491/).waitFor();
  const audioEntry = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-audio-more-four",
      text: "[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise o áudio.\nTranscrição do áudio: Pepec, agora nasceram mais quatro bezerros aqui na minha fazenda, tá? Se você puder registrar isso pra mim...",
      mediaType: "audio",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(audioEntry.persisted, true);
  assert.match(audioEntry.reply, /46 animais/);
  assert.match(audioEntry.reply, /código\/brinco e RGN/);
  const identified = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-identification",
      text: "código B101, RGN KBU 501\ncódigo B102, RGN KBU 502\ncódigo B103\ncódigo B104",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(identified.persisted, true);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(
    await page.getByRole("article").filter({ hasText: "Rebanho calculado" }).innerText(),
    /46/,
  );
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  await page.locator("summary").filter({ hasText: "B101" }).click();
  await page.getByText(/RGN informado: KBU 501/).waitFor();
  const firstPhrase = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-plus-two",
      text: "Tpec-ia nasceu +2 bezerros novos hoje na minha fazenda ok",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(firstPhrase.persisted, true);
  assert.match(firstPhrase.reply, /48 animais/);
  const rephrase = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-today-same",
      text: "Hoje mesmo nasceu 2 bezerros aqui na minha fazenda",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(rephrase.persisted, false);
  assert.match(rephrase.reply, /mesmos animais ou de mais 2/);
  await handleGuardianMessage(
    { phone, messageId: "browser-same", text: "são os mesmos" },
    { store: f.guardian, now: reportAt },
  );
  const newIdentities = await handleGuardianMessage(
    {
      phone,
      messageId: "browser-plus-two-ids",
      text: "código C01, RGN KBU 701\ncódigo C02, RGN KBU 702",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(newIdentities.persisted, true);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(
    await page.getByRole("article").filter({ hasText: "Rebanho calculado" }).innerText(),
    /48/,
  );
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  await page.locator("summary").filter({ hasText: "C01" }).click();
  await page.getByText(/RGN informado: KBU 701/).waitFor();
  await handleGuardianMessage(
    { phone, messageId: "browser-context-purchase", text: "Hoje comprei mais 4 gados" },
    { store: f.guardian, now: reportAt },
  );
  const oneIdentity = await handleGuardianMessage(
    { phone, messageId: "browser-only-one", text: "Apenas 1 gado tem:\nDUKN 401" },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(oneIdentity.persisted, true);
  assert.doesNotMatch(oneIdentity.reply, /ABCZ|fontes públicas/);
  await handleGuardianMessage(
    { phone, messageId: "browser-same-rgn", text: "sim, é o mesmo" },
    { store: f.guardian, now: reportAt },
  );
  await handleGuardianMessage(
    { phone, messageId: "browser-context-expense", text: "Paguei a manutenção do curral" },
    { store: f.guardian, now: reportAt },
  );
  const contextExpense = await handleGuardianMessage(
    { phone, messageId: "browser-context-amount", text: "250 reais" },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(contextExpense.persisted, true);
  await handleGuardianMessage(
    { phone, messageId: "browser-context-field", text: "Consertei a cerca semana passada" },
    { store: f.guardian, now: reportAt },
  );
  const contextNote = await handleGuardianMessage(
    { phone, messageId: "browser-context-date", text: "foi ontem" },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(contextNote.persisted, true);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(
    await page.getByRole("article").filter({ hasText: "Rebanho calculado" }).innerText(),
    /52/,
  );
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  await page.locator("summary").filter({ hasText: "DUKN 401" }).click();
  await page.getByText(/RGN informado: DUKN 401/).waitFor();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("heading", { name: "a manutenção do curral", exact: true }).waitFor();
  await page.getByRole("button", { name: "Caderno de campo", exact: true }).click();
  await page.getByText("Consertei a cerca semana passada", { exact: true }).waitFor();
  // Reproduce the producer's audio, identity list, contextual lot edit and monthly cost.
  const spokenBirth = await handleGuardianMessage(
    {
      phone,
      messageId: "practical-audio-birth",
      mediaType: "audio",
      text: "[Mensagem recebida por áudio no WhatsApp]\nPedido do usuário: Analise e responda ao áudio que enviei.\nTranscrição do áudio: Repente, adicione mais dois bezerros que nasceram hoje, tá? no rebanho, por favor.",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(spokenBirth.persisted, true);
  const spokenIds = await handleGuardianMessage(
    { phone, messageId: "practical-ids", text: "Sim, eles tem:\nBR201\nBR202" },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(spokenIds.persisted, true);
  const lotEdit = await handleGuardianMessage(
    {
      phone,
      messageId: "practical-lot",
      text: "Sabe esses dois últimos animais registrados? Então, coloque eles no lote 2 da fazenda por favor",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(lotEdit.persisted, true);
  const monthlyCost = await handleGuardianMessage(
    {
      phone,
      messageId: "practical-monthly",
      text: "Minha fazenda tem cinco mil de despesas todos os meses com cana de açúcar",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(monthlyCost.persisted, true);
  const moneyEdit = await handleGuardianMessage(
    { phone, messageId: "practical-money-edit", text: "Corrija a última despesa para 5500 reais" },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(moneyEdit.persisted, true);
  const noteEdit = await handleGuardianMessage(
    {
      phone,
      messageId: "practical-note-edit",
      text: "Corrija a anotação Consertei a cerca semana passada para o lote 3",
    },
    { store: f.guardian, now: reportAt },
  );
  assert.equal(noteEdit.persisted, true);
  await page.reload({ waitUntil: "networkidle" });
  assert.match(
    await page.getByRole("article").filter({ hasText: "Rebanho calculado" }).innerText(),
    /54/,
  );
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "BR201" })
    .filter({ hasText: "Lote 2" })
    .waitFor();
  await page
    .locator("summary")
    .filter({ hasText: "BR202" })
    .filter({ hasText: "Lote 2" })
    .waitFor();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  const caneRow = page.getByRole("article").filter({ hasText: "cana de açúcar" });
  await caneRow.getByText("Detalhes do lançamento", { exact: true }).click();
  await caneRow.getByText("Valor mensal informado pelo produtor", { exact: true }).waitFor();
  assert.match(await caneRow.innerText(), /5\.500,00/);
  assert.equal(await caneRow.count(), 1);
  await page.getByRole("button", { name: "Caderno de campo", exact: true }).click();
  await page
    .getByRole("article")
    .filter({ hasText: "Consertei a cerca semana passada" })
    .filter({ hasText: "Lote 3" })
    .waitFor();
  await page.getByRole("button", { name: "Calculadoras", exact: true }).click();
  await page.getByLabel("Peso inicial (kg)", { exact: true }).fill("100");
  await page.getByLabel("Peso final (kg)", { exact: true }).fill("450");
  await page.getByLabel("Dias entre pesagens", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  await page.getByText(/GMD: 2,9167/).waitFor();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /Referência da definição|ainfo\.cnptia\.embrapa/,
  );
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  const screenshots = process.env.FARM_PANEL_SCREENSHOTS;
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: screenshots + "/farm-panel-finance-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Visão geral", exact: true }).click();
    await page.screenshot({
      path: screenshots + "/farm-panel-overview-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  }
  await page.getByRole("button", { name: "Receitas", exact: true }).click();
  assert.equal(await page.getByRole("heading", { name: "cana de açúcar", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByLabel("Buscar lançamento", { exact: true }).fill("cana de açúcar");
  assert.equal(await page.getByRole("article").filter({ hasText: "cana de açúcar" }).count(), 1);
  await page.getByLabel("Buscar lançamento", { exact: true }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    "Mobile page must not overflow horizontally",
  );
  if (screenshots)
    await page.screenshot({ path: screenshots + "/farm-panel-mobile.png", fullPage: true });
  for (const area of [
    "Visão geral",
    "Rebanho e lotes",
    "Tarefas",
    "Caderno de campo",
    "Calculadoras",
  ]) {
    await page.getByLabel("Área da fazenda", { exact: true }).selectOption({ label: area });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      area + " mobile overflow",
    );
    if (screenshots && area === "Visão geral")
      await page.screenshot({
        path: screenshots + "/farm-panel-overview-mobile.png",
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByRole("heading", { name: "Acesse sua fazenda" }).waitFor();
  if (screenshots) {
    await page.screenshot({ path: screenshots + "/farm-panel-access-mobile.png", fullPage: true });
  }
  // Installation UI: the browser owns the native confirmation; exercise its event contract.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {
        window.__panelInstallPromptCalled = true;
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Baixar aplicativo", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__panelInstallPromptCalled), true);
  const manifest = await (await context.request.get(origin + "/painelfazenda.webmanifest")).json();
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/painelfazenda");
  for (const icon of manifest.icons)
    assert.equal((await context.request.get(origin + icon.src)).status(), 200);
  // Simulate installed display mode and a full browser-context restart with persistent cookies.
  const appCode = "JKLM2345NPQR6789",
    appProperty = (await f.guardian.load(phone)).active.id;
  await f.issue(
    phone,
    appProperty,
    "installed-browser-code",
    (await import("../src/lib/guardian/panel.server.ts")).hashToken(appCode),
  );
  const prepareApp = async (ctx) => {
    await ctx.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === "(display-mode: standalone)"
          ? new Proxy(original(query), {
              get: (target, key) => (key === "matches" ? true : Reflect.get(target, key)),
            })
          : original(query);
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/api/public/farm-panel", async (route) => {
      const response = await route.fetch({ url: backend + "/api/public/farm-panel" });
      await route.fulfill({ response });
    });
    return p;
  };
  const appContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const appPage = await prepareApp(appContext);
  await appPage.goto(origin + "/painelfazenda?app=1", { waitUntil: "networkidle" });
  await appPage.getByLabel("Código de acesso", { exact: true }).fill(appCode);
  await appPage.getByRole("button", { name: "Entrar no painel", exact: true }).click();
  await appPage.getByRole("button", { name: "Sair", exact: true }).waitFor();
  const appState = await appContext.storageState();
  assert.ok(
    appState.cookies.some(
      (c) => c.name === "tpec_farm_app_session" && c.expires > Date.now() / 1000 + 300 * 86400,
    ),
  );
  await appContext.close();
  const restoredContext = await browser.newContext({
    storageState: appState,
    viewport: { width: 390, height: 844 },
  });
  const reopened = await prepareApp(restoredContext);
  await reopened.goto(origin + "/painelfazenda?app=1", { waitUntil: "networkidle" });
  await reopened.getByRole("button", { name: "Sair", exact: true }).waitFor();
  await reopened.getByText("Acesso mantido neste aplicativo.", { exact: true }).waitFor();
  if (screenshots)
    await reopened.screenshot({
      path: screenshots + "/farm-panel-installed-mobile.png",
      fullPage: true,
    });
  await reopened.getByText("Acesso e informações dos dados", { exact: true }).click();
  await reopened
    .getByRole("button", { name: "Sair de todos os meus acessos desta fazenda", exact: true })
    .click();
  await reopened.getByRole("heading", { name: "Acesse sua fazenda", exact: true }).waitFor();
  await restoredContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: public access, cookie session, reviewed edits, financial totals, herd events, natural identifier followups, financial amount followups, field note date followups, calculator, PostgreSQL persistence, reload, mobile layout and logout.",
  );
} catch (error) {
  if (testPage) {
    console.error(
      JSON.stringify({
        errors: browserErrors,
        visibleText: (await testPage.locator("body").innerText()).slice(0, 4500),
      }),
    );
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await f.db.close();
}
