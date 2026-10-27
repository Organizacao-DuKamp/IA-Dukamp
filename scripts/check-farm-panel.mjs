// Integration harness: real browser, public route, HTTP handler and isolated PostgreSQL.
// No production credentials, messages or databases are used.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { farmIntegration } from "../tests/helpers/farm-integration.ts";
import { handleFarmPanel, handlePanelCodeRequest } from "../src/lib/guardian/panel.server.ts";

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
    "PASS: public access, invalid code, WhatsApp code, isolated cookie session, reviewed edit, PostgreSQL persistence, reload, mobile layout and logout.",
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
