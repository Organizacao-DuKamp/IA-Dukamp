// Real mobile/desktop browser + isolated PostgreSQL panel. No production data or sends.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID, randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { farmIntegration } from "../tests/helpers/farm-integration.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";
import { handleFarmPanel, hashToken } from "../src/lib/guardian/panel.server.ts";
import { PDFDocument } from "pdf-lib";

const origin = process.env.FARM_PANEL_TEST_ORIGIN ?? "http://127.0.0.1:8080";
const f = await farmIntegration();
const phone = "5517000000841",
  property = randomUUID(),
  token = randomBytes(32).toString("hex");
let browser,
  uploaded = false,
  server;
const errors = [];
try {
  await f.guardian.commit({
    phone,
    messageId: "seed-experience",
    accountVersion: 0,
    propertyId: property,
    propertyVersion: null,
    operation: "create",
    book: emptyFarm("Fazenda Boa Vista", "Tanabi", "SP"),
    pending: null,
    reply: "ok",
  });
  assert.equal(
    await f.store.links.issue(phone, property, "panel", hashToken(token), "login"),
    true,
  );
  server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(new URL(req.url, origin), {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
      });
      const result = await handleFarmPanel(request, { store: f.store, enabled: true });
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end('{"error":"isolated_fixture_failed"}');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const backend = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/public/farm-panel", async (route) =>
    route.fulfill({ response: await route.fetch({ url: backend + "/api/public/farm-panel" }) }),
  );
  await page.route("**/api/public/farm-panel/animal-registry", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  // Only the importer HTTP UI is stubbed; extraction and commits have independent tests.
  await page.route("**/api/public/farm-panel/imports**", async (route) => {
    if (route.request().method() === "POST") {
      uploaded = true;
      return route.fulfill({ json: { ok: true, message: "Arquivo recebido" } });
    }
    return route.fulfill({
      json: {
        batch: uploaded ? { id: property, revision: 1, status: "review" } : null,
        rows: uploaded
          ? [1, 2].map((n) => ({
              id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
              profile: { code: `QA ${n}`, name: `Animal ${n}`, sex: "female" },
              issues: [],
              status: "review",
              update_fields: [],
              page: 1,
            }))
          : [],
        files: [],
        total: uploaded ? 2 : 0,
        page: 1,
      },
    });
  });
  await page.goto(origin + "/painelfazenda#login=" + token);
  await page
    .getByRole("heading", { name: "Fazenda Boa Vista", exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(await page.getByRole("heading", { name: "Equipe e acessos" }).count(), 0);
  assert.ok(await page.getByRole("button", { name: "Alterar foto da fazenda" }).isVisible());
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  );
  await page.screenshot({ path: "/workspace/work/farm-home-mobile.png", fullPage: true });
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("button", { name: "Rebanho", exact: true }).click();
  await page.getByRole("heading", { name: "Rebanho e lotes", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /Medicações e vacinas/ }).isVisible(), false);
  await page.getByText("Saúde do rebanho", { exact: true }).click();
  await page.getByRole("button", { name: /Medicações e vacinas/ }).waitFor();
  await page.screenshot({ path: "/workspace/work/farm-herd-mobile.png", fullPage: true });
  // True touch events exercise touch-action and pointer cancellation in Chromium.
  const cdp = await context.newCDPSession(page);
  const swipe = async (dx) => {
    await page.evaluate(() => scrollTo(0, 0));
    const box = await page.locator(".farm-pages").boundingBox();
    const x = dx < 0 ? 350 : 40,
      y = box.y + 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 5; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / 5, y }],
      });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(-220);
  await page.getByRole("heading", { name: "Tarefas", exact: true }).waitFor({ timeout: 3000 });
  await nav.getByRole("button", { name: "Mais", exact: true }).click();
  await page.getByRole("button", { name: "Equipe e acessos", exact: true }).click();
  await page.getByRole("heading", { name: "Equipe e acessos", exact: true }).last().waitFor();
  await nav.getByRole("button", { name: "Início", exact: true }).click();
  // Create a real encoded photo and persist it via the actual panel handler + SQL.
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 80;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#065f46";
    ctx.fillRect(0, 0, 80, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Escolher foto da fazenda").setInputFiles({
    name: "fazenda.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("button", { name: "Confirmar e salvar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("img", { name: "Foto da fazenda", exact: true }).waitFor();
  assert.match((await f.guardian.load(phone)).active.book.photo, /^data:image\/jpeg;base64,/);
  await page.getByRole("button", { name: "Novo registro", exact: true }).click();
  await page.getByLabel("O que deseja fazer?").selectOption("animal");
  assert.equal(await page.getByLabel("Identificação do animal *", { exact: true }).count(), 0);
  await page.getByLabel("Série alfabética", { exact: true }).fill("QA");
  await page.getByLabel("RGN", { exact: true }).fill("101");
  await page.getByRole("button", { name: "Revisar antes de salvar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e salvar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal((await f.guardian.load(phone)).active.book.animals[0].code, "QA 101");
  await page.getByRole("button", { name: "Novo registro", exact: true }).click();
  await page.getByLabel("O que deseja fazer?").selectOption("animal");
  await page.getByRole("button", { name: "Importar animais de PDF ou Excel", exact: true }).click();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const importer = page.getByRole("dialog").last();
  await importer.locator('input[type="file"]').setInputFiles({
    name: "animais-terceiros.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await importer.getByRole("heading", { name: "QA 1 · Animal 1", exact: true }).waitFor();
  await importer.getByRole("heading", { name: "QA 2 · Animal 2", exact: true }).waitFor();
  assert.ok(uploaded);
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "Importar animais", exact: true }) })
    .waitFor({ state: "hidden" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("navigation", { name: "Áreas da fazenda" })
    .getByRole("button", { name: "Visão geral", exact: true })
    .click();
  await page.screenshot({ path: "/workspace/work/farm-home-desktop.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  );
  // Mouse drag on non-interactive content also advances a tab.
  await page.evaluate(() => scrollTo(0, 0));
  const box = await page.locator(".farm-pages").boundingBox();
  await page.mouse.move(box.x + box.width - 25, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 200, box.y + 15, { steps: 6 });
  await page.mouse.up();
  await page
    .getByRole("navigation", { name: "Áreas da fazenda" })
    .getByRole("button", { name: "Rebanho e lotes", exact: true })
    .getAttribute("aria-current")
    .then((v) => assert.equal(v, "page"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile touch navigation, desktop drag, grouped layout, separate team, photo persistence/reload, registration by series/RGN and multi-animal import UI.",
  );
} catch (error) {
  console.error("BROWSER ERRORS", errors);
  if (browser) {
    const p = browser.contexts()[0]?.pages()[0];
    if (p) {
      console.error((await p.locator("body").innerText()).slice(0, 2500));
      console.error(
        await p.evaluate(() => ({
          inner: innerWidth,
          client: document.documentElement.clientWidth,
          overflow: [...document.querySelectorAll("body *")]
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              x: e.getBoundingClientRect().x,
              w: e.getBoundingClientRect().width,
            }))
            .filter((e) => e.x + e.w > document.documentElement.clientWidth + 1)
            .slice(-20),
        })),
      );
      await p.screenshot({ path: "/workspace/work/farm-failure.png", fullPage: true });
    }
  }
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await f.db.close();
}
