// Access regression: real browser + HTTP handler + isolated PostgreSQL.
// No production credentials, WhatsApp sends, or real farm data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { farmIntegration } from "../tests/helpers/farm-integration.ts";
import { handleFarmPanel, hashToken } from "../src/lib/guardian/panel.server.ts";
import { emptyFarm } from "../src/lib/guardian/schema.ts";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href
    : "playwright"
);
const origin = process.env.FARM_PANEL_TEST_ORIGIN ?? "http://127.0.0.1:8080";
const f = await farmIntegration();
const phone = "5517000000401";
let browser;
let releaseRefresh = () => {};
let holdRefresh = false;
let refreshStarted;
let sequence = 0;
const errors = [],
  requests = [];
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(new URL(req.url, origin), {
      method: req.method,
      headers: req.headers,
      ...(!["GET", "HEAD"].includes(req.method) ? { body } : {}),
    });
    const result = await handleFarmPanel(request, { store: f.store, enabled: true });
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    res.writeHead(500);
    res.end('{"error":"isolated_fixture_failed"}');
  }
});
try {
  const property = randomUUID();
  await f.guardian.commit({
    phone,
    messageId: "seed",
    accountVersion: 0,
    propertyId: property,
    propertyVersion: null,
    operation: "create",
    book: emptyFarm("Fazenda QA entrada", "Tanabi", "SP"),
    pending: null,
    reply: "ok",
  });
  const issue = async () => {
    const message = "entry-" + ++sequence;
    const token = createHash("sha256").update(message).digest("hex");
    // Each case is a separate authenticated WhatsApp request, outside issuance rate windows.
    await f.db.exec(
      "UPDATE guardian_access_links SET created_at=now()-interval '11 minutes' WHERE created_by='" +
        phone +
        "'",
    );
    assert.equal(
      await f.store.links.issue(phone, property, message, hashToken(token), "login"),
      true,
    );
    return token;
  };
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const backend = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    window.TpecAndroid = { postMessage() {} };
    window.__panelDocument = Math.random();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/public/farm-panel", async (route) => {
    requests.push({ method: route.request().method(), kind: route.request().postDataJSON()?.kind });
    const response = await route.fetch({ url: backend + "/api/public/farm-panel" });
    if (holdRefresh && route.request().method() === "GET") {
      holdRefresh = false;
      refreshStarted();
      await new Promise((resolve) => {
        releaseRefresh = resolve;
      });
    }
    await route.fulfill({ response });
  });
  const heading = page.getByRole("heading", { name: "Fazenda QA entrada", exact: true });
  const entry = page.getByRole("heading", { name: "Acesse sua fazenda por link", exact: true });
  const cold = await issue();
  await page.goto(origin + "/painelfazenda#login=" + cold);
  await heading.waitFor({ timeout: 15000 });
  assert.equal(new URL(page.url()).hash, "");
  console.log("PASS cold link: one open authenticates and displays the farm.");
  const document = await page.evaluate(() => window.__panelDocument);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await entry.waitFor();
  const warm = await issue();
  await page.goto(origin + "/painelfazenda#login=" + warm);
  assert.equal(
    await page.evaluate(() => window.__panelDocument),
    document,
    "warm link must exercise the same document, as Android loadUrl does for fragments",
  );
  await heading.waitFor({ timeout: 5000 });
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(requests.filter((r) => r.kind === "link_exchange").length, 2);
  console.log("PASS logout + fresh warm link: one open re-enters without restarting the app.");
  // A pending renewal must not replace the fresh session or reset the new view.
  const slowRefresh = new Promise((resolve) => {
    refreshStarted = resolve;
  });
  holdRefresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await slowRefresh;
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  const afterSlow = await issue();
  await page.goto(origin + "/painelfazenda#login=" + afterSlow);
  releaseRefresh();
  await heading.waitFor({ timeout: 10000 });
  const appCookie = (await context.cookies()).find(
    (cookie) => cookie.name === "tpec_farm_app_session",
  );
  assert.ok(appCookie?.httpOnly);
  assert.equal((await f.store.authorize(hashToken(appCookie.value), true)).propertyId, property);
  console.log(
    "PASS pending refresh + logout + new link: old responses cannot replace the new session.",
  );

  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await entry.waitFor();
  await page.goto(origin + "/painelfazenda#login=" + warm);
  await page.getByRole("alert").filter({ hasText: "Link inválido" }).waitFor();
  assert.equal(await heading.count(), 0, "logout must not resurrect a consumed link");
  const afterUsed = await issue();
  await page.goto(origin + "/painelfazenda#login=" + afterUsed);
  await heading.waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("alert").count(), 0);
  console.log(
    "PASS rejected used link + fresh link: error clears and the next link opens on its first attempt.",
  );

  const invitation = createHash("sha256").update("qa-invite").digest("hex");
  assert.equal(
    await f.store.links.issue(phone, property, "qa-invite", hashToken(invitation), "invite"),
    true,
  );
  await page.goto(origin + "/painelfazenda#invite=" + invitation);
  await page.getByRole("link", { name: "Confirmar pelo WhatsApp" }).waitFor();
  assert.equal(await heading.count(), 0);
  const afterInvite = await issue();
  await page.goto(origin + "/painelfazenda#login=" + afterInvite);
  await heading.waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("link", { name: "Confirmar pelo WhatsApp" }).count(), 0);
  assert.equal(await page.evaluate(() => window.__panelDocument), document);
  await page.reload();
  await heading.waitFor();
  console.log(
    "PASS warm invitation -> personal link -> reopen: the panel replaces the invite and preserves access.",
  );

  // A web browser and an already-open app with no previous session also accept
  // the first incoming link. The native bridge here is simulated, not an APK test.
  for (const native of [false, true]) {
    const freshContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    if (native)
      await freshContext.addInitScript(() => {
        window.TpecAndroid = { postMessage() {} };
      });
    const freshPage = await freshContext.newPage();
    freshPage.on("pageerror", (error) => errors.push(error.message));
    await freshPage.route("**/api/public/farm-panel", async (route) => {
      const response = await route.fetch({ url: backend + "/api/public/farm-panel" });
      await route.fulfill({ response });
    });
    await freshPage.goto(origin + "/painelfazenda");
    await freshPage
      .getByRole("heading", { name: "Acesse sua fazenda por link", exact: true })
      .waitFor();
    const first = await issue();
    await freshPage.goto(origin + "/painelfazenda#login=" + first);
    await freshPage
      .getByRole("heading", { name: "Fazenda QA entrada", exact: true })
      .waitFor({ timeout: 5000 });
    const cookieName = native ? "tpec_farm_app_session" : "tpec_farm_session";
    assert.ok(
      (await freshContext.cookies()).some(
        (cookie) => cookie.name === cookieName && cookie.httpOnly,
      ),
    );
    assert.equal(new URL(freshPage.url()).hash, "");
    await freshPage.getByRole("button", { name: "Mais", exact: true }).click();
    await freshPage.getByRole("button", { name: "Sair desta fazenda", exact: true }).click();
    await freshPage
      .getByRole("heading", { name: "Acesse sua fazenda por link", exact: true })
      .waitFor();
    const mobileReturn = await issue();
    await freshPage.goto(origin + "/painelfazenda#login=" + mobileReturn);
    await freshPage
      .getByRole("heading", { name: "Fazenda QA entrada", exact: true })
      .waitFor({ timeout: 5000 });
    assert.equal(await freshPage.getByRole("dialog", { name: "Sua fazenda" }).count(), 0);
    await freshContext.close();
    console.log(
      `PASS first incoming link with an already-open ${native ? "app" : "browser"}: no reload or second click.`,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  releaseRefresh();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await f.db.close();
}
