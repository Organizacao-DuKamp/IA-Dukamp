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
      .filter({ hasText: "Estoque calculado" })
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
  await page.getByRole("cell", { name: "R$ 100.000,00", exact: true }).waitFor();
  await page.getByRole("cell", { name: "R$ 80.000,00", exact: true }).waitFor();
  await page
    .getByText(/total informado/)
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  assert.match(
    await page.getByRole("article").filter({ hasText: "Estoque calculado" }).innerText(),
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
    await page.getByRole("article").filter({ hasText: "Estoque calculado" }).innerText(),
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
    await page.getByRole("article").filter({ hasText: "Estoque calculado" }).innerText(),
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
    await page.getByRole("article").filter({ hasText: "Estoque calculado" }).innerText(),
    /52/,
  );
  await page.getByRole("button", { name: "Rebanho e lotes", exact: true }).click();
  await page.locator("summary").filter({ hasText: "DUKN 401" }).click();
  await page.getByText(/RGN informado: DUKN 401/).waitFor();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("cell").filter({ hasText: "a manutenção do curral" }).waitFor();
  await page.getByRole("button", { name: "Caderno de campo", exact: true }).click();
  await page.getByText("Consertei a cerca semana passada", { exact: true }).waitFor();
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
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true,
    "Mobile page must not overflow horizontally",
  );
  const screenshots = process.env.FARM_PANEL_SCREENSHOTS;
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: screenshots + "/farm-panel-mobile.png", fullPage: true });
  }
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByRole("heading", { name: "Acesse sua fazenda" }).waitFor();
  if (screenshots) {
    await page.screenshot({ path: screenshots + "/farm-panel-access-mobile.png", fullPage: true });
  }
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
